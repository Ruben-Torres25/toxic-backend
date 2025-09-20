import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

@Entity('products')
export class Product extends BaseEntity {
  @Column({ unique: true })
  sku!: string;

  @Column()
  name!: string;

  @Column('real', { default: 0 })
  price!: number;

  // Stock físico actual
  @Column('integer', { default: 0 })
  stock!: number;

  // Unidades reservadas por pedidos PENDING
  @Column('integer', { default: 0 })
  reserved!: number;

  // Conveniencia para lecturas (no se persiste)
  get available() {
    const s = Number(this.stock || 0);
    const r = Number(this.reserved || 0);
    return Math.max(0, s - r);
  }
}
