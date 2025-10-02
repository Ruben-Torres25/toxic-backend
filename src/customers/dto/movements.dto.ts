import { IsEnum, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';
import { MovementType } from '../customer-movement.entity'; // ✅ reusamos el enum del entity

// Si querés exponer un DTO para crear movimientos manuales (opcional)
export class CreateCustomerMovementDto {
  @IsEnum(MovementType)
  type!: MovementType;

  @IsNumber()
  amount!: number; // debería venir con el signo correcto

  @IsOptional()
  @IsString()
  @MaxLength(140)
  reason?: string;
}

// Para filtros / listados, si lo necesitás:
export class ListCustomerMovementsDto {
  @IsOptional()
  @IsEnum(MovementType)
  type?: MovementType;

  // podrías agregar from/to fechas, etc.
}
