
import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto, UpdateOrderDto } from './dto';

@Controller('orders')
export class OrdersController {
  constructor(private readonly service: OrdersService) {}

  @Get()
  list() { return this.service.list(); }

  @Get(':id')
  get(@Param('id') id: string) { return this.service.get(id); }

  @Post()
  create(@Body() dto: CreateOrderDto) { return this.service.create(dto); }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateOrderDto) {
    return this.service.update(id, dto);
  }

  @Patch(':id/confirm')
  confirm(@Param('id') id: string) { return this.service.confirm(id); }

  @Patch(':id/cancel')
  cancel(@Param('id') id: string) { return this.service.cancel(id); }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
