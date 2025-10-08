import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

export type LedgerType = 'order' | 'payment' | 'credit_note' | 'adjustment';
export type LedgerSourceType = 'order' | 'payment' | 'credit_note';

@Entity({ name: 'ledger_entries' })
export class LedgerEntry {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_ledger_customer')
  @Column({ name: 'customer_id', type: 'uuid', nullable: true })
  customerId!: string | null;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  date!: Date;

  @Column({ type: 'varchar', length: 32 })
  type!: LedgerType;

  @Index('idx_ledger_source')
  @Column({ name: 'source_type', type: 'varchar', length: 32 })
  sourceType!: LedgerSourceType;

  @Column({ name: 'source_id', type: 'uuid' })
  sourceId!: string;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  amount!: string; // guardar como string; casteás a Number al leer

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
