import { MigrationInterface, QueryRunner } from 'typeorm';

export class dynamicPrefixForSku1728432000000 implements MigrationInterface {
  name = 'dynamicPrefixForSku1728432000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Reemplaza la función del trigger para prefijo dinámico:
    //   - Usa primeras 3 letras de category (si hay), sino de name, sino 'PRD'
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION gen_product_sku() RETURNS trigger AS $$
      DECLARE
        n INT;
        raw_prefix TEXT;
        prefix TEXT;
      BEGIN
        IF NEW.sku IS NULL OR NEW.sku = '' THEN
          -- prefijo: category -> name -> 'PRD'
          raw_prefix := COALESCE(NEW.category, NEW.name, 'PRD');
          -- solo letras, a mayúsculas, trunc/pad a 3
          prefix := UPPER(regexp_replace(raw_prefix, '[^A-Za-z]', '', 'g'));
          prefix := RPAD(SUBSTRING(prefix FROM 1 FOR 3), 3, 'P'); -- si queda corto, rellena con 'P'
          n := nextval('product_sku_seq');
          NEW.sku := prefix || LPAD(n::text, 3, '0'); -- LLLDDD
        END IF;
        RETURN NEW;
      END
      $$ LANGUAGE plpgsql;
    `);

  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Volver a prefijo fijo 'PRD'
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION gen_product_sku() RETURNS trigger AS $$
      DECLARE
        n INT;
      BEGIN
        IF NEW.sku IS NULL OR NEW.sku = '' THEN
          n := nextval('product_sku_seq');
          NEW.sku := 'PRD' || LPAD(n::text, 3, '0');
        END IF;
        RETURN NEW;
      END
      $$ LANGUAGE plpgsql;
    `);
  }
}
