import { Controller, Get, Param, Post, Body, Patch, Delete, HttpCode } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CreateCustomerDto, UpdateCustomerDto, AdjustBalanceDto } from './dto';

@Controller('customers')
export class CustomersController {
  constructor(private readonly service: CustomersService) {}

  @Get()
  list() {
    return this.service.findAll();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateCustomerDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    return this.service.update(id, dto);
  }

  @Get(':id/balance')
  async balance(@Param('id') id: string) {
    const c = await this.service.findOne(id);
    return { balance: Number(c.balance) };
  }

  @Post(':id/adjust')
  adjust(@Param('id') id: string, @Body() dto: AdjustBalanceDto) {
    return this.service.adjust(id, dto.amount, dto.reason);
  }

  @Get(':id/movements')
  movements(@Param('id') id: string) {
    return this.service.listMovements(id); // 👈 ahora sale del ledger
  }

  // NUEVO: stats
  @Get(':id/stats')
  stats(@Param('id') id: string) {
    return this.service.stats(id);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string): Promise<void> {
    await this.service.remove(id);
  }
}
