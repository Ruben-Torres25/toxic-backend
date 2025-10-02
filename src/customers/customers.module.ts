import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomersService } from './customers.service';
import { CustomersController } from './customers.controller';
import { Customer } from './customer.entity';
import { CustomerMovement } from './customer-movement.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Customer, CustomerMovement])],
  providers: [CustomersService],
  controllers: [CustomersController],
  exports: [CustomersService],
})
export class CustomersModule {}
