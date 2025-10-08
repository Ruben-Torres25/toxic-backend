import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { CashService } from './cash.service';

@Controller('cash')
export class CashController {
  constructor(private readonly cash: CashService) {}

  @Get('current')
  getCurrent() {
    return this.cash.getCurrent();
  }

  @Get('movements')
  getMovements() {
    return this.cash.getMovements();
  }

  // 👇 NUEVO: historial últimos N días (default 7)
  @Get('history')
  getHistory(@Query('days') days?: string) {
    const n = days ? Number(days) : 7;
    return this.cash.getHistory(n);
  }

  @Post('open')
  open(@Body() body: { amount: number }) {
    return this.cash.open(Number(body?.amount ?? 0));
  }

  @Post('close')
  close(@Body() body: { amount: number }) {
    return this.cash.close(Number(body?.amount ?? 0));
  }

  // Movimiento manual (ingreso/egreso)
  @Post('movement')
  movement(@Body() body: { amount: number; type: 'income' | 'expense' | 'sale'; description?: string; customerId?: string }) {
    return this.cash.movement({
      amount: Number(body?.amount ?? 0),
      type: body?.type,
      description: body?.description ?? '',
      customerId: body?.customerId,
    });
  }

  @Get('status')
  isOpen() {
    return this.cash.isOpen();
  }
}
