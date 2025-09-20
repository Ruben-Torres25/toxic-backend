
import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { CashService } from './cash.service';
import { CloseCashDto, MovementDto, OpenCashDto } from './dto';

@Controller('cash')
export class CashController {
  constructor(private readonly service: CashService) {}

  @Get('current')
  current() { return this.service.currentReport(); }

  @Post('open')
  open(@Body() dto: OpenCashDto) { return this.service.open(dto.openingAmount); }

  @Post('close')
  close(@Body() dto: CloseCashDto) { return this.service.close(dto.closingAmount); }

  @Post('movement')
  movement(@Body() dto: MovementDto) {
    const when = dto.createdAt ? new Date(dto.createdAt) : undefined;
    return this.service.movement(dto.amount, dto.type, dto.description, when);
  }

  @Get('report')
  report(@Query('date') date: string) { return this.service.report(date); }

  @Get('movements')
  movements(@Query('date') date?: string) { return this.service.getMovements(date); }
}
