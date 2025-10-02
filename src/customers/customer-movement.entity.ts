import { Column, Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/base.entity';
import { Customer } from './customer.entity';

export enum MovementType {
  PAYMENT = 'payment',
  DEBT = 'debt',
  ADJUST = 'adjust',
}

@Entity('customer_movements')
export class CustomerMovement extends BaseEntity {
  @ManyToOne(() => Customer, { onDelete: 'CASCADE', eager: false, nullable: false })
  @JoinColumn({ name: 'customer_id' })
  customer!: Customer;

  @Column({ type: 'varchar', default: MovementType.ADJUST })
  type!: MovementType;

  @Column({ type: 'real' })
  amount!: number;

  @Column({ type: 'text', nullable: true })
  reason?: string | null;
}
