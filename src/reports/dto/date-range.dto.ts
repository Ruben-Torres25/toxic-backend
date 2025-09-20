import { Transform } from 'class-transformer';
import { IsOptional } from 'class-validator';

// Fechas como ISO (ej: 2025-09-20 o 2025-09-20T00:00:00-03:00).
export class DateRangeDto {
  @IsOptional()
  @Transform(({ value }) => (value ? new Date(value) : undefined))
  from?: Date;

  @IsOptional()
  @Transform(({ value }) => (value ? new Date(value) : undefined))
  to?: Date;
}
