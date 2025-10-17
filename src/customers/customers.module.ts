import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Customer } from './customer.entity';
import { CustomerMovement } from './customer-movement.entity';
import { CustomersService } from './customers.service';
import { CustomersController } from './customers.controller';
import { Order } from '../orders/order.entity';
import { LedgerModule } from '../ledger/ledger.module'; // 👈

@Module({
  imports: [
    TypeOrmModule.forFeature([Customer, CustomerMovement, Order]),
    LedgerModule, // 👈 para que Nest pueda inyectar LedgerService
  ],
  controllers: [CustomersController],
  providers: [CustomersService],
  exports: [CustomersService],
})
export class CustomersModule {}
