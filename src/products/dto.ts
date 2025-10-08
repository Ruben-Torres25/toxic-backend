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

export class CreateProductDto {
  @IsOptional()
  @IsString()
  @Length(6, 6, { message: 'SKU debe tener exactamente 6 caracteres (LLLDDD).' })
  @Matches(SKU_REGEX, { message: 'SKU inválido. Use 3 letras y 3 números, ej: PRD001.' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toUpperCase() : value
  )
  sku?: string;

  @IsString()
  @IsNotEmpty()
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
  category?: string;

  @IsOptional()
  @IsString()
  barcode?: string;
}

export class UpdateProductDto extends PartialType(CreateProductDto) {
  @IsOptional()
  @Length(6, 6, { message: 'SKU debe tener exactamente 6 caracteres (LLLDDD).' })
  @Matches(SKU_REGEX, { message: 'SKU inválido. Use 3 letras y 3 números, ej: PRD001.' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toUpperCase() : value
  )
  sku?: string;
}

export class UpdateStockDto {
  @Type(() => Number)
  @IsNumber({}, { message: 'quantity debe ser numérico.' })
  quantity!: number; // puede ser positivo o negativo
}
