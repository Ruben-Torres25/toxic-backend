import { Controller, Get, Query } from "@nestjs/common";
import { LedgerService } from "./ledger.service";
import { LedgerListResponse, LedgerQueryDTO } from "./dto/ledger.dto";

@Controller('ledger')
export class LedgerController {
  constructor(private readonly service: LedgerService) {}

  @Get()
  list(@Query() q: LedgerQueryDTO): Promise<LedgerListResponse> {
    return this.service.list(q);
  }
}
