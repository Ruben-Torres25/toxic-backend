// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

import { ProductsModule } from './products/products.module';
import { CustomersModule } from './customers/customers.module';
import { OrdersModule } from './orders/orders.module';
import { CashModule } from './cash/cash.module';
import { ReportsModule } from './reports/reports.module';
import { DatabaseBootstrapService } from './db/database-bootstrap.service';
import { CreditNotesModule } from './credit-notes/credit-notes.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        type: 'postgres' as const,
        host: cfg.get<string>('PG_HOST', '127.0.0.1'),
        port: parseInt(cfg.get<string>('PG_PORT', '5432'), 10),
        username: cfg.get<string>('PG_USER', 'postgres'),
        password: cfg.get<string>('PG_PASSWORD', ''),
        database: cfg.get<string>('PG_DATABASE', 'toxicdb'),

        autoLoadEntities: true,
        synchronize: true, // en prod: false + migraciones
        namingStrategy: new SnakeNamingStrategy(),

        // Opcionales útiles
        logging: false, // o ['error', 'warn', 'schema'] si querés ver más
        // extra: { max: 10 }, // pool size
      }),
    }),

    ProductsModule,
    CustomersModule,
    OrdersModule,
    CashModule,
    ReportsModule,
    CreditNotesModule,
  ],
  providers: [DatabaseBootstrapService],
})
export class AppModule {}
