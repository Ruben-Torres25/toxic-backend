// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

function parseOrigins(env?: string): string[] | true {
  if (!env || env.trim() === '') return ['http://localhost:5173'];
  // si viene '*', permitimos cualquier origen
  if (env.trim() === '*' || env.includes('*')) return true;
  return env.split(',').map(s => s.trim()).filter(Boolean);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS dinámico
  const origins = parseOrigins(process.env.CORS_ORIGINS);
  app.enableCors({
    origin: origins,          // string[], true (cualquiera) o función
    credentials: true,        // permite cookies/autorización
    methods: ['GET','POST','PATCH','PUT','DELETE','OPTIONS'],
    allowedHeaders: ['Content-Type','Authorization'],
    maxAge: 86400,            // cachea preflight 24h
  });

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);

  const urls = await app.getUrl();
  // Log amigable
  console.log(`🚀 Toxic Backend listening on ${urls}`);
  console.log(`🔐 CORS:`, origins === true ? '* (todos los orígenes)' : origins);
}
bootstrap();
