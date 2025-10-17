import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from './customer.entity';
import { CustomerMovement, MovementType } from './customer-movement.entity';
import { CreateCustomerDto, UpdateCustomerDto } from './dto';
import { Order } from '../orders/order.entity'; // IMPORT RELATIVO
import { LedgerService } from '../ledger/ledger.service'; // 👈 NUEVO

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer) private readonly repo: Repository<Customer>,
    @InjectRepository(CustomerMovement) private readonly movRepo: Repository<CustomerMovement>,
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    private readonly ledger: LedgerService, // 👈 NUEVO
  ) {}

  findAll() {
    return this.repo.find();
  }

  async findOne(id: string) {
    const c = await this.repo.findOne({ where: { id } });
    if (!c) throw new NotFoundException('Cliente no encontrado');
    return c;
  }

  async create(dto: CreateCustomerDto) {
    const c = this.repo.create({ ...dto, balance: 0 });
    return this.repo.save(c);
  }

  async update(id: string, dto: UpdateCustomerDto) {
    const c = await this.findOne(id);
    Object.assign(c, dto);
    return this.repo.save(c);
  }

  async remove(id: string) {
    // 404 si no existe
    await this.findOne(id);
    // borrar dependencias si la FK no tiene cascade
    await this.movRepo.delete({ customer: { id } } as any);
    // (opcional) si Orders no tiene cascade y querés borrarlos:
    // await this.orderRepo.delete({ customer: { id } } as any);
    await this.repo.delete(id);
  }

  /**
   * Ajuste manual:
   *  - amount > 0 => PAYMENT (disminuye deuda)
   *  - amount < 0 => DEBT    (aumenta deuda)
   *  - amount = 0 => ADJUST
   * (Se mantiene en customer_movements para compat.)
   */
  async adjust(id: string, amount: number, reason?: string) {
    const c = await this.findOne(id);
    const signed = Number(amount);
    c.balance = Number(c.balance) + signed;
    await this.repo.save(c);

    const type: MovementType =
      signed > 0 ? MovementType.PAYMENT :
      signed < 0 ? MovementType.DEBT :
      MovementType.ADJUST;

    const mov = this.movRepo.create({
      customer: { id } as any,
      type,
      amount: signed,
      reason: reason ?? null,
    });
    await this.movRepo.save(mov);

    return c;
  }

  /**
   * ⭐ Ahora los “movements” salen del LEDGER como fuente de verdad.
   * Mapeo:
   *  - order       => type: 'charge'  (aumenta deuda)   amount > 0
   *  - payment     => type: 'payment' (disminuye deuda) amount < 0
   *  - credit_note => type: 'payment' (disminuye deuda) amount < 0
   */
  async listMovements(id: string) {
    await this.findOne(id);

    const res = await this.ledger.list({
      customerId: id,
      page: 1,
      pageSize: 200, // suficiente para vista; ajustá si necesitás paginar
    });

    const mapType = (t: string) => (t === 'order' ? 'charge' : 'payment');

    // Devolvemos en la forma { id, createdAt, updatedAt, type, amount, reason }
    // para no romper el front que ya consume /customers/:id/movements
    return res.items.map((it: any) => ({
      id: it.id,
      createdAt: it.date,
      updatedAt: it.updatedAt ?? null,
      type: mapType(it.type),
      amount: Number(it.amount),
      reason: it.description ?? null,
    }));
  }

  // === Stats de pedidos por cliente ===
  async stats(id: string) {
    await this.findOne(id);

    // COUNT(*)
    const raw = await this.orderRepo
      .createQueryBuilder('o')
      .where('o.customer_id = :id', { id })
      .select('COUNT(*)', 'cnt')
      .getRawOne<{ cnt: string }>();

    const orderCount = Number(raw?.cnt ?? 0);

    // Último pedido por fecha de creación
    const last = await this.orderRepo
      .createQueryBuilder('o')
      .where('o.customer_id = :id', { id })
      .orderBy('o.createdAt', 'DESC')
      .select(['o.id', 'o.createdAt'])
      .getOne();

    return {
      orderCount,
      lastOrderDate: last?.createdAt ?? null,
    };
  }
}
