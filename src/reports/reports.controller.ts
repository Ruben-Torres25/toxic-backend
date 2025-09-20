import { Controller, Get, Query } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { DateRangeDto } from './dto/date-range.dto';

@Controller('reports')
export class ReportsController {
  constructor(private readonly svc: ReportsService) {}

  // KPIs de alto nivel
  @Get('kpis')
  kpis(@Query() q: DateRangeDto) {
    return this.svc.kpis(q);
  }

  // Ventas por día (serie temporal)
  @Get('sales-daily')
  salesDaily(@Query() q: DateRangeDto) {
    return this.svc.salesDaily(q);
  }

  // Top productos vendidos
  @Get('top-products')
  topProducts(@Query() q: DateRangeDto) {
    return this.svc.topProducts(q);
  }

  // Detalle de líneas de venta
  @Get('sales-lines')
  salesLines(@Query() q: DateRangeDto) {
    return this.svc.salesLines(q);
  }

  // Caja por día (income/expense/sale)
  @Get('cash-daily')
  cashDaily(@Query() q: DateRangeDto) {
    return this.svc.cashDaily(q);
  }
}
