import { IsDateString, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

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
  @IsIn(['income', 'expense', 'sale']) type!: 'income'|'expense'|'sale';
  @IsString() @IsNotEmpty() description!: string;
  @IsOptional() @IsDateString() createdAt?: string;
}
