import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';

const log = new Logger('DatabaseBootstrapService');

@Injectable()
export class DatabaseBootstrapService implements OnModuleInit {
  constructor(private readonly ds: DataSource) {}

  async onModuleInit() {
    await this.run();
  }

  async run() {
    const concurrently = (process.env.DB_BOOTSTRAP_CONCURRENTLY ?? 'false').toLowerCase() === 'true';

    // Helper: ejecuta sin romper si ya existen
    const safeExec = async (sql: string) => {
      try {
        await this.ds.query(sql);
      } catch (e: any) {
        // ignorar si ya existe o similar
        if (String(e?.message || e).toLowerCase().includes('already exists')) return;
        throw e;
      }
    };

    // 1) Extensiones útiles (idempotentes)
    await safeExec(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
    await safeExec(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

    // 2) Constraints de sanidad (no-negativos)
    await safeExec(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'product_reserved_nonneg'
            AND conrelid = 'public.products'::regclass
        ) THEN
          ALTER TABLE public.products
            ADD CONSTRAINT product_reserved_nonneg CHECK (reserved >= 0);
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'product_stock_nonneg'
            AND conrelid = 'public.products'::regclass
        ) THEN
          ALTER TABLE public.products
            ADD CONSTRAINT product_stock_nonneg CHECK (stock >= 0);
        END IF;
      END$$;
    `);

    // 3) Índices (todos IF NOT EXISTS; algunos parciales/compuestos)
    const conc = concurrently ? 'CONCURRENTLY' : '';

    // orders
    await safeExec(`CREATE INDEX ${conc} IF NOT EXISTS idx_orders_created_at
                    ON public.orders (created_at);`);
    await safeExec(`CREATE INDEX ${conc} IF NOT EXISTS idx_orders_status
                    ON public.orders (status);`);
    await safeExec(`CREATE INDEX ${conc} IF NOT EXISTS idx_orders_status_created
                    ON public.orders (status, created_at);`);
    await safeExec(`CREATE INDEX ${conc} IF NOT EXISTS idx_orders_created_confirmed
                    ON public.orders (created_at) WHERE status = 'confirmed';`);

    // order_items
    await safeExec(`CREATE INDEX ${conc} IF NOT EXISTS idx_order_items_order
                    ON public.order_items (order_id);`);
    await safeExec(`CREATE INDEX ${conc} IF NOT EXISTS idx_order_items_product
                    ON public.order_items (product_id);`);

    // cash_movements
    await safeExec(`CREATE INDEX ${conc} IF NOT EXISTS idx_cash_movements_occurred
                    ON public.cash_movements (occurred_at);`);
    await safeExec(`CREATE INDEX ${conc} IF NOT EXISTS idx_cash_movements_type
                    ON public.cash_movements (type);`);

    // 4) ANALYZE opcional (mejora el planner luego de cambios grandes)
    if ((process.env.DB_BOOTSTRAP_ANALYZE ?? 'false').toLowerCase() === 'true') {
      await this.ds.query(`VACUUM (ANALYZE);`);
    }

    log.log(`✅ DB bootstrap: constraints + índices verificados`);
  }
}
