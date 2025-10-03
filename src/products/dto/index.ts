import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateProductDto {
  @IsString() @IsNotEmpty()
  sku!: string;

  @IsString() @IsNotEmpty()
  name!: string;

  @IsOptional() @IsString()
  category?: string;

  @IsOptional() @IsString()
  barcode?: string;

  @IsNumber() @Min(0)
  price!: number;

  @IsNumber()
  stock: number = 0;
}

export class UpdateProductDto {
  @IsOptional() @IsString()
  sku?: string;

  @IsOptional() @IsString()
  name?: string;

  @IsOptional() @IsString()
  category?: string;

  @IsOptional() @IsString()
  barcode?: string;

  @IsOptional() @IsNumber() @Min(0)
  price?: number;

  @IsOptional() @IsNumber()
  stock?: number;
}

export class UpdateStockDto {
  @IsNumber()
  quantity!: number; // +/-
}

export class SearchProductsDto {
  @IsOptional() @IsString()
  q?: string; // busca en name, sku, category, barcode

  @IsOptional() @IsString()
  name?: string;

  @IsOptional() @IsString()
  sku?: string;

  @IsOptional() @IsString()
  category?: string;

  @IsOptional() @IsString()
  barcode?: string;

  @IsOptional()
  page?: string;

  @IsOptional()
  limit?: string;

  @IsOptional()
  sortBy?: string;

  @IsOptional()
  sortDir?: string;
}
