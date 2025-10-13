import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, MoreThanOrEqual, Repository } from 'typeorm';
import { CashMovement, CashSession, MovementKind } from './cash.entity';
import { LedgerService } from '../ledger/ledger.service';
import { Product } from '../products/product.entity';
import { CheckoutDto } from './dto';

// === Helpers de fecha ===
function startOfDay(d = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d = new Date()): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
function startOfToday(): Date {
  return startOfDay(new Date());
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
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    private readonly ledger: LedgerService,
  ) {}

  // ======== Sesión del día ========
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
    const sess = this.sessionRepo.create({
      date: startOfToday() as any,
      openingAmount: 0,
      closingAmount: 0,
      isOpen: false,
    } as Partial<CashSession>);
    return this.sessionRepo.save(sess);
  }

  /** Movimientos de HOY (ordenados por occurredAt ?? createdAt) */
  private async getTodaysMovements(): Promise<CashMovement[]> {
    const since = startOfToday();
    const until = startOfTomorrow();

    const movs = await this.movRepo.find({
      where: { createdAt: Between(since, until) as any },
      order: { createdAt: 'ASC' },
    });

    return movs.sort((a, b) => {
      const ta = (a.occurredAt ?? a.createdAt).getTime();
      const tb = (b.occurredAt ?? b.createdAt).getTime();
      return ta - tb;
    });
  }

  // ======== Resumen/KPIs ========
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

  /** Historial últimos N días (no agrupado) */
  async getHistory(days = 7) {
    const since = daysAgo(Math.max(0, Number(days) || 7));
    const rows = await this.movRepo.find({
      where: { createdAt: MoreThanOrEqual(since) as any },
      order: { createdAt: 'ASC' },
    });
    return rows
      .map((m) => ({ ...m, when: (m.occurredAt ?? m.createdAt) }))
      .sort((a, b) => a.when.getTime() - b.when.getTime());
  }

  /** Agrupado por día (para HistorySection) */
  async getDaily(days = 30) {
    const since = daysAgo(Math.max(0, Number(days) || 30));
    const sessions = await this.sessionRepo.find({
      where: { createdAt: MoreThanOrEqual(since) as any },
      order: { createdAt: 'ASC' },
    });
    const movements = await this.movRepo.find({
      where: { createdAt: MoreThanOrEqual(since) as any },
      order: { createdAt: 'ASC' },
    });

    const map = new Map<string, {
      date: string;
      openingAmount: number;
      closingAmount: number;
      isOpen: boolean;
      income: number;
      expense: number;
      salesCash: number;
      salesNonCash: number;
      details: Array<{
        id: string;
        type: MovementKind | 'open' | 'close';
        description: string;
        amount: number;
        createdAt: string;
        occurredAt?: string | null;
      }>;
    }>();

    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    // Base por días
    for (let i = 0; i <= days; i++) {
      const day = new Date();
      day.setDate(day.getDate() - i);
      const key = fmt(day);
      map.set(key, {
        date: key,
        openingAmount: 0,
        closingAmount: 0,
        isOpen: false,
        income: 0,
        expense: 0,
        salesCash: 0,
        salesNonCash: 0,
        details: [],
      });
    }

    // Sesiones
    for (const s of sessions) {
      const key = fmt(s.createdAt);
      const row = map.get(key);
      if (!row) continue;
      row.openingAmount = Number(s.openingAmount || 0);
      row.closingAmount = Number(s.closingAmount || 0);
      row.isOpen = !!s.isOpen;

      // Detalles sintéticos
      row.details.push({
        id: `open-${s.id}`,
        type: 'open',
        description: 'Apertura de caja',
        amount: row.openingAmount,
        createdAt: s.createdAt.toISOString(),
        occurredAt: s.createdAt.toISOString(),
      });
      if (!s.isOpen) {
        row.details.push({
          id: `close-${s.id}`,
          type: 'close',
          description: 'Cierre de caja',
          amount: row.closingAmount,
          createdAt: s.updatedAt.toISOString(),
          occurredAt: s.updatedAt.toISOString(),
        });
      }
    }

    // Movimientos
    for (const m of movements) {
      const key = fmt(m.createdAt);
      const row = map.get(key);
      if (!row) continue;

      if (m.type === 'income') row.income += Number(m.amount || 0);
      else if (m.type === 'expense') row.expense += Math.abs(Number(m.amount || 0));
      else if (m.type === 'sale') row.salesCash += Number(m.amount || 0);

      row.details.push({
        id: m.id,
        type: m.type,
        description: m.description || '',
        amount: Number(m.amount || 0),
        createdAt: m.createdAt.toISOString(),
        occurredAt: m.occurredAt?.toISOString() ?? null,
      });
    }

    // Ordenar por fecha DESC
    return Array.from(map.values()).sort((a, b) => (a.date < b.date ? 1 : -1));
  }

  // ======== Operaciones de caja ========
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

    // Si en algún momento querés impactar en ledger, acá sería el lugar.
    return saved;
  }

  /** Usado por pedidos legacy (si lo tuvieras en otro módulo) */
  async registerSale(total: number, description: string) {
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

  // ======== Checkout POS ========
  async checkout(dto: CheckoutDto) {
    // 1) caja abierta
    const sess = await this.getTodaySession();
    if (!sess || !sess.isOpen) {
      throw new BadRequestException('No hay una caja abierta.');
    }

    // 2) totales
    const items = dto.items || [];
    if (!items.length) throw new BadRequestException('La venta no tiene ítems.');
    const payments = dto.payments || [];
    if (!payments.length) throw new BadRequestException('Faltan pagos.');

    // Traer productos
    const productIds = Array.from(new Set(items.map(i => i.productId)));
    const products = await this.productRepo.findByIds(productIds as any);
    const mapProd = new Map(products.map(p => [p.id, p]));

    let subtotal = 0;
    for (const it of items) {
      const p = mapProd.get(it.productId);
      if (!p) throw new NotFoundException(`Producto ${it.productId} no encontrado`);
      const unit = (typeof it.price === 'number' ? it.price : Number(p.price || 0));
      const disc = Math.max(0, Number(it.discount || 0)); // abs por unidad
      const line = Math.max(0, unit - disc) * Math.max(1, Math.floor(it.qty));
      subtotal += line;
    }

    const discountGlobal = Math.max(0, Number(dto.discountGlobal || 0));
    const total = Math.max(0, subtotal - discountGlobal);

    const cashAmount = payments
      .filter(p => p.method === 'cash')
      .reduce((a, b) => a + Math.max(0, Number(b.amount || 0)), 0);
    const nonCashAmount = payments
      .filter(p => p.method !== 'cash')
      .reduce((a, b) => a + Math.max(0, Number(b.amount || 0)), 0);
    const paid = cashAmount + nonCashAmount;

    if (paid + 1e-6 < total) {
      throw new BadRequestException('Los pagos no cubren el total.');
    }

    // 3) stock
    for (const it of items) {
      const p = mapProd.get(it.productId)!; // seguro no null por validación arriba
      const qty = Math.max(1, Math.floor(it.qty));
      const newStock = Math.max(0, Number(p.stock || 0) - qty);
      p.stock = newStock;
      await this.productRepo.save(p);
    }

    // 4) registrar cash movement SOLO por efectivo
    if (cashAmount > 0) {
      const mov = this.movRepo.create({
        amount: cashAmount,
        type: 'sale',
        description: dto.notes || 'Venta (POS)',
        occurredAt: new Date(),
        sessionId: sess.id,
        session: sess,
      } as Partial<CashMovement>);
      await this.movRepo.save(mov);
    }

    // 5) retorno (estructura mínima para front)
    return {
      id: cryptoRandomId(),
      number: null,
      total,
      cash: cashAmount,
      nonCash: nonCashAmount,
      paid,
      change: Math.max(0, paid - total),
      items: dto.items,
      payments: dto.payments,
      notes: dto.notes || null,
      createdAt: new Date().toISOString(),
    };
  }

  // ======== Estado ========
  async isOpen(): Promise<boolean> {
    const sess = await this.getTodaySession();
    return !!sess?.isOpen;
  }
}

// id chiquito “suficiente” para POS
function cryptoRandomId() {
  return 'sale_' + Math.random().toString(36).slice(2, 10);
}
