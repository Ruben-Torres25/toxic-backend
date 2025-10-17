// src/seeds/seed.ts
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { AppDataSource } from '../db/data-source';
import { Product } from '../products/product.entity';
import { Customer } from '../customers/customer.entity';

async function seedProducts(ds: DataSource) {
  const repo = ds.getRepository(Product);
  if (await repo.count() > 0) return;

  // NO incluir "sku": lo genera el trigger (LLLDDD)
  const rows: Array<Partial<Product>> = [
    { name: 'Aceite Multiuso 120ml', price: 2200, stock: 120, reserved: 0, category: 'Lubricantes' },
    { name: 'Cámara 700x25 Válvula Presta', price: 3500, stock: 200, reserved: 0, category: 'Cámaras' },
    { name: 'Cadril Aluminio #6061', price: 98000, stock: 8, reserved: 0, category: 'Cuadros' },
    { name: 'Cadena 9v', price: 21000, stock: 35, reserved: 0, category: 'Transmisión' },
    { name: 'Pastillas Freno Disco (par)', price: 8700, stock: 60, reserved: 0, category: 'Frenos' },
  ];

  await repo.save(rows.map(r => repo.create(r)));
  console.log(`✅ Productos seed: ${rows.length}`);
}

async function seedCustomers(ds: DataSource) {
  const repo = ds.getRepository(Customer);
  if (await repo.count() > 0) return;

  const rows: Array<Partial<Customer>> = [
    { name: 'Consumidor Final', phone: '', email: '', balance: 0 },
    { name: 'Bicicletería Córdoba Centro', phone: '351-000-0000', email: 'cordoba@shop.com', balance: 0 },
    { name: 'Bike Luján', phone: '2323-000000', email: 'lujan@shop.com', balance: 0 },
  ];

  await repo.save(rows.map(r => repo.create(r)));
  console.log(`✅ Clientes seed: ${rows.length}`);
}

(async () => {
  if (!AppDataSource.isInitialized) await AppDataSource.initialize();
  await seedProducts(AppDataSource);
  await seedCustomers(AppDataSource);
  await AppDataSource.destroy();
  console.log('✅ Seed completado');
})().catch(async (e) => {
  console.error(e);
  try { if (AppDataSource.isInitialized) await AppDataSource.destroy(); } catch {}
  process.exit(1);
});
