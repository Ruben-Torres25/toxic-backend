import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreditNotesController } from './credit-notes.controller';
import { CreditNotesService } from './credit-notes.service';
import { LedgerModule } from '../ledger/ledger.module';
import { Order, OrderItem } from '../orders/order.entity';
import { Product } from '../products/product.entity';
import { CashModule } from '../cash/cash.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, Product]), // ✅ necesario
    LedgerModule,                                          // ✅ para asiento
    CashModule,                                            // ✅ para egreso en caja si refundMethod==='cash'
  ],
  controllers: [CreditNotesController],
  providers: [CreditNotesService],
  exports: [CreditNotesService],
})
export class CreditNotesModule {}
