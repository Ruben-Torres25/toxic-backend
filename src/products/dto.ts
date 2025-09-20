import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateProductDto {
  @IsString() @IsNotEmpty()
  sku!: string;

  @IsString() @IsNotEmpty()
  name!: string;

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

  @IsOptional() @IsNumber() @Min(0)
  price?: number;

  @IsOptional() @IsNumber()
  stock?: number;
}

export class UpdateStockDto {
  @IsNumber()
  quantity!: number; // can be positive or negative to adjust stock
}
