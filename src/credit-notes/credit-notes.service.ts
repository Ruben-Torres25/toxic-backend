import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { CreateCreditNoteDto, CreditNoteDTO } from './dto';
import { Order, OrderItem } from '../orders/order.entity';
import { Product } from '../products/product.entity';
import { LedgerService } from '../ledger/ledger.service';
import { CashService } from '../cash/cash.service';

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const isUuid = (v: any) =>
  typeof v === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

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
      const orderItems = await itemRepo.find({ where: { orderId: order.id } });
      if (!orderItems.length) throw new BadRequestException('El pedido no tiene ítems.');

      const byItemId    = new Map(orderItems.map((it) => [String(it.id), it]));
      const byProductId = new Map(
        orderItems
          .filter((it) => isUuid(String(it.productId))) // sólo productId válidos (evita «uuid: undefined»)
          .map((it) => [String(it.productId), it]),
      );

      // 3) Normalizar entrada (admite orderItemId o productId)
      type NormItem = {
        orderItemId?: string;
        productId?: string;
        unitPrice: number;
        quantity: number;
        discount: number;
        taxRate?: number;
      };

      const normalized: NormItem[] = [];
      for (const raw of dto.items as any[]) {
        let orderItemId: string | undefined;
        let productId: string | undefined;
        let unitPrice = 0;
        let quantity  = 0;
        let discount  = 0;
        let taxRate: number | undefined = raw?.taxRate;

        if (raw?.orderItemId) {
          const src = byItemId.get(String(raw.orderItemId));
          if (!src) continue;
          orderItemId = String(src.id);
          productId   = isUuid(String(src.productId)) ? String(src.productId) : undefined;
          unitPrice   = Number.isFinite(raw?.unitPrice) ? Number(raw.unitPrice) : Number(src.unitPrice ?? 0);
          quantity    = Number.isFinite(raw?.quantity)  ? Number(raw.quantity)  : 1;
          discount    = Number.isFinite(raw?.discount)  ? Number(raw.discount)  : 0;
        } else if (raw?.productId) {
          productId = String(raw.productId);
          unitPrice = Number(raw.unitPrice ?? 0);
          quantity  = Number(raw.quantity ?? 0);
          discount  = Number(raw.discount ?? 0);
        }

        const qty = Math.max(0, Math.floor(quantity));
        if ((orderItemId || productId) && qty > 0) {
          normalized.push({
            orderItemId,
            productId,
            unitPrice,
            quantity: qty,
            discount,
            taxRate: Number.isFinite(taxRate) ? taxRate : undefined,
          });
        }
      }
      if (!normalized.length) throw new BadRequestException('La nota de crédito no tiene ítems válidos.');

      // 4) Bloquear productos sólo si son UUID válidos
      const prodIds = Array.from(new Set(normalized.map(i => i.productId).filter((id): id is string => isUuid(id!))));
      const prods   = prodIds.length
        ? await prodRepo.find({ where: { id: In(prodIds) }, lock: { mode: 'pessimistic_write' } })
        : [];
      const prodMap = new Map(prods.map(p => [String(p.id), p]));

      // 5) Totales + efectos
      let subtotal = 0, iva = 0, total = 0;

      for (const it of normalized) {
        const src =
          (it.productId && byProductId.get(it.productId)) ||
          (it.orderItemId && byItemId.get(it.orderItemId));
        if (!src) continue;

        const alreadyReturned = src.returnedQty ?? 0;
        const maxDevolvible  = Math.max(0, src.quantity - alreadyReturned);
        const qty            = Math.min(it.quantity, maxDevolvible);
        if (qty <= 0) continue;

        const rate      = Number.isFinite(it.taxRate ?? 0.21) ? (it.taxRate ?? 0.21) : 0.21;
        const base      = r2(Number(it.unitPrice) * qty - Number(it.discount ?? 0));
        const lineIva   = r2(base * rate);
        const lineTotal = r2(base + lineIva);
        subtotal += base; iva += lineIva; total += lineTotal;

        // +stock físico SOLO si hay productId válido
        if (it.productId && prodMap.has(it.productId)) {
          await prodRepo.increment({ id: it.productId }, 'stock', qty);
        }

        // marcar devolución en el ítem
        const newReturned = alreadyReturned + qty;
        await itemRepo.update({ id: src.id }, { returnedQty: newReturned });
        src.returnedQty = newReturned;
      }

      subtotal = r2(subtotal); iva = r2(iva); total = r2(total);
      if (total <= 0) throw new BadRequestException('La nota de crédito no tiene monto (cantidades = 0).');

      // 6) Estado del pedido
      const allReturned  = orderItems.every((it) => (it.returnedQty ?? 0) >= it.quantity);
      const someReturned = orderItems.some((it) => (it.returnedQty ?? 0) > 0);
      type Status = 'pending' | 'confirmed' | 'canceled' | 'partially_returned' | 'returned';
      let newStatus: Status = order.status as Status;
      if (allReturned) newStatus = 'returned';
      else if (someReturned) newStatus = 'partially_returned';
      if (newStatus !== (order.status as Status)) {
        await orderRepo.update({ id: order.id }, { status: newStatus });
      }

      // 7) Asiento en ledger (NEGATIVO) — compatible con tu LedgerService
      const creditNoteId = uuidv4();
      await this.ledger.record({
        trx,
        customerId: (order as any).customerId ?? dto.customerId ?? null,
        type: 'credit_note',
        sourceType: 'credit_note',
        sourceId: creditNoteId,
        amount: -Math.abs(total),
        description: `NC sobre pedido ${order.code ?? order.id}${dto.reason ? ` - ${dto.reason}` : ''}`,
      });

      // 8) Caja (opcional) — compatible con tu CashService
      if (dto.refundMethod === 'cash') {
        await this.cash.movement({
          amount: total, // CashService registra expense como -abs()
          type: 'expense',
          description: `Devolución NC ${creditNoteId} (pedido ${order.code ?? order.id})`,
          customerId: (order as any).customerId ?? dto.customerId ?? undefined,
        });
      }

      // 9) Respuesta
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
