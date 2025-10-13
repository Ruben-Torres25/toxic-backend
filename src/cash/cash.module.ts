// src/cash/cash.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CashController } from './cash.controller';
import { CashService } from './cash.service';

import { CashMovement, CashSession } from './cash.entity';
import { Product } from '../products/product.entity'; // ⬅️ Necesario para inyectar ProductRepository
import { LedgerModule } from '../ledger/ledger.module'; // ⬅️ Donde está LedgerService

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CashMovement,
      CashSession,
      Product, // ⬅️ clave para resolver "ProductRepository" en CashService
    ]),
    // si hay dependencia cruzada con Ledger, forwardRef:
    forwardRef(() => LedgerModule),
  ],
  controllers: [CashController],
  providers: [CashService],
  exports: [CashService],
})
export class CashModule {}
