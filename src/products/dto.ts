// src/products/dto.ts
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  Length,
  Matches,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { PartialType } from '@nestjs/mapped-types';

const SKU_REGEX = /^[A-Za-z]{3}\d{3}$/;

const toUppTrimOrUndef = ({ value }: { value: any }) => {
  if (typeof value !== 'string') return value;
  const v = value.trim();
  return v === '' ? undefined : v.toUpperCase();
};

const toTrimOrUndef = ({ value }: { value: any }) => {
  if (typeof value !== 'string') return value;
  const v = value.trim();
  return v === '' ? undefined : v;
};

export class CreateProductDto {
  @IsOptional()
  @IsString()
  @Length(6, 6, { message: 'SKU debe tener exactamente 6 caracteres (LLLDDD).' })
  @Matches(SKU_REGEX, { message: 'SKU inválido. Use 3 letras y 3 números, ej: PRD001.' })
  @Transform(toUppTrimOrUndef)
  sku?: string;

  @IsString()
  @IsNotEmpty()
  @Transform(toTrimOrUndef)
  name!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'price debe ser numérico con hasta 2 decimales.' })
  @Min(0, { message: 'price no puede ser negativo.' })
  price!: number;

  @Type(() => Number)
  @IsInt({ message: 'stock debe ser un entero.' })
  @Min(0, { message: 'stock no puede ser negativo.' })
  stock!: number;

  @IsOptional()
  @IsString()
  @Transform(toTrimOrUndef)
  category?: string;

  @IsOptional()
  @IsString()
  @Transform(toTrimOrUndef)
  barcode?: string;
}

export class UpdateProductDto extends PartialType(CreateProductDto) {
  @IsOptional()
  @Length(6, 6, { message: 'SKU debe tener exactamente 6 caracteres (LLLDDD).' })
  @Matches(SKU_REGEX, { message: 'SKU inválido. Use 3 letras y 3 números, ej: PRD001.' })
  @Transform(toUppTrimOrUndef)
  sku?: string;
}

export class UpdateStockDto {
  @Type(() => Number)
  @IsInt({ message: 'quantity debe ser un entero (positivo o negativo).' })
  quantity!: number; // delta: puede ser positivo o negativo
}
