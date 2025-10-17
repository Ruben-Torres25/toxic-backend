// src/db/data-source.ts
import 'reflect-metadata';
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

// === helpers .env
const env = (k: string, d?: string) => (process.env[k] && process.env[k]!.length ? process.env[k] : d);
const envN = (k: string, d: number) => {
  const v = env(k);
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) ? n : d;
};

// === importa ENTIDADES exactamente como están en tu ZIP ===
import { Product } from '../products/product.entity';
import { Customer } from '../customers/customer.entity';
import { Order, OrderItem } from '../orders/order.entity';
import { CashMovement, CashSession } from '../cash/cash.entity';
// Si tenés LedgerEntry entidad, podés sumarla:
// import { LedgerEntry } from '../ledger/ledger-entry.entity';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: env('PG_HOST', '127.0.0.1'),
  port: envN('PG_PORT', 5432),
  username: env('PG_USER', 'postgres'),
  password: env('PG_PASSWORD', ''),
  database: env('PG_DATABASE', 'toxicdb'),
  synchronize: false,
  logging: false,

  // 👇 Esto alinea camelCase ↔ snake_case en tablas/columnas/joins
  namingStrategy: new SnakeNamingStrategy(),

  // Usa clases explícitas para evitar problemas de globs con ts-node
  entities: [
    Product,
    Customer,
    Order,
    OrderItem,
    CashMovement,
    CashSession,
    // LedgerEntry,
  ],
  migrations: ['src/db/migrations/*.{ts,js}'],
  subscribers: [],
});
