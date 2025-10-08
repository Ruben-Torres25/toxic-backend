import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

@Entity('products')
export class Product extends BaseEntity {
  @Column({
    type: 'varchar',
    length: 6,          // LLLDDD → 6 caracteres
    unique: true,
    nullable: false,
    // ⚠️ Importante: sin default acá.
    // El SKU lo genera el trigger de DB (ensure_sku_lllddd + product_sku_seq).
  })
  sku!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  // Si podés, mejor usar decimal/numeric para evitar flotantes.
  // Si hoy tenés data, dejalo en 'real' para no romper; si querés migrar bien, cambia a 'decimal'.
  @Column('decimal', { precision: 14, scale: 2, default: 0 })
  price!: number;

  @Column('integer', { default: 0 })
  stock!: number;

  @Column('integer', { default: 0 })
  reserved!: number;

  @Column({ type: 'varchar', length: 120, nullable: true })
  category?: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  barcode?: string | null;

  get available() {
    const s = Number(this.stock || 0);
    const r = Number(this.reserved || 0);
    return Math.max(0, s - r);
  }
}
