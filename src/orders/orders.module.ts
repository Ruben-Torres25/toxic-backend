// src/orders/orders.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order, OrderItem } from './order.entity';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { CustomersModule } from '../customers/customers.module';
import { CashModule } from '../cash/cash.module';
import { Customer } from '../customers/customer.entity';
import { Product } from '../products/product.entity';
import { LedgerModule } from '../ledger/ledger.module'; // 👈 NUEVO

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, Customer, Product]),
    CustomersModule,
    CashModule,
    LedgerModule, // 👈 para inyectar LedgerService en OrdersService
  ],
  providers: [OrdersService],
  controllers: [OrdersController],
  exports: [OrdersService],
})
export class OrdersModule {}
