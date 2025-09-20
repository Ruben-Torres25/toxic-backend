import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  In,
  Repository,
} from 'typeorm';
import { Order, OrderItem } from './order.entity';
import { Customer } from '../customers/customer.entity';
import { Product } from '../products/product.entity';
import { CreateOrderDto, UpdateOrderDto } from './dto';
import { CashService } from '../cash/cash.service';

@Injectable()
export class OrdersService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Order) private orders: Repository<Order>,
    @InjectRepository(OrderItem) private items: Repository<OrderItem>,
    @InjectRepository(Customer) private customers: Repository<Customer>,
    @InjectRepository(Product) private products: Repository<Product>,
    private cashService: CashService,
  ) {}

  list() {
    return this.orders.find({ order: { createdAt: 'DESC' } });
  }

  async get(id: string) {
    const order = await this.orders.findOne({ where: { id } });
    if (!order) throw new NotFoundException('Pedido no encontrado');
    return order;
  }

  /**
   * Crear pedido:
   * - Valida disponible (stock - reserved)
   * - Incrementa reserved (no toca stock físico)
   */
  async create(dto: CreateOrderDto) {
    if (!dto.items?.length) {
      throw new BadRequestException('El pedido requiere items');
    }

    return this.dataSource.transaction(async (manager) => {
      // Cliente (opcional)
      let customer: Customer | null = null;
      if (dto.customerId) {
        customer = await manager.findOne(Customer, {
          where: { id: dto.customerId },
          lock: { mode: 'pessimistic_read' },
        });
        if (!customer) throw new BadRequestException('Cliente inválido');
      }

      // Lock de productos involucrados
      const ids = Array.from(new Set(dto.items.map((i) => i.productId)));
      const prods = await manager.find(Product, {
        where: { id: In(ids) },
        lock: { mode: 'pessimistic_write' }, // bloquea fila
      });
      const byId = new Map(prods.map((p) => [p.id, p]));

      // Validar disponible y reservar
      for (const it of dto.items) {
        const p = byId.get(it.productId);
        if (!p) throw new BadRequestException(`Producto inválido: ${it.productId}`);
        const available = Math.max(0, Number(p.stock || 0) - Number(p.reserved || 0));
        if (available < it.quantity) {
          throw new BadRequestException(`Stock insuficiente para ${p.name} (disp: ${available})`);
        }
      }
      for (const it of dto.items) {
        const p = byId.get(it.productId)!;
        p.reserved = Number(p.reserved || 0) + Number(it.quantity || 0);
      }
      await manager.save(prods);

      // Crear pedido + items
      let total = 0;
      const order = manager.create(Order, { status: 'pending', customer: customer || undefined, total: 0 });
      const saved = await manager.save(order);

      for (const it of dto.items) {
        const p = byId.get(it.productId)!;
        const unitPrice = it.unitPrice ?? Number(p.price || 0);
        const discount = Number(it.discount || 0);
        const lineTotal = (unitPrice * Number(it.quantity)) - discount;
        total += lineTotal;

        const item = manager.create(OrderItem, {
          orderId: saved.id,
          productId: p.id,
          productName: it.productName || p.name,
          unitPrice,
          quantity: it.quantity,
          discount,
          lineTotal,
        });
        await manager.save(item);
      }

      saved.total = total;
      return manager.save(saved);
    });
  }

  async update(id: string, dto: UpdateOrderDto) {
    const order = await this.get(id);
    if (dto.customerId) {
      const c = await this.customers.findOne({ where: { id: dto.customerId } });
      if (!c) throw new BadRequestException('Cliente inválido');
      order.customer = c;
    }
    if (dto.status) order.status = dto.status;
    return this.orders.save(order);
  }

  /**
   * Confirmar:
   * - reserved -= qty
   * - stock -= qty
   * - registra venta en caja
   */
  async confirm(id: string) {
    const result = await this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(Order, { where: { id } });
      if (!order) throw new NotFoundException('Pedido no encontrado');
      if (order.status === 'canceled') throw new BadRequestException('No se puede confirmar un pedido cancelado');
      if (order.status === 'confirmed') return order;

      const items = await manager.find(OrderItem, { where: { orderId: order.id } });
      const ids = Array.from(new Set(items.map((i) => i.productId)));
      const prods = await manager.find(Product, {
        where: { id: In(ids) },
        lock: { mode: 'pessimistic_write' },
      });
      const byId = new Map(prods.map((p) => [p.id, p]));

      // Aplicar descuentos
      for (const it of items) {
        const p = byId.get(it.productId)!;
        const r = Number(p.reserved || 0) - Number(it.quantity || 0);
        const s = Number(p.stock || 0) - Number(it.quantity || 0);
        if (r < 0 || s < 0) {
          throw new BadRequestException(`Inconsistencia de stock en ${p.name}`);
        }
        p.reserved = r;
        p.stock = s;
      }
      await manager.save(prods);

      order.status = 'confirmed';
      return manager.save(order);
    });

    // Registrar venta en caja fuera de la transacción principal
    await this.cashService.registerSale(result.total, `Venta pedido ${result.id}`);
    return result;
  }

  /**
   * Cancelar:
   * - reserved -= qty (no toca stock)
   */
  async cancel(id: string) {
    return this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(Order, { where: { id } });
      if (!order) throw new NotFoundException('Pedido no encontrado');
      if (order.status === 'confirmed') throw new BadRequestException('No se puede cancelar un pedido confirmado');
      if (order.status === 'canceled') return order;

      const items = await manager.find(OrderItem, { where: { orderId: order.id } });
      const ids = Array.from(new Set(items.map((i) => i.productId)));
      const prods = await manager.find(Product, {
        where: { id: In(ids) },
        lock: { mode: 'pessimistic_write' },
      });
      const byId = new Map(prods.map((p) => [p.id, p]));

      for (const it of items) {
        const p = byId.get(it.productId)!;
        const r = Number(p.reserved || 0) - Number(it.quantity || 0);
        if (r < 0) throw new BadRequestException(`Inconsistencia de reservas en ${p.name}`);
        p.reserved = r;
      }
      await manager.save(prods);

      order.status = 'canceled';
      return manager.save(order);
    });
  }

  async remove(id: string) {
    const order = await this.get(id);
    if (order.status === 'confirmed') {
      throw new BadRequestException('No se puede eliminar un pedido confirmado');
    }
    // Liberar reservas si quedaran (por seguridad)
    await this.cancel(id);
    await this.items.delete({ orderId: id });
    await this.orders.delete(id);
  }
}
