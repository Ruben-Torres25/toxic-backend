// src/credit-notes/dto.ts
import { IsArray, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreditNoteItemDto {
  @IsString() @IsNotEmpty()
  productId!: string;

  @IsOptional() @IsString()
  description?: string;

  // precios SIN IVA (como estás usando en orders)
  @IsNumber()
  unitPrice!: number;

  @IsNumber()
  quantity!: number;

  // monto absoluto en $ sobre la base sin IVA (misma semántica que OrderItemDto.discount)
  @IsNumber()
  discount!: number;

  // opcional (default 0.21)
  @IsOptional() @IsNumber()
  taxRate?: number;
}

export class CreateCreditNoteDto {
  @IsString() @IsNotEmpty()
  orderId!: string;

  @IsOptional() @IsString()
  invoiceId?: string | null;

  @IsOptional() @IsString()
  customerId?: string | null;

  @IsOptional() @IsString()
  reason?: string;

  @IsIn(['cash','credit'])
  refundMethod!: 'cash' | 'credit';

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreditNoteItemDto)
  items!: CreditNoteItemDto[];
}

// Respuesta que el front espera
export type CreditNoteDTO = {
  id: string;
  number?: string | null;
  subtotal: number; // sin IVA (negativo a nivel contable)
  iva: number;      // negativo
  total: number;    // con IVA (negativo)
  status: 'created' | 'authorized' | 'canceled';
  createdAt: string;
};
