// src/orders/dto/update-order.dto.ts
import { IsOptional, IsString, IsIn, IsNumber, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class UpdateOrderItemDto {
  @IsOptional() @IsString() productId?: string;
  @IsOptional() @IsString() productName?: string;
  @IsOptional() @IsNumber() unitPrice?: number;
  @IsOptional() @IsNumber() quantity?: number;
  @IsOptional() @IsNumber() discount?: number;
}

export class UpdateOrderDto {
  @IsOptional() @IsString()
  code?: string | null;

  @IsOptional() @IsIn(['pending', 'confirmed', 'canceled'])
  status?: 'pending' | 'confirmed' | 'canceled';

  @IsOptional() @IsNumber()
  total?: number;

  @IsOptional() @IsString()
  notes?: string | null;

  @IsOptional() @IsString()
  customerId?: string;

  @IsOptional() @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateOrderItemDto)
  items?: UpdateOrderItemDto[];
}
