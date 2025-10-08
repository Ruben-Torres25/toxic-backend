import { IsIn, IsInt, IsOptional, IsString, IsISO8601, Min } from 'class-validator';
import { LedgerType } from '../ledger-entry.entity';

export class LedgerQueryDTO {
  @IsOptional() @IsInt() @Min(1)
  page?: number;

  @IsOptional() @IsInt() @Min(1)
  pageSize?: number;

  @IsOptional() @IsISO8601()
  from?: string;

  @IsOptional() @IsISO8601()
  to?: string;

  @IsOptional() @IsIn(['order','payment','credit_note','adjustment'])
  type?: LedgerType;

  @IsOptional() @IsString()
  customerId?: string;

  @IsOptional() @IsString()
  q?: string;
}

export type LedgerListResponse = {
  items: any[];
  total: number;
  page: number;
  pageSize: number;
  balance: number;
};
