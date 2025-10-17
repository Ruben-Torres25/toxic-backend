// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

function expandLocalhost(origin: string): string[] {
  try {
    const u = new URL(origin);
    if (u.hostname === 'localhost') {
      return [origin, `${u.protocol}//127.0.0.1${u.port ? `:${u.port}` : ''}`];
    }
    if (u.hostname === '127.0.0.1') {
      return [origin, `${u.protocol}//localhost${u.port ? `:${u.port}` : ''}`];
    }
  } catch {}
  return [origin];
}

function parseOrigins(env?: string): string[] | true {
  const raw = (env ?? '').trim();

  // Por defecto permitimos localhost:5173 si no hay nada
  if (!raw) return ['http://localhost:5173'];

  // Si contiene '*', permitimos cualquier origen (Nest reflejará el Origin)
  if (raw.includes('*')) return true;

  // Parseamos y expandimos localhost <-> 127.0.0.1
  const items = raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .flatMap(expandLocalhost);

  return Array.from(new Set(items));
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const origins = parseOrigins(process.env.CORS_ORIGINS);

  app.enableCors({
    origin: origins, // string[], true o función
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'X-Requested-With',
    ],
    maxAge: 86400, // cache preflight 24h
  });

  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? '127.0.0.1';
  await app.listen(port, host);

  const url = await app.getUrl();
  console.log(`🚀 Toxic Backend listening on ${url}`);
  console.log('🔐 CORS:', origins === true ? '* (todos los orígenes)' : origins);
}

bootstrap();
