
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CashController } from './cash.controller';
import { CashService } from './cash.service';
import { CashMovement, CashSession } from './cash.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CashSession, CashMovement])],
  controllers: [CashController],
  providers: [CashService],
  exports: [CashService],
})
export class CashModule {}
