// scripts/smoke-e2e.ts
import 'dotenv/config';

const BASE = process.env.API_BASE ?? 'http://localhost:3000';
const MAX_RETRIES = 10;
const DELAY_MS = 800;

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function j(method: string, path: string, body?: any) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  } as any);
  if (!res.ok) {
    const text = await res.text().catch(()=>'');
    throw new Error(`${method} ${path} -> ${res.status} ${text}`);
  }
  return res.json();
}

// Abre caja si está cerrada; si ya está abierta (400), NO falla.
async function openIfNeeded(amount = 10000) {
  const res = await fetch(`${BASE}/cash/open`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount }),
  } as any);
  if (res.ok) return;
  // Si no ok, toleramos el caso "ya está abierta"
  const text = await res.text().catch(()=>'');
  if (res.status === 400 && text.includes('ya está abierta')) {
    return; // seguimos como si todo ok
  }
  throw new Error(`POST /cash/open -> ${res.status} ${text}`);
}

async function waitForApi() {
  for (let i = 1; i <= MAX_RETRIES; i++) {
    try {
      await j('GET', '/products');
      console.log(`API OK en ${BASE}`);
      return;
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg.includes('ECONNREFUSED') || msg.includes('fetch failed')) {
        console.log(`API no disponible aún (${i}/${MAX_RETRIES})…`);
        await sleep(DELAY_MS);
        continue;
      }
      throw e;
    }
  }
  throw new Error(`No pude conectar con la API en ${BASE} tras ${MAX_RETRIES} intentos`);
}

(async () => {
  console.log(`Usando API_BASE=${BASE}`);
  await waitForApi();

  // Abrir caja si hace falta (ignora “ya está abierta”)
  await openIfNeeded(10000);

  // Elegir product & customer
  const [products, customers] = await Promise.all([
    j('GET', '/products'),
    j('GET', '/customers'),
  ]);
  const p = (products.find((x: any) => x.stock > 0) ?? products[0]);
  const c = customers[0]?.id;

  // Crear pedido
  const order = await j('POST', '/orders', {
    customerId: c,
    items: [{ productId: p.id, productName: p.name, unitPrice: p.price, quantity: 2 }],
    notes: 'smoke-e2e',
  });

  // Confirmar
  const conf = await j('PATCH', `/orders/${order.id}/confirm`);
  if (conf.status !== 'confirmed') throw new Error('Pedido no quedó confirmado');

  // Venta en caja
  const movs = await j('GET', '/cash/movements');
  const sale = movs.find((m: any) => m.type === 'sale' && m.description.includes(order.id));
  if (!sale) throw new Error('No se registró venta en caja');

  console.log('✅ Smoke E2E OK');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
