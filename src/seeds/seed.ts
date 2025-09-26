// src/seeds/seed.ts
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

// Entidades existentes en tu proyecto (dejalas tal cual están en tu repo)
import { Product } from '../products/product.entity';
import { Customer } from '../customers/customer.entity';
import { Order, OrderItem } from '../orders/order.entity';
import { CashMovement, CashSession } from '../cash/cash.entity';

// === Lee variables con fallback a tus nombres actuales ===
const PG_HOST = process.env.PG_HOST ?? '127.0.0.1';
const PG_PORT = Number(process.env.PG_PORT ?? 5432);
const PG_USER = process.env.PG_USER ?? 'postgres';
// Soporta PG_PASS o PG_PASSWORD (tu .env usa PG_PASSWORD)
const PG_PASS = process.env.PG_PASS ?? process.env.PG_PASSWORD ?? 'postgres';
// Soporta PG_DB o PG_DATABASE (tu .env usa PG_DATABASE)
const PG_DB = process.env.PG_DB ?? process.env.PG_DATABASE ?? 'toxicdb';

const ds = new DataSource({
  type: 'postgres',
  host: PG_HOST,
  port: PG_PORT,
  username: PG_USER,
  password: PG_PASS,
  database: PG_DB,
  entities: [Product, Customer, Order, OrderItem, CashMovement, CashSession],
  synchronize: true, // en dev está bien; en prod usá migraciones
  namingStrategy: new SnakeNamingStrategy(),
});

async function seedProducts() {
  const repo = ds.getRepository(Product);
  if (await repo.count() > 0) return;

  const products: Partial<Product>[] = [
    { sku: 'SKU-ACE-001', name: 'Aceite Multiuso 120ml', price: 2200, stock: 120, reserved: 0 },
    { sku: 'SKU-CAMB-700', name: 'Cámara 700x25 Válvula Presta', price: 3500, stock: 200, reserved: 0 },
    { sku: 'SKU-CADR-ALU', name: 'Cadril Aluminio #6061', price: 98000, stock: 8, reserved: 0 },
    { sku: 'SKU-CADENA9', name: 'Cadena 9v', price: 21000, stock: 35, reserved: 0 },
    { sku: 'SKU-PASTILL', name: 'Pastillas Freno Disco (par)', price: 8700, stock: 60, reserved: 0 },
  ];

  await repo.save(products.map(p => repo.create(p)));
  console.log(`✅ Productos: ${products.length} insertados`);
}

async function seedCustomers() {
  const repo = ds.getRepository(Customer);
  if (await repo.count() > 0) return;

  const customers: Partial<Customer>[] = [
    { name: 'Consumidor Final', phone: '', email: '', balance: 0 },
    { name: 'Bicicletería Córdoba Centro', phone: '351-000-0000', email: 'cordoba@shop.com', balance: 0 },
    { name: 'Bike Luján', phone: '2323-000000', email: 'lujan@shop.com', balance: 0 },
  ];

  await repo.save(customers.map(c => repo.create(c)));
  console.log(`✅ Clientes: ${customers.length} insertados`);
}

async function run() {
  await ds.initialize();

  await seedProducts();
  await seedCustomers();

  await ds.destroy();
  console.log('✅ Seed completado en Postgres');
}

run().catch(async (e) => {
  console.error(e);
  try { await ds.destroy(); } catch {}
  process.exit(1);
});
