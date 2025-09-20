import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { DateRangeDto } from './dto/date-range.dto';

// Helper para agregar filtros de fecha
function whereBetween(aliasDateCol: string, qb: any, from?: Date, to?: Date) {
  if (from) qb.andWhere(`${aliasDateCol} >= :from`, { from });
  if (to)   qb.andWhere(`${aliasDateCol} < :to`,   { to });
  return qb;
}

@Injectable()
export class ReportsService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  // KPIs: total_ventas, pedidos_confirmados, ticket_promedio, productos_distintos
  async kpis({ from, to }: DateRangeDto) {
    const qb = this.ds
      .createQueryBuilder()
      .from('orders', 'o')
      .select('COALESCE(SUM(o.total),0)', 'total_sales')
      .addSelect('COUNT(*) FILTER (WHERE o.status = \'confirmed\')', 'orders_confirmed')
      .addSelect('COALESCE(AVG(NULLIF(o.total,0)) FILTER (WHERE o.status = \'confirmed\'),0)', 'avg_ticket')
      .where('o.status = :st', { st: 'confirmed' });

    whereBetween('o.created_at', qb, from, to);

    // productos distintos vendidos en el rango
    const qb2 = this.ds
      .createQueryBuilder()
      .from('order_items', 'oi')
      .innerJoin('orders', 'o', 'o.id = oi.order_id AND o.status = :st', { st: 'confirmed' });

    whereBetween('o.created_at', qb2, from, to);

    const row2 = await qb2
      .select('COUNT(DISTINCT oi.product_id)', 'count')
      .getRawOne<{ count: string }>();

    const distinctProducts = Number(row2?.count ?? 0);

    const row = await qb.getRawOne<{
      total_sales: string;
      orders_confirmed: string;
      avg_ticket: string;
    }>();

    return {
      totalSales: Number(row?.total_sales ?? 0),
      ordersConfirmed: Number(row?.orders_confirmed ?? 0),
      avgTicket: Number(row?.avg_ticket ?? 0),
      distinctProducts,
      from, to,
    };
  }

  // Serie de ventas por día
  async salesDaily({ from, to }: DateRangeDto) {
    const qb = this.ds.createQueryBuilder()
      .from('orders', 'o')
      .select(`DATE_TRUNC('day', o.created_at)`, 'day')
      .addSelect('COALESCE(SUM(o.total),0)', 'total')
      .where('o.status = :st', { st: 'confirmed' })
      .groupBy(`DATE_TRUNC('day', o.created_at)`)
      .orderBy('day', 'ASC');

    whereBetween('o.created_at', qb, from, to);

    const rows = await qb.getRawMany<{ day: string; total: string }>();
    return rows.map(r => ({ day: r.day, total: Number(r.total) }));
  }

  // Top productos por cantidad y monto
  async topProducts({ from, to }: DateRangeDto) {
    const qb = this.ds.createQueryBuilder()
      .from('order_items', 'oi')
      .innerJoin('orders', 'o', 'o.id = oi.order_id AND o.status = :st', { st: 'confirmed' })
      .select('oi.product_id', 'productId')
      .addSelect('MAX(oi.product_name)', 'name')
      .addSelect('SUM(oi.quantity)', 'qty')
      .addSelect('SUM(oi.line_total)', 'amount')
      .groupBy('oi.product_id')
      .orderBy('amount', 'DESC');

    whereBetween('o.created_at', qb, from, to);

    const rows = await qb.getRawMany<{ productId: string; name: string; qty: string; amount: string }>();
    return rows.map(r => ({
      productId: r.productId,
      name: r.name,
      quantity: Number(r.qty),
      amount: Number(r.amount),
    }));
  }

  // Detalle de líneas de venta
  async salesLines({ from, to }: DateRangeDto) {
    const qb = this.ds.createQueryBuilder()
      .from('order_items', 'oi')
      .innerJoin('orders', 'o', 'o.id = oi.order_id AND o.status = :st', { st: 'confirmed' })
      .select('o.id', 'orderId')
      .addSelect('o.created_at', 'createdAt')
      .addSelect('oi.product_id', 'productId')
      .addSelect('oi.product_name', 'productName')
      .addSelect('oi.unit_price', 'unitPrice')
      .addSelect('oi.quantity', 'quantity')
      .addSelect('oi.discount', 'discount')
      .addSelect('oi.line_total', 'lineTotal')
      .orderBy('o.created_at', 'DESC');

    whereBetween('o.created_at', qb, from, to);

    const rows = await qb.getRawMany();
    return rows.map(r => ({
      orderId: r.orderId,
      createdAt: r.createdAt,
      productId: r.productId,
      productName: r.productName,
      unitPrice: Number(r.unitPrice),
      quantity: Number(r.quantity),
      discount: Number(r.discount),
      lineTotal: Number(r.lineTotal),
    }));
  }

  // Caja por día (ingresos/egresos/ventas) desde cash_movements
  async cashDaily({ from, to }: DateRangeDto) {
    const qb = this.ds.createQueryBuilder()
      .from('cash_movements', 'cm')
      .select(`DATE_TRUNC('day', cm.occurred_at)`, 'day')
      .addSelect(`SUM(CASE WHEN cm.type = 'income'  THEN cm.amount ELSE 0 END)`, 'income')
      .addSelect(`SUM(CASE WHEN cm.type = 'expense' THEN cm.amount ELSE 0 END)`, 'expense')
      .addSelect(`SUM(CASE WHEN cm.type = 'sale'    THEN cm.amount ELSE 0 END)`, 'sales')
      .groupBy(`DATE_TRUNC('day', cm.occurred_at)`)
      .orderBy('day', 'ASC');

    whereBetween('cm.occurred_at', qb, from, to);

    const rows = await qb.getRawMany<{ day: string; income: string; expense: string; sales: string }>();
    return rows.map(r => ({
      day: r.day,
      income: Number(r.income),
      expense: Number(r.expense),
      sales: Number(r.sales),
      net: Number(r.income) + Number(r.sales) - Math.abs(Number(r.expense)),
    }));
  }
}
