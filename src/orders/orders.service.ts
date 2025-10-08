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
import { LedgerService } from '../ledger/ledger.service'; // 👈 NUEVO

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
    private ledger: LedgerService, // 👈 NUEVO
  ) {}

  // ---- helpers de query ----
  private applyIncludes(qb: SelectQueryBuilder<Order>, include: IncludeParam[] = []) {
    if (include.includes('customer')) qb.leftJoinAndSelect('o.customer', 'customer');
    if (include.includes('items')) qb.leftJoinAndSelect('o.items', 'items');
    return qb;
  }
  private applySort(
    qb: SelectQueryBuilder<Order>,
    sort?: 'code_asc' | 'code_desc' | 'date_desc' | 'date_asc',
  ) {
    if (!sort || sort === 'date_desc') return qb.orderBy('o.createdAt', 'DESC');
    if (sort === 'date_asc') return qb.orderBy('o.createdAt', 'ASC');

    const codeNumExpr = `NULLIF(regexp_replace(COALESCE(o.code, ''), '[^0-9]', '', 'g'), '')::int`;
    if (sort === 'code_asc') qb.orderBy(codeNumExpr, 'ASC', 'NULLS FIRST');
    else qb.orderBy(codeNumExpr, 'DESC', 'NULLS LAST');

    qb.addOrderBy('o.createdAt', 'DESC');
    return qb;
  }

  // ---- list / get ----
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

  // ---- create ----
  async create(dto: CreateOrderDto) {
    if (!dto.items?.length) throw new BadRequestException('El pedido requiere items');

    return this.dataSource.transaction(async (manager) => {
      let customer: Customer | null = null;
      if (dto.customerId) {
        customer = await manager.findOne(Customer, {
          where: { id: dto.customerId },
          lock: { mode: 'pessimistic_read' },
        });
        if (!customer) throw new BadRequestException('Cliente inválido');
      }

      const ids = Array.from(new Set(dto.items.map((i) => i.productId)));
      const prods = await manager.find(Product, {
        where: { id: In(ids) },
        lock: { mode: 'pessimistic_write' },
      });
      const byId = new Map(prods.map((p) => [p.id, p]));

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

      let total = 0;
      const order = manager.create(Order, {
        status: 'pending',
        customer: customer || undefined,
        total: 0,
        notes: dto.notes ?? null,
      });
      const saved = await manager.save(order);

      for (const it of dto.items) {
        const p = byId.get(it.productId)!;
        const unitPrice = Number(it.unitPrice ?? p.price ?? 0);
        const discount = Number(it.discount ?? 0);
        const lineTotal = unitPrice * Number(it.quantity) - discount;
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

  // ---- update ----
  async update(id: string, dto: UpdateOrderDto) {
    return this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(Order, { where: { id } });
      if (!order) throw new NotFoundException('Pedido no encontrado');
      if (order.status === 'confirmed' || order.status === 'canceled') {
        throw new BadRequestException('No se puede editar un pedido confirmado/cancelado');
      }

      if (dto.customerId) {
        const c = await manager.findOne(Customer, { where: { id: dto.customerId } });
        if (!c) throw new BadRequestException('Cliente inválido');
        order.customer = c;
      }
      if (dto.status) order.status = dto.status;
      if (typeof dto.notes === 'string') order.notes = dto.notes;

      if (!dto.items) return manager.save(order);

      const prevItems = await manager.find(OrderItem, { where: { orderId: order.id } });

      if (prevItems.length) {
        const prevIds = Array.from(new Set(prevItems.map(i => i.productId)));
        const prevProds = await manager.find(Product, {
          where: { id: In(prevIds) },
          lock: { mode: 'pessimistic_write' },
        });
        const prevMap = new Map(prevProds.map(p => [p.id, p]));
        for (const it of prevItems) {
          const p = prevMap.get(it.productId)!;
          p.reserved = Math.max(0, Number(p.reserved || 0) - Number(it.quantity || 0));
        }
        await manager.save(prevProds);
      }

      const newIds = Array.from(new Set(dto.items.map(i => i.productId)));
      const newProds = await manager.find(Product, {
        where: { id: In(newIds) },
        lock: { mode: 'pessimistic_write' },
      });
      const newMap = new Map(newProds.map(p => [p.id, p]));

      for (const it of dto.items) {
        const p = newMap.get(it.productId);
        if (!p) throw new BadRequestException(`Producto inválido: ${it.productId}`);
        const available = Math.max(0, Number(p.stock || 0) - Number(p.reserved || 0));
        if (available < it.quantity) {
          throw new BadRequestException(`Stock insuficiente para ${p.name} (disp: ${available})`);
        }
      }
      for (const it of dto.items) {
        const p = newMap.get(it.productId)!;
        p.reserved = Number(p.reserved || 0) + Number(it.quantity || 0);
      }
      await manager.save(newProds);

      await manager.delete(OrderItem, { orderId: order.id });

      let newTotal = 0;
      for (const it of dto.items) {
        const p = newMap.get(it.productId)!;
        const unitPrice = Number(it.unitPrice ?? p.price ?? 0);
        const discount = Number(it.discount ?? 0);
        const lineTotal = unitPrice * Number(it.quantity) - discount;
        newTotal += lineTotal;

        const line = manager.create(OrderItem, {
          orderId: order.id,
          productId: p.id,
          productName: it.productName || p.name,
          unitPrice,
          quantity: it.quantity,
          discount,
          lineTotal,
        });
        await manager.save(line);
      }

      order.total = newTotal;
      return manager.save(order);
    });
  }

  // ---- confirm ----
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

    // Caja
    await this.cashService.registerSale(result.total, `Venta pedido ${result.id}`);

    // 👇 Ledger: deuda POSITIVA por el total del pedido
    await this.ledger.record({
      customerId: (result as any).customerId ?? null,
      type: 'order',
      sourceType: 'order',
      sourceId: result.id,
      amount: Math.abs(Number(result.total)),
      description: `Pedido confirmado ${result.code ?? result.id}`,
    });

    return result;
  }

  // ---- cancel ----
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

  // ---- remove ----
  async remove(id: string) {
    const order = await this.get(id);
    if (order.status === 'confirmed') {
      throw new BadRequestException('No se puede eliminar un pedido confirmado');
    }
    await this.cancel(id);
    await this.items.delete({ orderId: id });
    await this.orders.delete(id);
  }
}
