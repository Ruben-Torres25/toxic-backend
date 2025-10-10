import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, Between, MoreThanOrEqual } from 'typeorm';
import { CashMovement, CashSession, MovementKind } from './cash.entity';
import { LedgerService } from '../ledger/ledger.service';
import { CheckoutDto } from './dto';
import { Product } from '../products/product.entity';

// ---- helpers de fechas
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

    @InjectRepository(Product)
    private readonly prodRepo: Repository<Product>,

    private readonly ledger: LedgerService,

    private readonly ds: DataSource,
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
        when: m.occurredAt ?? m.createdAt,
      }))
      .sort((a, b) => a.when.getTime() - b.when.getTime());
  }

  // ===== Operaciones de caja =====
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

    // Asiento de ledger solo para pagos (ya lo tenías y matchea tus tipos)
    if (body.type === 'income' && body.customerId) {
      await this.ledger.record({
        customerId: body.customerId,
        type: 'payment',          // <= válido en tu LedgerType
        sourceType: 'payment',    // <= válido en tu LedgerSourceType
        sourceId: saved.id,
        amount: -Math.abs(Number(body.amount)),
        description: body.description || 'Pago',
      });
    }

    return saved;
  }

  /** Egreso por devolución en efectivo (NC) */
  async registerRefund(amount: number, description: string) {
    const val = Math.abs(Number(amount || 0));
    if (val <= 0) throw new BadRequestException('Monto de devolución inválido');
    return this.movement({
      amount: val, // movement pondrá negativo para expense
      type: 'expense',
      description: description ?? 'Devolución en efectivo',
    });
  }

  // Usado por checkout (venta)
  async registerSale(total: number, description: string, sessionId?: string) {
    if (typeof total !== 'number' || total <= 0) {
      throw new BadRequestException('Total de venta inválido');
    }

    let sess: CashSession | null;
    if (sessionId) {
      sess = await this.sessionRepo.findOne({ where: { id: sessionId } });
      if (!sess) {
        throw new NotFoundException('Sesión de caja no encontrada');
      }
    } else {
      sess = await this.getOrCreateTodaySession();
    }

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

  // ====== CHECKOUT POS ======
  async checkout(body: CheckoutDto) {
    const session = await this.getOrCreateTodaySession();
    if (!session?.isOpen) throw new BadRequestException('La caja está cerrada');
    if (!body?.items?.length) throw new BadRequestException('Carrito vacío');

    const items = body.items.map((it) => ({
      productId: String(it.productId),
      qty: Math.max(1, Math.floor(Number(it.qty || 0))),
      price: Number.isFinite(Number(it.price)) ? Number(it.price) : undefined,
      discount: Number.isFinite(Number(it.discount)) ? Number(it.discount) : 0,
    }));

    const discountGlobal = Math.max(0, Number(body.discountGlobal || 0));
    const payments = (body.payments || []).map((p) => ({
      method: p.method,
      amount: Math.max(0, Number(p.amount || 0)),
    }));

    return this.ds.transaction(async (trx) => {
      let subtotal = 0;

      // 1) Validar stock + calcular subtotal
      for (const it of items) {
        const p = await trx.getRepository(Product).findOne({ where: { id: it.productId } });
        if (!p) throw new BadRequestException(`Producto ${it.productId} no encontrado`);

        const available = Math.max(0, Number(p.stock || 0) - Number(p.reserved || 0));
        if (it.qty > available) {
          throw new BadRequestException(`Stock insuficiente para ${p.name} (${p.sku}). Disponible: ${available}`);
        }

        const unit = Number.isFinite(Number(it.price)) ? Number(it.price) : Number(p.price || 0);
        const disc = Math.max(0, Number(it.discount || 0));
        if (disc > unit) {
          throw new BadRequestException(`Descuento por unidad excede el precio en ${p.name}`);
        }

        subtotal += (unit - disc) * it.qty;
      }

      const total = Math.max(0, subtotal - discountGlobal);
      const paid = payments.reduce((a, b) => a + b.amount, 0);
      if (paid < total) throw new BadRequestException('Los pagos no cubren el total');

      // 2) Descontar stock (null-safe)
      for (const it of items) {
        const repo = trx.getRepository(Product);
        const found = await repo.findOne({ where: { id: it.productId } });
        if (!found) {
          throw new BadRequestException(`Producto ${it.productId} no encontrado`);
        }
        const p: Product = found; // ahora p es Product, no null
        p.stock = Math.max(0, Number(p.stock || 0) - it.qty);
        await repo.save(p);
      }

      // 3) Registrar movimiento de venta en la MISMA sesión
      const desc =
        body?.notes?.trim()
          ? `Venta POS: ${items.length} ítems • ${body.notes.trim()}`
          : `Venta POS: ${items.length} ítems`;

      const mov = trx.getRepository(CashMovement).create({
        amount: total,
        type: 'sale',
        description: desc,
        occurredAt: new Date(),
        sessionId: session.id,
        session,
      } as Partial<CashMovement>);
      const saved = await trx.getRepository(CashMovement).save(mov);

      // 🔒 IMPORTANTE:
      // Quitamos el asiento a Ledger en ventas para evitar errores de tipos.
      // Si querés registrarlo también en Ledger, pasame los enums válidos (LedgerType/LedgerSourceType)
      // y lo reactivamos con tipos correctos.

      return {
        id: saved.id,
        createdAt: saved.createdAt,
        subtotal,
        discountGlobal,
        total,
        payments,
        items: items.map((i) => ({ productId: i.productId, qty: i.qty })),
      };
    });
  }
}
