import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { CreateCreditNoteDto, CreditNoteDTO } from './dto';
import { Order, OrderItem } from '../orders/order.entity';
import { Product } from '../products/product.entity';
import { LedgerService } from '../ledger/ledger.service';
import { CashService } from '../cash/cash.service';

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

@Injectable()
export class CreditNotesService {
  constructor(
    private readonly ds: DataSource,
    private readonly ledger: LedgerService,
    private readonly cash: CashService,
  ) {}

  async create(dto: CreateCreditNoteDto): Promise<CreditNoteDTO> {
    if (!dto?.orderId) throw new BadRequestException('orderId requerido');
    if (!dto.items?.length) throw new BadRequestException('Debe indicar al menos un ítem en la nota de crédito.');

    return await this.ds.transaction(async (trx) => {
      const orderRepo = trx.getRepository(Order);
      const itemRepo  = trx.getRepository(OrderItem);
      const prodRepo  = trx.getRepository(Product);

      // 1) Lock del pedido
      const order = await orderRepo
        .createQueryBuilder('o')
        .where('o.id = :id', { id: dto.orderId })
        .setLock('pessimistic_write')
        .getOne();
      if (!order) throw new NotFoundException('Pedido no encontrado.');
      if (order.status === 'canceled') throw new BadRequestException('No se puede devolver un pedido cancelado');

      // 2) Ítems del pedido
      const items = await itemRepo.find({ where: { orderId: order.id } });
      if (!items.length) throw new BadRequestException('El pedido no tiene ítems.');
      const byProductId = new Map(items.map((it) => [String(it.productId), it]));

      // También bloqueamos productos involucrados para evitar carreras de stock
      const prodIds = dto.items.map(i => String(i.productId)).filter(Boolean);
      const prods   = await prodRepo.find({ where: { id: In(prodIds) }, lock: { mode: 'pessimistic_write' } });
      const prodMap = new Map(prods.map(p => [String(p.id), p]));

      // 3) Totales + efectos (stock + returnedQty)
      let subtotal = 0, iva = 0, total = 0;

      for (const it of dto.items) {
        const src = byProductId.get(String(it.productId));
        if (!src) continue;

        const rate = Number.isFinite(it.taxRate ?? 0.21) ? (it.taxRate ?? 0.21) : 0.21;
        const alreadyReturned = src.returnedQty ?? 0;
        const maxDevolvible  = Math.max(0, src.quantity - alreadyReturned);
        const qty            = Math.min(Math.max(0, Math.floor(it.quantity ?? 0)), maxDevolvible);
        if (qty <= 0) continue;

        const base      = r2(Number(it.unitPrice) * qty - Number(it.discount ?? 0));
        const lineIva   = r2(base * rate);
        const lineTotal = r2(base + lineIva);
        subtotal += base; iva += lineIva; total += lineTotal;

        // +stock físico
        await prodRepo.increment({ id: String(it.productId) }, 'stock', qty);

        // marcar devolución en el ítem
        const newReturned = alreadyReturned + qty;
        await itemRepo.update({ id: src.id }, { returnedQty: newReturned });
        src.returnedQty = newReturned;
      }

      subtotal = r2(subtotal); iva = r2(iva); total = r2(total);
      if (total <= 0) throw new BadRequestException('La nota de crédito no tiene monto (cantidades = 0)');

      // 4) Estado del pedido
      const allReturned  = items.every((it) => (it.returnedQty ?? 0) >= it.quantity);
      const someReturned = items.some((it) => (it.returnedQty ?? 0) > 0);

      type Status = 'pending' | 'confirmed' | 'canceled' | 'partially_returned' | 'returned';
      let newStatus: Status = order.status as Status;
      if (allReturned) newStatus = 'returned';
      else if (someReturned) newStatus = 'partially_returned';

      if (newStatus !== (order.status as Status)) {
        await orderRepo.update({ id: order.id }, { status: newStatus });
      }

      // 5) Asiento en ledger (NEGATIVO)
      const creditNoteId = uuidv4(); // ID trazable para NC "virtual"
      await this.ledger.record({
        trx,
        customerId: (order as any).customerId ?? dto.customerId ?? null,
        type: 'credit_note',
        sourceType: 'credit_note',
        sourceId: creditNoteId,
        amount: -Math.abs(total),
        description: `NC sobre pedido ${order.code ?? order.id}${dto.reason ? ` - ${dto.reason}` : ''}`,
      });

      // 6) Si es CASH → egreso en caja (NO usar trx: CashService persiste fuera)
      if (dto.refundMethod === 'cash') {
        // Registramos un movimiento de caja NEGATIVO (expense)
        await this.cash.movement({
          amount: total, // movement() hace -abs para expense
          type: 'expense',
          description: `Devolución NC ${creditNoteId} (pedido ${order.code ?? order.id})`,
          customerId: (order as any).customerId ?? dto.customerId ?? undefined,
        });
      }

      // 7) Respuesta al front (convención en negativo)
      return {
        id: creditNoteId,
        number: null,
        subtotal: -subtotal,
        iva: -iva,
        total: -total,
        status: 'created',
        createdAt: new Date().toISOString(),
      };
    });
  }
}
