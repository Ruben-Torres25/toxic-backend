
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CashMovement, CashSession } from './cash.entity';
import dayjs from 'dayjs';

@Injectable()
export class CashService {
  constructor(
    @InjectRepository(CashSession) private sessions: Repository<CashSession>,
    @InjectRepository(CashMovement) private moves: Repository<CashMovement>,
  ) {}

  private today() {
    return dayjs().format('YYYY-MM-DD');
  }

  async getOrCreateSession(date = this.today()) {
    let s = await this.sessions.findOne({ where: { date } });
    if (!s) {
      s = this.sessions.create({ date, openingAmount: 0, closingAmount: 0, isOpen: true });
      await this.sessions.save(s);
    }
    return s;
  }

  async currentReport() {
    const date = this.today();
    return this.report(date);
  }

  async open(openingAmount: number) {
    const date = this.today();
    const existing = await this.sessions.findOne({ where: { date } });
    if (existing && existing.isOpen) throw new BadRequestException('La caja ya está abierta');
    const s = existing || this.sessions.create({ date, openingAmount, isOpen: true, closingAmount: 0 });
    s.openingAmount = openingAmount;
    s.isOpen = true;
    await this.sessions.save(s);
    return this.report(date);
  }

  async close(closingAmount: number) {
    const s = await this.getOrCreateSession();
    s.closingAmount = closingAmount;
    s.isOpen = false;
    await this.sessions.save(s);
    return this.report(s.date);
  }

  async movement(amount: number, type: 'income'|'expense'|'sale', description: string, when?: Date) {
    const s = await this.getOrCreateSession();
    if (!s.isOpen) throw new BadRequestException('La caja está cerrada');
    const m = this.moves.create({
      sessionId: s.id,
      amount,
      type,
      description,
      occurredAt: when || new Date(),
    });
    await this.moves.save(m);
    return m;
  }

  async registerSale(amount: number, description: string) {
    return this.movement(amount, 'sale', description);
  }

  async report(date: string) {
    const s = await this.getOrCreateSession(date);
    const movements = await this.moves.find({ where: { sessionId: s.id }, order: { occurredAt: 'ASC' } });
    const totals = movements.reduce((acc, m) => {
      if (m.type === 'expense') acc.totalExpense += Math.abs(m.amount);
      else if (m.type === 'sale') acc.totalSales += m.amount;
      else acc.totalIncome += m.amount;
      return acc;
    }, { totalIncome: 0, totalExpense: 0, totalSales: 0 });

    const balance = s.openingAmount + totals.totalIncome + totals.totalSales - totals.totalExpense;
    return {
      date: s.date,
      openingAmount: s.openingAmount,
      closingAmount: s.closingAmount,
      totalIncome: totals.totalIncome,
      totalExpense: totals.totalExpense,
      totalSales: totals.totalSales,
      balance,
      movements,
    };
  }

  async getMovements(date?: string) {
    const s = await this.getOrCreateSession(date || this.today());
    return this.moves.find({ where: { sessionId: s.id }, order: { occurredAt: 'DESC' } });
  }
}
