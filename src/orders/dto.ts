import { IsArray, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class OrderItemDto {
  @IsString() productId!: string;
  @IsString() productName!: string;
  @IsNumber() unitPrice!: number;
  @IsNumber() quantity!: number;
  @IsOptional() @IsNumber() discount: number = 0;
}

export class CreateOrderDto {
  @IsOptional() @IsString() customerId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];
}

export class UpdateOrderDto {
  @IsOptional() @IsString() customerId?: string;
  @IsOptional() @IsIn(['pending','confirmed','canceled'])
  status?: 'pending'|'confirmed'|'canceled';
  @IsOptional() @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items?: OrderItemDto[];
}
