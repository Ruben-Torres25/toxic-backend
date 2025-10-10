// src/cash/dto.ts
import {
  IsArray,
  ArrayNotEmpty,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/** === EXISTENTES (se mantienen) === */
export class OpenCashDto {
  @IsNumber()
  openingAmount!: number;
}

export class CloseCashDto {
  @IsNumber()
  closingAmount!: number;
}

export class MovementDto {
  @IsNumber() amount!: number;

  @IsIn(['income', 'expense', 'sale'])
  type!: 'income' | 'expense' | 'sale';

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsOptional()
  @IsDateString()
  createdAt?: string;
}

/** === NUEVOS: para confirmar venta (checkout) === */

export class CheckoutItemDto {
  @IsUUID()
  productId!: string;

  @IsNumber()
  @IsPositive()
  @Min(1)
  qty!: number;

  /** Precio unitario; si no viene, se usa el del producto */
  @IsOptional()
  @IsNumber()
  price?: number;

  /** Descuento ABSOLUTO por unidad (no %) */
  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;
}

export class CheckoutPaymentDto {
  @IsIn(['cash', 'debit', 'credit', 'transfer'])
  method!: 'cash' | 'debit' | 'credit' | 'transfer';

  @IsNumber()
  @Min(0)
  amount!: number;
}

export class CheckoutDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CheckoutItemDto)
  items!: CheckoutItemDto[];

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CheckoutPaymentDto)
  payments!: CheckoutPaymentDto[];

  /** Descuento global ABSOLUTO para toda la venta */
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountGlobal?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  /** Si quisieras asociar a cliente/ledger en el futuro */
  @IsOptional()
  @IsUUID()
  customerId?: string;
}
