import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository, SelectQueryBuilder } from 'typeorm';
import { Order, OrderItem } from './order.entity';
import { Customer } from '../customers/customer.entity';
import { Product } from '../products/product.entity';
import { CreateOrderDto, UpdateOrderDto } from './dto';
import { CashService } from '../cash/cash.service';

type IncludeParam = 'customer' | 'items';
type SortParam = 'code_asc' | 'code_desc' | 'date_desc' | 'date_asc';

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

  // ---------- helpers de consultas ----------

  private applyIncludes(
    qb: SelectQueryBuilder<Order>,
    include: IncludeParam[] = [],
  ) {
    if (include.includes('customer')) {
      qb.leftJoinAndSelect('o.customer', 'customer');
    }
    if (include.includes('items')) {
      qb.leftJoinAndSelect('o.items', 'items');
    }
    return qb;
  }

  private applySort(qb: SelectQueryBuilder<Order>, sort?: SortParam) {
    // default por fecha desc
    if (!sort || sort === 'date_desc') {
      qb.orderBy('o.createdAt', 'DESC');
      return qb;
    }
    if (sort === 'date_asc') {
      qb.orderBy('o.createdAt', 'ASC');
      return qb;
    }

    // Seguro ante NULL o '' -> extrae dígitos y castea
    // COALESCE(o.code,'') -> REGEXP_REPLACE(...,'\D','', 'g') -> NULLIF(...,'') -> CAST(... AS INTEGER)
    const numExpr =
      `CAST(NULLIF(REGEXP_REPLACE(COALESCE(o.code, ''), '\\D', '', 'g'), '') AS INTEGER)`;

    if (sort === 'code_desc') {
      qb.orderBy(numExpr, 'DESC', 'NULLS LAST');
    } else if (sort === 'code_asc') {
      qb.orderBy(numExpr, 'ASC', 'NULLS FIRST');
    }

    // criterio secundario estable
    qb.addOrderBy('o.createdAt', 'DESC');
    return qb;
  }

  // ---------- queries ----------

  list(include: IncludeParam[] = [], sort?: SortParam) {
    const qb = this.orders.createQueryBuilder('o');
    this.applyIncludes(qb, include);
    this.applySort(qb, sort);
    return qb.getMany();
  }

  async get(id: string, include: IncludeParam[] = []) {
    const qb = this.orders.createQueryBuilder('o').where('o.id = :id', { id });
    this.applyIncludes(qb, include);
    const order = await qb.getOne();
    if (!order) throw new NotFoundException('Pedido no encontrado');
    return order;
  }

  // ---------- comandos ----------

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
        lock: { mode: 'pessimistic_write' },
      });
      const byId = new Map(prods.map((p) => [p.id, p]));

      // Validar disponible
      for (const it of dto.items) {
        const p = byId.get(it.productId);
        if (!p) throw new BadRequestException(`Producto inválido: ${it.productId}`);
        const available = Math.max(0, Number(p.stock || 0) - Number(p.reserved || 0));
        if (available < it.quantity) {
          throw new BadRequestException(`Stock insuficiente para ${p.name} (disp: ${available})`);
        }
      }
      // Reservar
      for (const it of dto.items) {
        const p = byId.get(it.productId)!;
        p.reserved = Number(p.reserved || 0) + Number(it.quantity || 0);
      }
      await manager.save(prods);

      // Crear pedido + items
      let total = 0;
      const order = manager.create(Order, {
        status: 'pending',
        customer: customer || undefined,
        total: 0,
      });
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
      // código PEDxxx se asigna vía trigger o en base.entity/BeforeInsert si ya lo tenés
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

    await this.cashService.registerSale(result.total, `Venta pedido ${result.id}`);
    return result;
  }

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
    await this.cancel(id); // libera reservas si quedaran
    await this.items.delete({ orderId: id });
    await this.orders.delete(id);
  }
}
