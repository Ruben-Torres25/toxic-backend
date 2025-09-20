import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

@Entity('customers')
export class Customer extends BaseEntity {
  @Column()
  name!: string;

  @Column({ nullable: true })
  phone?: string;

  @Column({ nullable: true })
  email?: string;

  @Column('real', { default: 0 })
  balance!: number;
}
