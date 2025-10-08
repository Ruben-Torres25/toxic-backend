import { Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import { LedgerEntry, LedgerSourceType, LedgerType } from "./ledger-entry.entity";
import { LedgerListResponse, LedgerQueryDTO } from "./dto/ledger.dto";

@Injectable()
export class LedgerService {
  constructor(private readonly ds: DataSource) {}

  async record(params: {
    customerId?: string | null;
    type: LedgerType;
    sourceType: LedgerSourceType;
    sourceId: string;
    amount: number; // +deuda (pedido), -deuda (pago/NC)
    description?: string | null;
    trx?: any; // QueryRunner.manager o DataSource
  }): Promise<LedgerEntry> {
    const repo = (params.trx?.getRepository ? params.trx : this.ds).getRepository(LedgerEntry);
    const entry = repo.create({
      customerId: params.customerId ?? null,
      type: params.type,
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      amount: Number(params.amount).toFixed(2),
      description: params.description ?? null,
    });
    return repo.save(entry);
  }

  async list(q: LedgerQueryDTO): Promise<LedgerListResponse> {
    const page = Math.max(1, Number(q.page ?? 1));
    const pageSize = Math.min(500, Math.max(1, Number(q.pageSize ?? 20)));
    const qb = this.ds.getRepository(LedgerEntry).createQueryBuilder('le');

    if (q.customerId) qb.andWhere('le.customer_id = :customerId', { customerId: q.customerId });
    if (q.type) qb.andWhere('le.type = :type', { type: q.type });
    if (q.from) qb.andWhere('le.date >= :from', { from: q.from });
    if (q.to) qb.andWhere('le.date <= :to', { to: q.to });
    if (q.q) qb.andWhere('(le.description ILIKE :q OR le.source_id::text ILIKE :q)', { q: `%${q.q}%` });

    qb.orderBy('le.date', 'DESC').addOrderBy('le.id', 'DESC');
    qb.offset((page - 1) * pageSize).limit(pageSize);

    const [items, total] = await qb.getManyAndCount();

    const sumRaw = await this.ds.getRepository(LedgerEntry)
      .createQueryBuilder('le')
      .select('COALESCE(SUM(le.amount::numeric), 0)', 'balance')
      .where(q.customerId ? 'le.customer_id = :customerId' : '1=1', q.customerId ? { customerId: q.customerId } : {})
      .andWhere(q.type ? 'le.type = :type' : '1=1', q.type ? { type: q.type } : {})
      .andWhere(q.from ? 'le.date >= :from' : '1=1', q.from ? { from: q.from } : {})
      .andWhere(q.to ? 'le.date <= :to' : '1=1', q.to ? { to: q.to } : {})
      .getRawOne<{ balance: string } | undefined>();

    const balance = Number(sumRaw?.balance ?? 0);

    return {
      items: items.map(i => ({ ...i, amount: Number(i.amount) } as any)),
      total,
      page,
      pageSize,
      balance,
    };
  }
}
