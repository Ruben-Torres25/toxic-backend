import {
  IsArray, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// Formato A: por orderItemId (recomendado si el pedido ya existe)
export class CreditNoteItemByOrderItemDto {
  @IsString() @IsNotEmpty()
  orderItemId!: string;

  @IsOptional() @IsNumber()
  unitPrice?: number;

  @IsOptional() @IsNumber()
  quantity?: number; // default 1

  @IsOptional() @IsNumber()
  discount?: number;

  @IsOptional() @IsNumber()
  taxRate?: number; // default 0.21
}

// Formato B: por productId (requiere precio y cantidad)
export class CreditNoteItemByProductDto {
  @IsString() @IsNotEmpty()
  productId!: string;

  @IsNumber()
  unitPrice!: number;

  @IsNumber()
  quantity!: number;

  @IsOptional() @IsNumber()
  discount?: number;

  @IsOptional() @IsNumber()
  taxRate?: number; // default 0.21
}

export type CreditNoteItemDto = CreditNoteItemByOrderItemDto | CreditNoteItemByProductDto;

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
  @Type(() => Object)
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
