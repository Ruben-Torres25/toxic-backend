import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';

@Entity('cash_sessions')
export class CashSession {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Si tu tabla tiene una columna DATE real, este campo puede ser 'date' (type: 'date')
  @Column({ type: 'date', nullable: true })
  date!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt!: Date;

  @Column({ name: 'opening_amount', type: 'numeric', default: 0 })
  openingAmount!: number;

  @Column({ name: 'closing_amount', type: 'numeric', default: 0 })
  closingAmount!: number;

  @Column({ name: 'is_open', type: 'boolean', default: false })
  isOpen!: boolean;
}

export type MovementKind = 'income' | 'expense' | 'sale';

@Entity('cash_movements')
export class CashMovement {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt!: Date;

  // IMPORTANTE: default:0 y NOT NULL en DB (ya lo dejaste así)
  @Column({ type: 'numeric', default: 0 })
  amount!: number;

  @Column({ type: 'varchar', length: 32 })
  type!: MovementKind;

  @Column({ type: 'text', default: '' })
  description!: string;

  @Column({ name: 'occurred_at', type: 'timestamp with time zone', nullable: true })
  occurredAt!: Date | null;

  // Relación a la sesión (session_id uuid NOT NULL con FK)
  @Column({ name: 'session_id', type: 'uuid' })
  sessionId!: string;

  @ManyToOne(() => CashSession, { eager: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'session_id' })
  session!: CashSession;
}
