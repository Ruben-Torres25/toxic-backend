// src/seeds/seed.ts
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

// importa TODAS tus entidades usadas en el seed:
import { Product } from '../products/product.entity';
import { Customer } from '../customers/customer.entity';
import { Order, OrderItem } from '../orders/order.entity';
import { CashMovement, CashSession } from '../cash/cash.entity';

const ds = new DataSource({
  type: 'postgres',
  host: process.env.PG_HOST || '127.0.0.1',
  port: Number(process.env.PG_PORT || 5432),
  username: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || '',
  database: process.env.PG_DATABASE || 'toxicdb',
  entities: [Product, Customer, Order, OrderItem, CashMovement, CashSession],
  namingStrategy: new SnakeNamingStrategy(),   // 👈 CLAVE
  synchronize: true,                           // OK para seed en dev
});

async function run() {
  await ds.initialize();

  // … tu lógica de seed (insert productos, clientes, etc.) …

  await ds.destroy();
  console.log('✅ Seed completado en Postgres');
}

run().catch(async (e) => {
  console.error(e);
  try { await ds.destroy(); } catch {}
  process.exit(1);
});
