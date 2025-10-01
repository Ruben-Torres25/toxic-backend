import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../common/base.entity';


@Entity('customers')
export class Customer extends BaseEntity {
  @Column()
  name!: string;

  @Column({ nullable: true })
  phone?: string;     // teléfono principal

  // NUEVO: segundo teléfono
  @Column({ nullable: true })
  phone2?: string;

  @Column({ nullable: true })
  email?: string;

  @Column({ nullable: true })
  address?: string;

  // NUEVO: código postal
  @Column({ nullable: true })
  postalCode?: string;

  @Column('text', { nullable: true })
  notes?: string;

  @Column('real', { default: 0 })
  balance!: number;
}
