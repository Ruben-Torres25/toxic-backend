// src/db/migrations/1728431000000-products-sku-default-and-indexes.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class productsSkuDefaultAndIndexes1728431000000 implements MigrationInterface {
  name = 'productsSkuDefaultAndIndexes1728431000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) Extensión para búsquedas por similitud
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);

    // 2) Secuencia (ya existe en tu DB, pero dejamos IF NOT EXISTS)
    await queryRunner.query(`CREATE SEQUENCE IF NOT EXISTS product_sku_seq START 1;`);

    // 3) Función que genera PRD + DDD con padding
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION gen_product_sku() RETURNS trigger AS $$
      DECLARE
        n INT;
      BEGIN
        IF NEW.sku IS NULL OR NEW.sku = '' THEN
          n := nextval('product_sku_seq');
          NEW.sku := 'PRD' || LPAD(n::text, 3, '0'); -- PRD001, PRD002...
        END IF;
        RETURN NEW;
      END
      $$ LANGUAGE plpgsql;
    `);

    // 4) Trigger BEFORE INSERT (autogenera SKU si viene vacío)
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS trg_products_sku ON public.products;
      CREATE TRIGGER trg_products_sku
      BEFORE INSERT ON public.products
      FOR EACH ROW
      EXECUTE FUNCTION gen_product_sku();
    `);

    // 5) Normalización de datos EXISTENTES antes del CHECK
    // 5.a) Upper a todos los SKU
    await queryRunner.query(`UPDATE public.products SET sku = UPPER(sku) WHERE sku IS NOT NULL;`);

    // 5.b) Rellenar los que están vacíos o no cumplen LLLDDD con PRD###
    //     Nota: si tenés UQ en sku, y ya existe PRD001, la secuencia sigue incrementando y evita colisión.
    await queryRunner.query(`
      UPDATE public.products
      SET sku = 'PRD' || LPAD(nextval('product_sku_seq')::text, 3, '0')
      WHERE sku IS NULL
         OR sku = ''
         OR sku !~ '^[A-Z]{3}[0-9]{3}$';
    `);

    // 6) Constraint de formato
    await queryRunner.query(`
      ALTER TABLE public.products
        DROP CONSTRAINT IF EXISTS products_sku_format_chk;
    `);
    await queryRunner.query(`
      ALTER TABLE public.products
        ADD CONSTRAINT products_sku_format_chk
        CHECK (sku ~ '^[A-Z]{3}[0-9]{3}$');
    `);

    // 7) Índices útiles
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products (sku);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_products_category ON public.products (category);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_products_barcode ON public.products (barcode);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON public.products USING GIN (name gin_trgm_ops);
    `);

    // 8) Constraints de reserved si existe la columna
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema='public' AND table_name='products' AND column_name='reserved'
        ) THEN
          EXECUTE 'ALTER TABLE public.products
                     DROP CONSTRAINT IF EXISTS product_reserved_nonneg';
          EXECUTE 'ALTER TABLE public.products
                     ADD CONSTRAINT product_reserved_nonneg CHECK (reserved >= 0)';
          EXECUTE 'ALTER TABLE public.products
                     DROP CONSTRAINT IF EXISTS product_reserved_le_stock';
          EXECUTE 'ALTER TABLE public.products
                     ADD CONSTRAINT product_reserved_le_stock CHECK (reserved <= stock)';
        END IF;
      END$$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_products_name_trgm;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_products_barcode;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_products_category;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_products_sku;`);

    await queryRunner.query(`
      ALTER TABLE public.products DROP CONSTRAINT IF EXISTS product_reserved_le_stock;
    `);
    await queryRunner.query(`
      ALTER TABLE public.products DROP CONSTRAINT IF EXISTS product_reserved_nonneg;
    `);
    await queryRunner.query(`
      ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_sku_format_chk;
    `);

    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_products_sku ON public.products;`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS gen_product_sku();`);
    // No borro la secuencia ni la extensión en down para no afectar otros objetos
  }
}
