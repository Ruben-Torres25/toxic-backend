// scripts/smoke-e2e.ts
import 'dotenv/config';

const BASE = process.env.API_BASE ?? 'http://localhost:3000';

async function j(method: string, path: string, body?: any) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  } as any); // el "as any" evita berrinches si tu tsconfig no incluye "dom"
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${path} -> ${res.status} ${text}`);
  }
  return res.json();
}

(async () => {
  await j('GET', '/products');

  const cur = await j('GET', '/cash/current');
  if (!cur.isOpen) await j('POST', '/cash/open', { amount: 10000 });

  const [products, customers] = await Promise.all([
    j('GET', '/products'),
    j('GET', '/customers'),
  ]);
  const p = (products.find((x: any) => x.stock > 0) ?? products[0]);
  const c = customers[0]?.id;

  const order = await j('POST', '/orders', {
    customerId: c,
    items: [{ productId: p.id, productName: p.name, unitPrice: p.price, quantity: 2 }],
    notes: 'smoke-e2e',
  });

  const conf = await j('PATCH', `/orders/${order.id}/confirm`);
  if (conf.status !== 'confirmed') throw new Error('Pedido no quedó confirmado');

  const movs = await j('GET', '/cash/movements');
  const sale = movs.find((m: any) => m.type === 'sale' && m.description.includes(order.id));
  if (!sale) throw new Error('No se registró venta en caja');

  console.log('✅ Smoke E2E OK');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
