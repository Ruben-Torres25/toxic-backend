import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CashService } from './cash.service';
import { CheckoutDto, CloseCashDto, MovementDto, OpenCashDto } from './dto';

@Controller()
export class CashController {
  constructor(private readonly cash: CashService) {}

  // ===== Estado del día =====
  @Get('cash/current')
  getCurrent() {
    return this.cash.getCurrent();
  }

  @Get('cash/movements')
  getMovements() {
    return this.cash.getMovements();
  }

  // ===== Historial “flat” (lo usa tu front) =====
  @Get('cash/history')
  getHistory(@Query('days') days?: string) {
    const n = days ? Number(days) : 30;
    return this.cash.getHistory(n);
  }

  // ===== Historial agrupado por día (nuevo) =====
  @Get('cash/daily')
  getDaily(@Query('days') days?: string) {
    const n = days ? Number(days) : 30;
    return this.cash.getDaily(n);
  }

  // ===== Operaciones de caja =====
  @Post('cash/open')
  open(@Body() dto: OpenCashDto) {
    return this.cash.open(Number(dto?.openingAmount ?? 0));
  }

  @Post('cash/close')
  close(@Body() dto: CloseCashDto) {
    return this.cash.close(Number(dto?.closingAmount ?? 0));
  }

  @Post('cash/movement')
  movement(@Body() body: MovementDto) {
    return this.cash.movement({
      amount: Number(body?.amount ?? 0),
      type: body?.type,
      description: body?.description ?? '',
    });
  }

  @Get('cash/status')
  isOpen() {
    return this.cash.isOpen();
  }

  // ===== Checkout POS (alias para tu front) =====
  @Post('sales/checkout')
  checkout(@Body() dto: CheckoutDto) {
    return this.cash.checkout(dto as any);
  }
}
