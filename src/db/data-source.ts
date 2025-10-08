// src/db/data-source.ts
import 'reflect-metadata';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config();

import { DataSource } from 'typeorm';

const host = process.env.PG_HOST || '127.0.0.1';
const port = Number(process.env.PG_PORT ?? 5432);
const username = process.env.PG_USER || 'postgres';
const password = String(process.env.PG_PASSWORD ?? ''); // <- fuerza string
const database = process.env.PG_DATABASE || 'toxicdb';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host,
  port,
  username,
  password,
  database,
  synchronize: false,          // 👍 usá migraciones
  logging: false,
  entities: [path.join(__dirname, '..', '**', '*.entity.{ts,js}')],
  migrations: ['src/db/migrations/*.{ts,js}'],

});
