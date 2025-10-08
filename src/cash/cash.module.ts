import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CashMovement, CashSession } from './cash.entity';
import { CashService } from './cash.service';
import { CashController } from './cash.controller';
import { LedgerModule } from '../ledger/ledger.module';

@Module({
  imports: [TypeOrmModule.forFeature([CashMovement, CashSession]), LedgerModule],
  controllers: [CashController],
  providers: [CashService],
  exports: [CashService], // 👈 necesario para injectarlo en CreditNotesService
})
export class CashModule {}
