import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

@Entity('customers')
export class Customer extends BaseEntity {
  @Column()
  name!: string;

  @Column({ nullable: true })
  phone?: string;

  @Column({ nullable: true })
  phone2?: string;

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

  // ====== NUEVO: Datos fiscales (opcionales) ======
  @Column({ nullable: true })
  businessName?: string;        // Razón social

  @Column({ nullable: true })
  cuit?: string;                // CUIT/CUIL (con o sin guiones)

  // RI = Responsable Inscripto, MONO = Monotributo, EXENTO, CF = Consumidor Final
  @Column({ type: 'varchar', nullable: true })
  vatStatus?: 'RI' | 'MONO' | 'EXENTO' | 'CF';

  @Column({ nullable: true })
  iibb?: string;                // Ingresos Brutos

  @Column({ nullable: true })
  fiscalAddress?: string;       // Domicilio fiscal

  @Column({ nullable: true })
  afipCode?: string;            // Código/Actividad AFIP

  @Column({ type: 'text', nullable: true })
  taxNotes?: string;            // Observaciones fiscales
}
