import { Column, Entity, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/base.entity';
import { Customer } from '../customers/customer.entity';
import { Product } from '../products/product.entity';

@Entity('orders')
export class Order extends BaseEntity {
  // 👇 NUEVO: código legible del pedido
  @Column({ type: 'varchar', length: 16, unique: true, nullable: true })
  code!: string | null;

  @Column({ type: 'varchar', default: 'pending' })
  status!: 'pending' | 'confirmed' | 'canceled';

  @Column('real', { default: 0 })
  total!: number;

  @ManyToOne(() => Customer, { nullable: true })
  @JoinColumn({ name: 'customer_id' })
  customer?: Customer | null;

  @OneToMany(() => OrderItem, (i) => i.order, { cascade: true })
  items!: OrderItem[];
}


@Entity('order_items')
export class OrderItem extends BaseEntity {
  // 👇 mapear FKs a snake_case de forma explícita
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

  // ❗️NO pongas name: 'productName'. Dejalo así o, si querés, usa name: 'product_name'
  @Column()
  productName!: string;   // se persiste como product_name gracias a SnakeNamingStrategy

  @Column('real')
  unitPrice!: number;     // → unit_price

  @Column('integer')
  quantity!: number;

  @Column('real', { default: 0 })
  discount!: number;

  @Column('real')
  lineTotal!: number;     // → line_total
}
