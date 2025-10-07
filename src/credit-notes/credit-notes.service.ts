// src/credit-notes/credit-notes.service.ts
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { CreateCreditNoteDto, CreditNoteDTO } from './dto';

// Entidades según tu estructura
import { Order, OrderItem } from '../orders/order.entity';
import { Product } from '../products/product.entity';

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

@Injectable()
export class CreditNotesService {
  constructor(private readonly ds: DataSource) {}

  async create(dto: CreateCreditNoteDto): Promise<CreditNoteDTO> {
    if (!dto.items?.length) {
      throw new Error('Debe indicar al menos un ítem en la nota de crédito.');
    }

    return await this.ds.transaction(async (trx) => {
      const orderRepo = trx.getRepository(Order);
      const itemRepo  = trx.getRepository(OrderItem);
      const prodRepo  = trx.getRepository(Product);

      // 1) Bloquear SOLO la fila del pedido (sin joins) para evitar carreras
      const order = await orderRepo
        .createQueryBuilder('o')
        .where('o.id = :id', { id: dto.orderId })
        .setLock('pessimistic_write') // FOR UPDATE sobre orders únicamente
        .getOne();

      if (!order) throw new Error('Pedido no encontrado.');

      // 2) Traer ítems del pedido en una consulta separada (podés lockearlos también)
      const items = await itemRepo
        .createQueryBuilder('i')
        .where('i.order_id = :orderId', { orderId: order.id })
        .getMany();

      if (!Array.isArray(items) || items.length === 0) {
        throw new Error('El pedido no tiene ítems.');
      }

      // Mapa por productId para cruzar con lo devuelto
      const byProductId = new Map(items.map((it) => [String(it.productId), it]));

      // 3) Totales y efectos (stock + returnedQty)
      let subtotal = 0, iva = 0, total = 0;

      for (const it of dto.items) {
        const src = byProductId.get(String(it.productId));
        if (!src) continue;

        const rate = Number.isFinite(it.taxRate ?? 0.21) ? (it.taxRate ?? 0.21) : 0.21;

        // cantidad válida a devolver
        const alreadyReturned = src.returnedQty ?? 0;
        const maxDevolvible  = Math.max(0, src.quantity - alreadyReturned);
        const qty            = Math.min(Math.max(0, Math.floor(it.quantity)), maxDevolvible);
        if (qty <= 0) continue;

        // línea (SIN IVA → IVA → CON IVA)
        const base      = r2(it.unitPrice * qty - (it.discount || 0));
        const lineIva   = r2(base * rate);
        const lineTotal = r2(base + lineIva);
        subtotal += base; iva += lineIva; total += lineTotal;

        // 3.a) Reingreso de stock
        await prodRepo.increment({ id: String(it.productId) }, 'stock', qty);

        // 3.b) Actualizar returnedQty del ítem
        const newReturned = alreadyReturned + qty;
        await itemRepo.update({ id: src.id }, { returnedQty: newReturned });
        src.returnedQty = newReturned; // actualizar en memoria para cálculo de estado
      }

      subtotal = r2(subtotal); iva = r2(iva); total = r2(total);

      // 4) Estado del pedido según devuelto acumulado
      //    (usamos el array `items` que actualizamos en memoria)
      const allReturned  = items.every((it) => (it.returnedQty ?? 0) >= it.quantity);
      const someReturned = items.some((it) => (it.returnedQty ?? 0) > 0);

      type Status =
        | 'pending'
        | 'confirmed'
        | 'canceled'
        | 'partially_returned'
        | 'returned';

      let newStatus: Status = order.status as Status;
      if (allReturned) newStatus = 'returned';
      else if (someReturned) newStatus = 'partially_returned';

      if (newStatus !== (order.status as Status)) {
        await orderRepo.update({ id: order.id }, { status: newStatus });
      }

      // 5) (Opcional) Persistir entidad "CreditNote" real en DB

      // 6) Respuesta al front (negativos por convención contable)
      return {
        id: uuidv4(),
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
