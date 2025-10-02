import { Column, Entity, OneToMany } from 'typeorm';
import { BaseEntity } from '../common/base.entity';
import { CustomerMovement } from './customer-movement.entity';

@Entity('customers')
export class Customer extends BaseEntity {
  @Column()
  name!: string;

  @Column({ nullable: true })
  phone?: string;     // teléfono principal

  @Column({ nullable: true })
  phone2?: string;    // segundo teléfono

  @Column({ nullable: true })
  email?: string;

  @Column({ nullable: true })
  address?: string;

  @Column({ nullable: true })
  postalCode?: string;

  @Column('text', { nullable: true })
  notes?: string;

  @Column('real', { default: 0 })
  balance!: number;

  @OneToMany(() => CustomerMovement, (m) => m.customer)
  movements!: CustomerMovement[];
}
