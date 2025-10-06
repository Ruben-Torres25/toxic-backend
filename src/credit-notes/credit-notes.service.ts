// src/credit-notes/credit-notes.service.ts
import { Injectable } from '@nestjs/common';
import { CreateCreditNoteDto, CreditNoteDTO } from './dto';
import { v4 as uuidv4 } from 'uuid';

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

@Injectable()
export class CreditNotesService {
  async create(dto: CreateCreditNoteDto): Promise<CreditNoteDTO> {
    // Validación mínima (class-validator ya validó tipos)
    if (!dto.items?.length) {
      throw new Error('Debe indicar al menos un ítem en la nota de crédito.');
    }

    let subtotal = 0, iva = 0, total = 0;

    for (const it of dto.items) {
      const rate = Number.isFinite(it.taxRate ?? 0.21) ? (it.taxRate ?? 0.21) : 0.21;
      const base = r2(it.unitPrice * it.quantity - (it.discount || 0)); // s/IVA
      const lineIva = r2(base * rate);
      const lineTotal = r2(base + lineIva);
      subtotal += base;
      iva += lineIva;
      total += lineTotal;
    }
    subtotal = r2(subtotal);
    iva = r2(iva);
    total = r2(total);

    // ⚠️ Aquí SOLO devolvemos la NC simulada.
    // TODO: Integrar con tu DB, caja y cuenta corriente.
    const now = new Date().toISOString();
    return {
      id: uuidv4(),
      number: null,
      subtotal: -subtotal, // negativo en contabilidad
      iva: -iva,
      total: -total,
      status: 'created',
      createdAt: now,
    };
  }
}
