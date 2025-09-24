import { Controller, Get, Param, Patch, Post, Body, Query, Delete } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto, UpdateOrderDto } from './dto';

type IncludeParam = 'customer' | 'items';
type SortParam = 'code_asc' | 'code_desc' | 'date_desc' | 'date_asc';

@Controller('orders')
export class OrdersController {
  constructor(private readonly service: OrdersService) {}

  @Get()
  list(
    @Query('include') includeStr?: string,
    @Query('sort') sort?: SortParam,
  ) {
    const include = (includeStr?.split(',').filter(Boolean) ?? []) as IncludeParam[];
    return this.service.list(include, sort);
  }

  @Get(':id')
  get(
    @Param('id') id: string,
    @Query('include') includeStr?: string,
  ) {
    const include = (includeStr?.split(',').filter(Boolean) ?? []) as IncludeParam[];
    return this.service.get(id, include);
  }

  @Post()
  create(@Body() dto: CreateOrderDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateOrderDto) {
    return this.service.update(id, dto);
  }

  @Patch(':id/confirm')
  confirm(@Param('id') id: string) {
    return this.service.confirm(id);
  }

  @Patch(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.service.cancel(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
