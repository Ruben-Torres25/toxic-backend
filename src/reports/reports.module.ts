import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { Order, OrderItem } from '../orders/order.entity';
import { CashMovement } from '../cash/cash.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Order, OrderItem, CashMovement])],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
