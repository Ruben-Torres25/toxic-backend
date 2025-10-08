import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual } from 'typeorm';
import { CashMovement, CashSession, MovementKind } from './cash.entity';
import { LedgerService } from '../ledger/ledger.service';

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
function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

@Injectable()
export class CashService {
  constructor(
    @InjectRepository(CashMovement)
    private readonly movRepo: Repository<CashMovement>,
    @InjectRepository(CashSession)
    private readonly sessionRepo: Repository<CashSession>,
    private readonly ledger: LedgerService,
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

  /** Movimientos de HOY (usa occurredAt si existe, sino createdAt) */
  private async getTodaysMovements(): Promise<CashMovement[]> {
    const since = startOfToday();
    const until = startOfTomorrow();

    // Consulta por createdAt (siempre existe)
    const movs = await this.movRepo.find({
      where: { createdAt: Between(since, until) as any },
      order: { createdAt: 'ASC' },
    });

    // Ordená usando occurredAt ?? createdAt para consistencia
    return movs.sort((a, b) => {
      const ta = (a.occurredAt ?? a.createdAt).getTime();
      const tb = (b.occurredAt ?? b.createdAt).getTime();
      return ta - tb;
    });
    // Nota: si querés filtrar estrictamente por occurredAt, podés duplicar la consulta.
  }

  // ===== KPIs / Resumen =====
  async getCurrent() {
    const since = startOfToday();
    const sess = await this.getTodaySession();
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

  /** Historial últimos N días (default 7). No limita por sesión. */
  async getHistory(days = 7) {
    const since = daysAgo(Math.max(0, Number(days) || 7));
    const rows = await this.movRepo.find({
      where: { createdAt: MoreThanOrEqual(since) as any },
      order: { createdAt: 'ASC' },
    });
    return rows
      .map((m) => ({
        ...m,
        when: (m.occurredAt ?? m.createdAt),
      }))
      .sort((a, b) => a.when.getTime() - b.when.getTime());
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

  async movement(body: { amount: number; type: MovementKind; description: string; customerId?: string }) {
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
    const saved = await this.movRepo.save(mov);

    // Si es ingreso vinculado a cliente → registrar PAGO (negativo) en ledger
    if (body.type === 'income' && body.customerId) {
      await this.ledger.record({
        customerId: body.customerId,
        type: 'payment',
        sourceType: 'payment',
        sourceId: saved.id,
        amount: -Math.abs(Number(body.amount)),
        description: body.description || 'Pago',
      });
    }

    return saved;
  }

  /** 👇 NUEVO: egreso por devolución en efectivo (NC) */
  async registerRefund(amount: number, description: string) {
    const val = Math.abs(Number(amount || 0));
    if (val <= 0) throw new BadRequestException('Monto de devolución inválido');
    return this.movement({
      amount: val,                // movement pondrá negativo para expense
      type: 'expense',
      description: description ?? 'Devolución en efectivo',
    });
  }

  // Usado por OrdersService (venta)
  async registerSale(total: number, description: string) {
    if (typeof total !== 'number' || total <= 0) {
      throw new BadRequestException('Total de venta inválido');
    }
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
