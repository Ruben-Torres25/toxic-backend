// src/orders/order.entity.ts
import { Column, Entity, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/base.entity';
import { Customer } from '../customers/customer.entity';
import { Product } from '../products/product.entity';

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'canceled'
  | 'partially_returned'
  | 'returned';

@Entity('orders')
export class Order extends BaseEntity {
  // 🔹 Generado por Postgres: PED### (ver SQL). No lo seteás en services.
  @Column({
    type: 'varchar',
    length: 32,
    unique: true,
    nullable: false,
    default: () => "('PED' || lpad(nextval('order_code_seq')::text, 3, '0'))",
  })
  code!: string;

  @Column({ type: 'varchar', default: 'pending' })
  status!: OrderStatus;

  @Column('real', { default: 0 })
  total!: number;

  @Column({ type: 'text', nullable: true })
  notes?: string | null;

  @ManyToOne(() => Customer, { nullable: true })
  @JoinColumn({ name: 'customer_id' })
  customer?: Customer | null;

  @OneToMany(() => OrderItem, (i) => i.order, { cascade: true })
  items!: OrderItem[];
}

@Entity('order_items')
export class OrderItem extends BaseEntity {
  @Column('uuid', { name: 'order_id' })
  orderId!: string;

  @ManyToOne(() => Order, (o) => o.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order!: Order;

  @Column('uuid', { name: 'product_id' })
  productId!: string;

  @ManyToOne(() => Product, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_id' })
  product?: Product;

  @Column()
  productName!: string;   // product_name

  @Column('real')
  unitPrice!: number;     // unit_price (SIN IVA)

  @Column('integer')
  quantity!: number;

  @Column('real', { default: 0 })
  discount!: number;

  @Column('real')
  lineTotal!: number;     // line_total

  // Para devoluciones parciales
  @Column('integer', { default: 0 })
  returnedQty!: number;   // returned_qty
}
