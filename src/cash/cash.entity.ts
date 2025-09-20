import { Column, Entity, ManyToOne } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

@Entity('cash_sessions')
export class CashSession extends BaseEntity {
  @Column({ unique: true })
  date!: string; // YYYY-MM-DD

  @Column('real', { default: 0 })
  openingAmount!: number;

  @Column('real', { default: 0 })
  closingAmount!: number;

  @Column({ default: true })
  isOpen!: boolean;
}

@Entity('cash_movements')
export class CashMovement extends BaseEntity {
  @Column()
  sessionId!: string;

  @Column('real')
  amount!: number; // positive for income/sale, negative for expense

  @Column()
  type!: 'income' | 'expense' | 'sale';

  @Column()
  description!: string;

  @Column({ type: 'timestamptz' })
  occurredAt!: Date;
}
