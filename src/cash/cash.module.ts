// src/cash/cash.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CashController } from './cash.controller';
import { CashService } from './cash.service';
import { CashMovement, CashSession } from './cash.entity';
import { Product } from '../products/product.entity';
import { LedgerService } from '../ledger/ledger.service';

@Module({
  imports: [TypeOrmModule.forFeature([CashMovement, CashSession, Product])],
  controllers: [CashController],
  providers: [CashService, LedgerService],
  exports: [CashService],
})
export class CashModule {}
