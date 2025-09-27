import { Controller, Get, Post, Body } from '@nestjs/common';
import { CashService } from './cash.service';

type MovementKind = 'income' | 'expense' | 'sale';

@Controller('cash')
export class CashController {
  constructor(private readonly cashService: CashService) {}

  @Get('current')
  getCurrent() {
    // ahora incluye { isOpen }
    return this.cashService.getCurrent();
  }

  @Get('movements')
  getMovements() {
    return this.cashService.getMovements();
  }

  @Post('open')
  open(@Body() body: { amount: number }) {
    return this.cashService.open(body.amount);
  }

  @Post('close')
  close(@Body() body: { amount: number }) {
    return this.cashService.close(body.amount);
  }

  @Post('movement')
  movement(
    @Body()
    body: { amount: number; type: MovementKind; description: string },
  ) {
    return this.cashService.movement(body);
  }

  // opcional, lo dejamos por si querés consultarlo directo
  @Get('status')
  async status() {
    const isOpen = await this.cashService.isOpen();
    return { isOpen };
  }
}
