import {
  IsArray, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreditNoteItemDto {
  @IsString() @IsNotEmpty()
  productId!: string;

  @IsOptional() @IsString()
  description?: string;

  // Precio SIN IVA
  @IsNumber()
  unitPrice!: number;

  @IsNumber()
  quantity!: number;

  // Monto absoluto de descuento ($) sobre base sin IVA
  @IsNumber()
  discount!: number;

  // Alícuota opcional (por defecto 0.21)
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

  @IsIn(['cash', 'credit'])
  refundMethod!: 'cash' | 'credit';

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreditNoteItemDto)
  items!: CreditNoteItemDto[];
}

export type CreditNoteDTO = {
  id: string;
  number?: string | null;
  subtotal: number; // sin IVA (negativo)
  iva: number;      // negativo
  total: number;    // con IVA (negativo)
  status: 'created' | 'authorized' | 'canceled';
  createdAt: string;
};
