import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { Customer } from './customer.entity';
import { CustomerMovement } from './customer-movement.entity';
import { Order } from '../orders/order.entity'; // IMPORT RELATIVO

@Module({
  imports: [TypeOrmModule.forFeature([Customer, CustomerMovement, Order])],
  controllers: [CustomersController],
  providers: [CustomersService],
})
export class CustomersModule {}
