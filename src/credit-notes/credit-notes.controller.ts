// src/credit-notes/credit-notes.controller.ts
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CreditNotesService } from './credit-notes.service';
import { CreateCreditNoteDto } from './dto';

@Controller('credit-notes') // ⇒ /api/credit-notes por tu proxy del Vite
export class CreditNotesController {
  constructor(private readonly service: CreditNotesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() body: CreateCreditNoteDto) {
    return this.service.create(body);
  }
}
