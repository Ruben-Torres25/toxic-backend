import {
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Body,
  Query,
  Delete,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
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
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Query('include') includeStr?: string,
  ) {
    // Ultra-defensivo si algún cliente pegó un '?' en el :id
    const safeId = id.split('?')[0];
    const include = (includeStr?.split(',').filter(Boolean) ?? []) as IncludeParam[];
    return this.service.get(safeId, include);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateOrderDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateOrderDto,
  ) {
    return this.service.update(id, dto);
  }

  @Patch(':id/confirm')
  confirm(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.service.confirm(id);
  }

  @Patch(':id/cancel')
  cancel(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.service.cancel(id);
  }

  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.service.remove(id);
  }
}
