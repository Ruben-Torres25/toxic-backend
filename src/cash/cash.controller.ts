import { Body, Controller, Get, Post } from '@nestjs/common';
import { CashService } from './cash.service';
import { MovementKind } from './cash.entity';

@Controller('cash')
export class CashController {
  constructor(private readonly cashService: CashService) {}

  @Get('current')
  getCurrent() {
    return this.cashService.getCurrent();
  }

  @Get('movements')
  getMovements() {
    return this.cashService.getMovements();
  }

  @Post('open')
  open(@Body() body: { amount: number }) {
    return this.cashService.open(Number(body?.amount || 0));
  }

  @Post('close')
  close(@Body() body: { amount: number }) {
    return this.cashService.close(Number(body?.amount || 0));
  }

  @Post('movement')
  movement(@Body() body: { amount: number; type: MovementKind; description: string }) {
    return this.cashService.movement({
      amount: Number(body?.amount),
      type: body?.type,
      description: body?.description ?? '',
    });
  }

  @Get('status')
  async status() {
    return { isOpen: await this.cashService.isOpen() };
  }
}
