import { IsEmail, IsNotEmpty, IsNumber, IsOptional, IsString, Matches, IsIn } from 'class-validator';

const ONLY_DIGITS = /^[0-9]+$/;
// Acepta CUIT con o sin guiones: 20-12345678-3 o 20123456783
const CUIT_REGEX = /^(?:\d{2}-?\d{8}-?\d)$/;

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

  // ========= NUEVO: Datos fiscales opcionales =========
  @IsOptional() @IsString()
  businessName?: string;

  @IsOptional() @Matches(CUIT_REGEX, { message: 'CUIT inválido (formato: 20-12345678-3 o 20123456783)' })
  cuit?: string;

  @IsOptional() @IsIn(['RI', 'MONO', 'EXENTO', 'CF'])
  vatStatus?: 'RI' | 'MONO' | 'EXENTO' | 'CF';

  @IsOptional() @IsString()
  iibb?: string;

  @IsOptional() @IsString()
  fiscalAddress?: string;

  @IsOptional() @IsString()
  afipCode?: string;

  @IsOptional() @IsString()
  taxNotes?: string;
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

  // ========= NUEVO: Datos fiscales opcionales =========
  @IsOptional() @IsString()
  businessName?: string;

  @IsOptional() @Matches(CUIT_REGEX, { message: 'CUIT inválido (formato: 20-12345678-3 o 20123456783)' })
  cuit?: string;

  @IsOptional() @IsIn(['RI', 'MONO', 'EXENTO', 'CF'])
  vatStatus?: 'RI' | 'MONO' | 'EXENTO' | 'CF';

  @IsOptional() @IsString()
  iibb?: string;

  @IsOptional() @IsString()
  fiscalAddress?: string;

  @IsOptional() @IsString()
  afipCode?: string;

  @IsOptional() @IsString()
  taxNotes?: string;
}

export class AdjustBalanceDto {
  @IsNumber()
  amount!: number;

  @IsOptional() @IsString()
  reason?: string;
}
