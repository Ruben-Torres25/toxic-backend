// src/cash/cash.controller.ts
import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { CashService } from './cash.service';
import { CheckoutDto, CloseCashDto, MovementDto, OpenCashDto } from './dto';

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

  // Historial últimos N días (default 7)
  @Get('history')
  getHistory(@Query('days') days?: string) {
    const n = days ? Number(days) : 7;
    return this.cash.getHistory(n);
  }

  @Post('open')
  open(@Body() body: OpenCashDto) {
    return this.cash.open(Number(body?.openingAmount ?? 0));
  }

  @Post('close')
  close(@Body() body: CloseCashDto) {
    return this.cash.close(Number(body?.closingAmount ?? 0));
  }

  // Movimiento manual (ingreso/egreso/venta)
  @Post('movement')
  movement(@Body() body: MovementDto) {
    return this.cash.movement({
      amount: Number(body?.amount ?? 0),
      type: body?.type,
      description: body?.description ?? '',
    });
  }

  @Get('status')
  isOpen() {
    return this.cash.isOpen();
  }

  // ✅ Confirmar venta desde “Caja”
  @Post('checkout')
  checkout(@Body() dto: CheckoutDto) {
    return this.cash.checkout(dto as any);
  }
}
