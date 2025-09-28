import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { CashMovement, CashSession, MovementKind } from './cash.entity';

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function startOfTomorrow(): Date {
  const d = startOfToday();
  d.setDate(d.getDate() + 1);
  return d;
}

@Injectable()
export class CashService {
  constructor(
    @InjectRepository(CashMovement)
    private readonly movRepo: Repository<CashMovement>,
    @InjectRepository(CashSession)
    private readonly sessionRepo: Repository<CashSession>,
  ) {}

  // ===== Helpers =====
  private async getTodaySession(): Promise<CashSession | null> {
    const since = startOfToday();
    const until = startOfTomorrow();
    return this.sessionRepo.findOne({
      where: { createdAt: Between(since, until) as any },
      order: { createdAt: 'DESC' },
    });
  }

  private async getOrCreateTodaySession(): Promise<CashSession> {
    const existing = await this.getTodaySession();
    if (existing) return existing;

    const since = startOfToday();
    const sess = this.sessionRepo.create({
      date: since as any,
      openingAmount: 0,
      closingAmount: 0,
      isOpen: false,
    } as Partial<CashSession>);
    return this.sessionRepo.save(sess);
  }

  private async getTodaysMovements(): Promise<CashMovement[]> {
    const since = startOfToday();
    const until = startOfTomorrow();
    return this.movRepo.find({
      where: { createdAt: Between(since, until) as any },
      order: { createdAt: 'ASC' },
    });
  }

  // ===== KPIs / Resumen =====
  async getCurrent() {
    const since = startOfToday();
    const sess = await this.getTodaySession(); // puede ser null
    const movs = await this.getTodaysMovements();

    let totalIncome = 0;
    let totalExpense = 0;
    let totalSales = 0;

    for (const m of movs) {
      if (m.type === 'income') totalIncome += Number(m.amount);
      else if (m.type === 'expense') totalExpense += Math.abs(Number(m.amount));
      else if (m.type === 'sale') totalSales += Number(m.amount);
    }

    const openingAmount = Number(sess?.openingAmount ?? 0);
    const closingAmount = Number(sess?.closingAmount ?? 0);
    const balance = openingAmount + totalIncome - totalExpense + totalSales;
    const isOpen = !!sess?.isOpen;

    return {
      date: since.toISOString().split('T')[0],
      openingAmount,
      closingAmount,
      totalIncome,
      totalExpense,
      totalSales,
      balance,
      movements: movs,
      isOpen,
    };
  }

  async getMovements() {
    return this.getTodaysMovements();
  }

  // ===== Operaciones =====
  async open(amount: number) {
    const sess = await this.getOrCreateTodaySession();
    if (sess.isOpen) throw new BadRequestException('La caja ya está abierta');

    sess.openingAmount = Number(amount || 0);
    sess.closingAmount = 0;
    sess.isOpen = true;
    await this.sessionRepo.save(sess);

    return this.getCurrent();
  }

  async close(amount: number) {
    const sess = await this.getTodaySession();
    if (!sess || !sess.isOpen) throw new BadRequestException('No hay caja abierta para cerrar');

    sess.closingAmount = Number(amount || 0);
    sess.isOpen = false;
    await this.sessionRepo.save(sess);

    return this.getCurrent();
  }

  async movement(body: { amount: number; type: MovementKind; description: string }) {
    if (typeof body?.amount !== 'number') throw new BadRequestException('Monto inválido');
    if (!body?.type || !['income', 'expense', 'sale'].includes(body.type))
      throw new BadRequestException('Tipo inválido (usa income | expense | sale)');

    const sess = await this.getOrCreateTodaySession();
    let amount = Math.abs(Number(body.amount));
    if (body.type === 'expense') amount = -amount;

    const mov = this.movRepo.create({
      amount,
      type: body.type,
      description: body.description ?? '',
      occurredAt: new Date(),
      sessionId: sess.id,
      session: sess,
    } as Partial<CashMovement>);
    return this.movRepo.save(mov);
  }

  // Usado por OrdersService
  async registerSale(total: number, description: string) {
    if (typeof total !== 'number' || total <= 0) {
      throw new BadRequestException('Total de venta inválido');
    }
    // Si llegaste acá sin caja abierta, igual registramos en la sesión del día (o la creamos).
    const sess = await this.getOrCreateTodaySession();

    const mov = this.movRepo.create({
      amount: Math.abs(Number(total)),
      type: 'sale',
      description: description ?? 'Venta',
      occurredAt: new Date(),
      sessionId: sess.id,
      session: sess,
    } as Partial<CashMovement>);
    return this.movRepo.save(mov);
  }

  // ===== Estado =====
  async isOpen(): Promise<boolean> {
    const sess = await this.getTodaySession();
    return !!sess?.isOpen;
  }
}
