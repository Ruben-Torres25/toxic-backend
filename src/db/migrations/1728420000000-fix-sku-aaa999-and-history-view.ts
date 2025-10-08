import { MigrationInterface, QueryRunner } from "typeorm";

export class FixSkuAaa999AndHistoryView1728420000000 implements MigrationInterface {
  name = 'FixSkuAaa999AndHistoryView1728420000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) Extensiones y secuencias requeridas
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);
    await queryRunner.query(`CREATE SEQUENCE IF NOT EXISTS product_sku_seq START 1;`);
    await queryRunner.query(`CREATE SEQUENCE IF NOT EXISTS order_code_seq START 1;`);

    // 2) Normalización de SKUs existentes a AAA999 (sin guion)
    //    Tomamos prefijo = primeras 3 letras "limpias" de lo que haya (o 'PRD' si nada),
    //    y el número se toma de la secuencia para garantizar unicidad.
    await queryRunner.query(`
      WITH to_fix AS (
        SELECT
          p.id,
          COALESCE(NULLIF(SUBSTRING(regexp_replace(p.sku, '[^A-Za-z]', '', 'g') FROM 1 FOR 3), ''), 'PRD') AS pfx
        FROM products p
        ORDER BY p.created_at, p.id
      )
      UPDATE products p
      SET sku = t.pfx || lpad(nextval('product_sku_seq')::text, 3, '0')
      FROM to_fix t
      WHERE p.id = t.id
    `);

    // 3) DEFAULT para nuevos productos: PRD + 3 dígitos (PRD001, PRD002, …)
    //    (No cambio el tipo/longitud para no romper el Entity actual; queda VARCHAR(64))
    await queryRunner.query(`
      ALTER TABLE products
      ALTER COLUMN sku SET DEFAULT ('PRD' || lpad(nextval('product_sku_seq')::text, 3, '0'))
    `);

    // 4) Trigger para orders.code (si tu Entity no setea code por app)
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION set_order_code()
      RETURNS trigger AS $$
      BEGIN
        IF NEW.code IS NULL OR NEW.code = '' THEN
          NEW.code := 'PED' || lpad(nextval('order_code_seq')::text, 3, '0');
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_set_order_code ON orders;`);
    await queryRunner.query(`
      CREATE TRIGGER trg_set_order_code
      BEFORE INSERT ON orders
      FOR EACH ROW
      EXECUTE FUNCTION set_order_code();
    `);

    // 5) Vista de historial (DEBE/HABER/Saldo corrido)
    await queryRunner.query(`DROP VIEW IF EXISTS v_historial_cliente;`);
    await queryRunner.query(`
      CREATE OR REPLACE VIEW v_historial_cliente AS
      WITH base AS (
        SELECT
          le.id,
          le.customer_id,
          c.name                               AS cliente,
          le.date,
          le.type,
          le.source_type,
          le.source_id,
          o.code                                AS order_code,  -- code si es pedido
          le.description,
          CASE WHEN le.amount > 0 THEN le.amount ELSE 0 END::numeric(14,2) AS debe,   -- + = DEBE
          CASE WHEN le.amount < 0 THEN -le.amount ELSE 0 END::numeric(14,2) AS haber, -- - = HABER
          le.amount::numeric(14,2)              AS signo
        FROM ledger_entries le
        LEFT JOIN customers c ON c.id = le.customer_id
        LEFT JOIN orders    o ON (le.source_type = 'order' AND o.id = le.source_id)
      )
      SELECT
        b.customer_id,
        b.cliente,
        b.date AS fecha,
        CASE b.type
          WHEN 'order'       THEN 'Pedido'
          WHEN 'payment'     THEN 'Pago'
          WHEN 'credit_note' THEN 'Nota de crédito'
          WHEN 'adjustment'  THEN 'Ajuste'
          ELSE initcap(b.type)
        END AS tipo,
        COALESCE(b.order_code, left(b.source_id::text, 8)) AS numero,
        b.description AS descripcion,
        b.debe,
        b.haber,
        SUM(b.signo) OVER (
          PARTITION BY b.customer_id
          ORDER BY b.date, b.id
          ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        )::numeric(14,2) AS saldo
      FROM base b;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Vista
    await queryRunner.query(`DROP VIEW IF EXISTS v_historial_cliente;`);

    // DEFAULT anterior (con guion y 5 dígitos) por si necesitás volver atrás
    await queryRunner.query(`
      ALTER TABLE products
      ALTER COLUMN sku SET DEFAULT ('PRD-' || lpad(nextval('product_sku_seq')::text, 5, '0'))
    `);

    // (Dejo las secuencias y el trigger creados; si querés limpiar:
    // await queryRunner.query('DROP TRIGGER IF EXISTS trg_set_order_code ON orders;');
    // await queryRunner.query('DROP FUNCTION IF EXISTS set_order_code;');
    // await queryRunner.query('DROP SEQUENCE IF EXISTS product_sku_seq;');
    // await queryRunner.query('DROP SEQUENCE IF EXISTS order_code_seq;');
  }
}
