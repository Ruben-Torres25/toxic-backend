import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from './customer.entity';
import { CustomerMovement, MovementType } from './customer-movement.entity';
import { CreateCustomerDto, UpdateCustomerDto } from './dto';
import { Order } from '../orders/order.entity'; // IMPORT RELATIVO

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer) private readonly repo: Repository<Customer>,
    @InjectRepository(CustomerMovement) private readonly movRepo: Repository<CustomerMovement>,
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
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

  // amount: +pago, -deuda, 0=ajuste
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

  async listMovements(id: string) {
    await this.findOne(id);
    return this.movRepo.find({
      where: { customer: { id } },
      order: { createdAt: 'DESC' },
    });
  }

  // === Stats de pedidos por cliente ===
  // === Stats de pedidos por cliente ===
async stats(id: string) {
  await this.findOne(id);

  // COUNT(*)
  const raw = await this.orderRepo
    .createQueryBuilder('o')
    .where('o.customer_id = :id', { id })
    .select('COUNT(*)', 'cnt')
    .getRawOne<{ cnt: string }>(); // <- puede ser undefined

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
