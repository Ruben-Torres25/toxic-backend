import { IsIn, IsInt, IsOptional, IsString, Min } from "class-validator";
import { Type } from "class-transformer";

export class QueryCustomersDto {
  @IsOptional()
  @IsString()
  q?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit: number = 10;

  @IsOptional()
  @IsIn(["name", "email", "balance", "createdAt"])
  sortBy: "name" | "email" | "balance" | "createdAt" = "name";

  @IsOptional()
  @IsIn(["asc", "desc"])
  sortDir: "asc" | "desc" = "asc";
}

export type PaginatedResponse<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
};
