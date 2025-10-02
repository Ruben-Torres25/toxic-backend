import { IsEmail, IsNotEmpty, IsNumber, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

const ONLY_DIGITS = /^[0-9]+$/;

export class CreateCustomerDto {
  @IsString() @IsNotEmpty()
  name!: string;

  @IsOptional() @Matches(ONLY_DIGITS, { message: 'phone debe contener solo números' })
  @IsString()
  phone?: string;

  @IsOptional() @Matches(ONLY_DIGITS, { message: 'phone2 debe contener solo números' })
  @IsString()
  phone2?: string;

  @IsOptional() @IsEmail()
  email?: string;

  @IsOptional() @IsString()
  address?: string;

  @IsOptional() @Matches(ONLY_DIGITS, { message: 'postalCode debe contener solo números' })
  @IsString()
  postalCode?: string;

  @IsOptional() @IsString()
  notes?: string;
}

export class UpdateCustomerDto {
  @IsOptional() @IsString()
  name?: string;

  @IsOptional() @Matches(ONLY_DIGITS, { message: 'phone debe contener solo números' })
  @IsString()
  phone?: string;

  @IsOptional() @Matches(ONLY_DIGITS, { message: 'phone2 debe contener solo números' })
  @IsString()
  phone2?: string;

  @IsOptional() @IsEmail()
  email?: string;

  @IsOptional() @IsString()
  address?: string;

  @IsOptional() @Matches(ONLY_DIGITS, { message: 'postalCode debe contener solo números' })
  @IsString()
  postalCode?: string;

  @IsOptional() @IsString()
  notes?: string;

  @IsOptional() @IsNumber()
  balance?: number;
}

export class AdjustBalanceDto {
  @IsNumber()
  amount!: number;

  @IsOptional() @IsString() @MaxLength(140)
  reason?: string;
}
