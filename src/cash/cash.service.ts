import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, MoreThanOrEqual, Repository } from 'typeorm';
import { CashMovement, CashSession, MovementKind } from './cash.entity';
import { LedgerService } from '../ledger/ledger.service';
import { Product } from '../products/product.entity'; // para actualizar stock en checkout

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

type CheckoutItem = { productId: string; qty: number; price?: number; discount?: number };
type CheckoutPayment = { method: 'cash'|'debit'|'credit'|'transfer'; amount: number };
type CheckoutDto = {
  items: CheckoutItem[];
  payments: CheckoutPayment[];
  discountGlobal?: number;
  notes?: string;
  customerId?: string | null;
};

@Injectable()
export class CashService {
  constructor(
    @InjectRepository(CashMovement)
    private readonly movRepo: Repository<CashMovement>,
    @InjectRepository(CashSession)
    private readonly sessionRepo: Repository<CashSession>,
    @InjectRepository(Product)
    private readonly prodRepo: Repository<Product>,
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

  /** Registra un movimiento genérico (incluye open/close/sale/income/expense) */
  private async registerMovement(
    sess: CashSession,
    type: MovementKind | 'open' | 'close',
    amount: number,
    description: string,
  ) {
    const mov = this.movRepo.create({
      amount: Number(amount || 0),
      type: type as any,          // la columna es varchar; TS permite extender aquí
      description,
      occurredAt: new Date(),
      sessionId: sess.id,
      session: sess,
    } as Partial<CashMovement>);
    return this.movRepo.save(mov);
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

  /** Historial últimos N días (default 7) */
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

  // ===== Operaciones caja =====
  async open(amount: number) {
    const sess = await this.getOrCreateTodaySession();
    if (sess.isOpen) throw new BadRequestException('La caja ya está abierta');

    sess.openingAmount = Number(amount || 0);
    sess.closingAmount = 0;
    sess.isOpen = true;
    await this.sessionRepo.save(sess);

    // Movimiento de apertura (amount = contado de apertura)
    await this.registerMovement(sess, 'open', sess.openingAmount, 'Apertura de caja');
    return this.getCurrent();
  }

  /** ✅ CIERRA caja registrando:
   *  - amount = monto contado (closingAmount)
   *  - description = snapshot con apertura/ventas/ingresos/egresos/saldo calculado
   */
  async close(amount: number) {
    const sess = await this.getTodaySession();
    if (!sess || !sess.isOpen) throw new BadRequestException('No hay caja abierta para cerrar');

    // 1) Guardamos el contado
    sess.closingAmount = Number(amount || 0);
    sess.isOpen = false;
    await this.sessionRepo.save(sess);

    // 2) Snapshot de estado al momento del cierre
    const cur = await this.getCurrent();
    const {
      openingAmount,
      totalIncome,
      totalExpense,
      totalSales,
      balance,
    } = cur;

    // 3) Movimiento de cierre con descripción auditable
    const desc =
      `Cierre de caja — Contado: $${sess.closingAmount.toFixed(2)} | ` +
      `Apertura: $${openingAmount.toFixed(2)} | ` +
      `Ventas: $${totalSales.toFixed(2)} | ` +
      `Ingresos: $${totalIncome.toFixed(2)} | ` +
      `Egresos: $${totalExpense.toFixed(2)} | ` +
      `Saldo calculado: $${balance.toFixed(2)}`;

    await this.registerMovement(sess, 'close', sess.closingAmount, desc);

    // 4) Devolvemos estado
    return this.getCurrent();
  }

  /** Movimiento manual (ingreso/egreso/sale) */
  async movement(body: { amount: number; type: MovementKind; description: string; customerId?: string }) {
    if (typeof body?.amount !== 'number') throw new BadRequestException('Monto inválido');
    if (!body?.type || !['income', 'expense', 'sale'].includes(body.type))
      throw new BadRequestException('Tipo inválido (usa income | expense | sale)');

    const sess = await this.getOrCreateTodaySession();
    let amount = Number(body.amount);
    if (body.type === 'expense') amount = -Math.abs(amount);

    const saved = await this.registerMovement(sess, body.type, amount, body.description ?? '');

    // Si es un ingreso asociado a un cliente => registrar pago (negativo) en la cuenta corriente
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

  /** Egreso por devolución en efectivo */
  async registerRefund(amount: number, description: string) {
    const val = Math.abs(Number(amount || 0));
    if (val <= 0) throw new BadRequestException('Monto de devolución inválido');
    return this.movement({
      amount: val,                // movement pondrá negativo si corresponde
      type: 'expense',
      description: description ?? 'Devolución en efectivo',
    });
  }

  /** Registrar venta en caja (cuando viene de otra parte del sistema) */
  async registerSale(total: number, description: string) {
    if (typeof total !== 'number' || total <= 0) {
      throw new BadRequestException('Total de venta inválido');
    }
    const sess = await this.getOrCreateTodaySession();
    return this.registerMovement(sess, 'sale', Math.abs(Number(total)), description ?? 'Venta');
  }

  async isOpen(): Promise<boolean> {
    const sess = await this.getTodaySession();
    return !!sess?.isOpen;
  }

  // ===== Checkout (venta rápida desde Caja) =====
  async checkout(dto: CheckoutDto) {
    if (!dto?.items?.length) throw new BadRequestException('No hay ítems en la venta');
    if (!dto?.payments?.length) throw new BadRequestException('No hay pagos');

    const sess = await this.getTodaySession();
    if (!sess || !sess.isOpen) throw new BadRequestException('La caja está cerrada');

    // Traer productos
    const ids = dto.items.map(i => i.productId);
    const prods = await this.prodRepo.find({ where: { id: In(ids) } });
    const map = new Map(prods.map(p => [p.id, p]));

    // Calcular total y validar stock
    let subtotal = 0;
    for (const it of dto.items) {
      if (!it.productId || !Number.isFinite(it.qty) || it.qty <= 0) {
        throw new BadRequestException('Ítem inválido');
      }
      const p = map.get(it.productId);
      if (!p) throw new BadRequestException('Producto no encontrado');

      const available = Math.max(0, Number(p.stock ?? 0) - Number(p.reserved ?? 0));
      if (available < it.qty) {
        throw new BadRequestException(`Sin stock suficiente de "${p.name}" (disp: ${available})`);
      }

      const unit = Number.isFinite(it.price) ? Number(it.price) : Number(p.price ?? 0);
      const disc = Math.max(0, Number(it.discount ?? 0));
      const line = Math.max(0, unit - disc) * Math.floor(it.qty);
      subtotal += line;
    }

    const discGlobal = Math.max(0, Number(dto.discountGlobal ?? 0));
    const total = Math.max(0, subtotal - discGlobal);
    const paid = dto.payments.reduce((a, b) => a + Math.max(0, Number(b.amount || 0)), 0);

    if (total > 0 && paid + 1e-6 < total) {
      throw new BadRequestException('Pagos insuficientes para cubrir el total');
    }

    // Descontar stock
    for (const it of dto.items) {
      const p = map.get(it.productId)!; // ya validado
      p.stock = Math.max(0, Number(p.stock || 0) - Math.floor(it.qty));
      await this.prodRepo.save(p);
    }

    // Registrar venta en caja
    const mov = await this.registerSale(total, dto.notes || 'Venta caja');

    // Si hay cliente y pagos, asentamos pago en ledger (negativo)
    if (dto.customerId && paid > 0) {
      await this.ledger.record({
        customerId: dto.customerId,
        type: 'payment',
        sourceType: 'payment',
        sourceId: mov.id,
        amount: -Math.abs(paid),
        description: dto.notes || 'Pago de venta',
      });
    }

    const change = Math.max(0, paid - total);

    return {
      id: mov.id,
      number: mov.id.slice(0, 8).toUpperCase(),
      total,
      subtotal,
      discountGlobal: discGlobal,
      paid,
      change,
      itemsCount: dto.items.length,
      payments: dto.payments,
      notes: dto.notes ?? '',
      createdAt: mov.createdAt,
    };
  }
}
