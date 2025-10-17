// src/db/ensure-database.ts
import 'dotenv/config';
import { Client } from 'pg';

function envStr(...names: string[]): string | undefined {
  for (const n of names) {
    const v = process.env[n];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return undefined;
}
function envNum(...names: string[]): number | undefined {
  const s = envStr(...names);
  if (s == null) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

// Escapa un identificador de Postgres (no valores) con comillas dobles
function quoteIdent(id: string): string {
  // Doble las comillas dobles internas según la spec
  return `"${id.replace(/"/g, '""')}"`;
}

async function ensureDatabase() {
  const host = envStr('PG_HOST', 'POSTGRES_HOST') ?? '127.0.0.1';
  const port = envNum('PG_PORT', 'POSTGRES_PORT') ?? 5432;
  const user = envStr('PG_USER', 'POSTGRES_USER') ?? 'postgres';
  const password = String(envStr('PG_PASSWORD', 'POSTGRES_PASSWORD') ?? ''); // <-- siempre string
  const dbName = envStr('PG_DATABASE', 'POSTGRES_DB') ?? 'toxicdb';

  // DB administrativa a la que SIEMPRE existe conectarse
  const adminDb = envStr('PG_ADMIN_DB', 'POSTGRES_ADMIN_DB') ?? 'postgres';

  if (password === '') {
    throw new Error(
      'Falta PG_PASSWORD (o POSTGRES_PASSWORD). Defínela en .env. ' +
      'Ej: PG_PASSWORD=root'
    );
  }

  // 1) conectar a la DB administrativa para crear la DB si falta
  const admin = new Client({ host, port, user, password, database: adminDb });

  await admin.connect();
  try {
    const { rows } = await admin.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [dbName]
    );

    if (rows.length === 0) {
      console.log(`🆕 Creando base de datos ${quoteIdent(dbName)}...`);
      // No se pueden parametrizear identificadores → usar quoteIdent
      await admin.query(`CREATE DATABASE ${quoteIdent(dbName)} WITH ENCODING 'UTF8' TEMPLATE template1`);
      console.log(`✅ Database creada: ${dbName}`);
    } else {
      console.log(`ℹ️  Database ya existe: ${dbName}`);
    }
  } finally {
    await admin.end().catch(() => {});
  }

  // 2) habilitar extensiones dentro de la DB (uuid, etc.)
  const app = new Client({ host, port, user, password, database: dbName });
  await app.connect();
  try {
    await app.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
    // Si preferís gen_random_uuid():
    // await app.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);
    console.log(`✅ Extensiones listas en ${dbName}`);
  } finally {
    await app.end().catch(() => {});
  }
}

ensureDatabase().catch((e) => {
  console.error('❌ ensure-database failed:', e);
  process.exit(1);
});
