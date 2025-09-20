// src/db/ensure-database.ts
import 'dotenv/config';
import { Client } from 'pg';

async function ensureDatabase() {
  const host = process.env.PG_HOST || '127.0.0.1';
  const port = Number(process.env.PG_PORT || 5432);
  const user = process.env.PG_USER || 'postgres';
  const password = process.env.PG_PASSWORD || '';
  const dbName = process.env.PG_DATABASE || 'toxicdb';

  // 1) conectar a postgres para crear la DB si falta
  const admin = new Client({ host, port, user, password, database: 'postgres' });
  await admin.connect();
  try {
    const { rows } = await admin.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [dbName]);
    if (rows.length === 0) {
      await admin.query(`CREATE DATABASE ${dbName}`);
      console.log(`✅ Database creada: ${dbName}`);
    } else {
      console.log(`ℹ️  Database ya existe: ${dbName}`);
    }
  } finally {
    await admin.end();
  }

  // 2) habilitar extensiones dentro de la DB (uuid, etc.)
  const app = new Client({ host, port, user, password, database: dbName });
  await app.connect();
  try {
    await app.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
    // Si preferís gen_random_uuid(): await app.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);
    console.log(`✅ Extensiones listas en ${dbName}`);
  } finally {
    await app.end();
  }
}

ensureDatabase().catch((e) => {
  console.error('❌ ensure-database failed:', e);
  process.exit(1);
});
