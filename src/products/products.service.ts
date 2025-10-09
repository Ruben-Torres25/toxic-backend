import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets } from 'typeorm';
import { Product } from './product.entity';
import { CreateProductDto, UpdateProductDto } from './dto';

type SortBy = 'name' | 'sku' | 'price' | 'stock' | 'createdAt';
type SortDir = 'asc' | 'desc';

export type ProductSearchParams = {
  q?: string;
  name?: string;
  sku?: string;
  category?: string;
  barcode?: string;

  codeLetters?: string; // LLL
  codeDigits?: string;  // DDD (o "10" -> 010)

  page?: number;
  limit?: number;
  sortBy?: SortBy;
  sortDir?: SortDir;
};

@Injectable()
export class ProductsService {
  constructor(@InjectRepository(Product) private repo: Repository<Product>) {}

  // ---------- helpers ----------
  private num(v: any, def = 0): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : def;
  }

  private toTrimUndef(v?: string | null) {
    if (typeof v !== 'string') return v ?? undefined;
    const x = v.trim();
    return x === '' ? undefined : x;
  }

  private computeAvailable(p: Pick<Product, 'stock' | 'reserved'>) {
    return Math.max(0, this.num(p.stock) - this.num(p.reserved));
  }

  private normalizePrefix(input?: string, category?: string, name?: string) {
    // misma lógica que el trigger: category -> name -> 'PRD'
    const raw = (input && input.trim()) || (category && category.trim()) || (name && name.trim()) || 'PRD';
    const onlyLetters = raw.replace(/[^A-Za-z]/g, '').toUpperCase();
    const pref = (onlyLetters.substring(0, 3) || 'PRD').padEnd(3, 'P'); // si faltan letras, rellena con 'P'
    return pref;
  }

  // ---------- search ----------
  async search(params: ProductSearchParams) {
    let {
      q, name, sku, category, barcode,
      codeLetters, codeDigits,
      page = 1, limit = 20, sortBy = 'name', sortDir = 'asc',
    } = params;

    // saneo/trim
    q = this.toTrimUndef(q);
    name = this.toTrimUndef(name);
    sku = this.toTrimUndef(sku);
    category = this.toTrimUndef(category);
    barcode = this.toTrimUndef(barcode);
    codeLetters = this.toTrimUndef(codeLetters)?.toUpperCase();
    codeDigits = this.toTrimUndef(codeDigits);

    const qb = this.repo.createQueryBuilder('p');

    if (name)      qb.andWhere('p.name ILIKE :name',       { name: `%${name}%` });
    if (sku)       qb.andWhere('p.sku ILIKE :sku',         { sku: `%${sku}%` });
    if (category)  qb.andWhere('p.category ILIKE :cat',    { cat: `%${category}%` });
    if (barcode)   qb.andWhere('p.barcode ILIKE :barcode', { barcode: `%${barcode}%` });

    if (q) {
      qb.andWhere(
        `(p.name ILIKE :q OR p.sku ILIKE :q OR p.category ILIKE :q OR p.barcode ILIKE :q)`,
        { q: `%${q}%` }
      );
    }

    // Filtros combinados de código (versión "inteligente" con padding)
    const Draw = (codeDigits ?? '').replace(/\D+/g, ''); // solo dígitos
    const Lraw = codeLetters;

    if (Lraw && Draw) {
      const L3 = Lraw.slice(0, 3).toUpperCase();
      const D3 = Draw.padStart(3, '0').slice(-3); // 3 -> 003, 12 -> 012, 123 -> 123
      qb.andWhere(new Brackets(w => {
        w.where('p.sku = :skuexact', { skuexact: `${L3}${D3}` })
         .orWhere('p.barcode ILIKE :dcont', { dcont: `%${Draw}%` });
      }));
    } else if (Lraw) {
      const L3 = Lraw.slice(0, 3).toUpperCase();
      qb.andWhere(new Brackets(w => {
        w.where('p.sku ILIKE :lstart', { lstart: `${L3}%` })
         .orWhere('p.sku ILIKE :lcont', { lcont: `%${L3}%` });
      }));
    } else if (Draw) {
      qb.andWhere(new Brackets(w => {
        w.where('p.barcode ILIKE :dcont', { dcont: `%${Draw}%` })
         .orWhere('p.sku ILIKE :dcontSku', { dcontSku: `%${Draw}%` });
      }));
    }

    const allowedSort: SortBy[] = ['name', 'sku', 'price', 'stock', 'createdAt'];
    const safeSortBy: SortBy = allowedSort.includes(sortBy) ? sortBy : 'name';
    const safeSortDir: 'ASC' | 'DESC' = (sortDir?.toUpperCase() === 'DESC') ? 'DESC' : 'ASC';

    // Orden estable secundario para evitar saltos en paginación
    qb.orderBy(`p.${safeSortBy}`, safeSortDir).addOrderBy('p.id', 'ASC');

    const take = Math.min(Math.max(this.num(limit, 20), 5), 100);
    const curPage = Math.max(this.num(page, 1), 1);
    const skip = (curPage - 1) * take;

    qb.take(take).skip(skip);

    const [rows, total] = await qb.getManyAndCount();
    const items = rows.map((p) => ({
      ...p,
      available: this.computeAvailable(p),
    }));

    return {
      items,
      page: curPage,
      limit: take,
      total,
      pages: Math.max(1, Math.ceil(total / take)),
    };
  }

  async findAll() {
    const list = await this.repo.find();
    return list.map((p) => ({
      ...p,
      available: this.computeAvailable(p),
    }));
  }

  async findOne(id: string) {
    const p = await this.repo.findOne({ where: { id } });
    if (!p) throw new NotFoundException('Producto no encontrado');
    return {
      ...p,
      available: this.computeAvailable(p),
    };
  }

  async create(dto: CreateProductDto) {
    // Si sku viene vacío/null, lo removemos para que aplique el DEFAULT/trigger
    const payload: Partial<Product> = { ...dto, reserved: 0 };
    if (!payload.sku || !String(payload.sku).trim()) {
      delete (payload as any).sku;
    }

    try {
      const entity = this.repo.create(payload as Product);
      const saved = await this.repo.save(entity);
      return {
        ...saved,
        available: this.computeAvailable(saved),
      };
    } catch (e: any) {
      if (e?.code === '23505') {
        throw new BadRequestException('SKU ya existente');
      }
      throw e;
    }
  }

  async update(id: string, dto: UpdateProductDto) {
    const p = await this.repo.findOne({ where: { id } });
    if (!p) throw new NotFoundException('Producto no encontrado');

    // Si mandan sku vacío → lo ignoramos (no pisar con vacío)
    const patch: Partial<Product> = { ...dto };
    if (patch.sku != null && !String(patch.sku).trim()) {
      delete (patch as any).sku;
    }

    Object.assign(p, patch);
    try {
      const saved = await this.repo.save(p);
      return {
        ...saved,
        available: this.computeAvailable(saved),
      };
    } catch (e: any) {
      if (e?.code === '23505') {
        throw new BadRequestException('SKU ya existente');
      }
      throw e;
    }
  }

  async remove(id: string) {
    await this.repo.delete(id);
  }

  /**
   * Ajuste de stock atómico con FOR UPDATE para evitar condiciones de carrera.
   * `quantity` puede ser positivo (ingreso) o negativo (egreso). Nunca deja stock < 0.
   */
  async adjustStock(id: string, quantity: number) {
    const delta = this.num(quantity, 0);

    return await this.repo.manager.transaction(async (em) => {
      const p = await em
        .createQueryBuilder(Product, 'p')
        .setLock('pessimistic_write')
        .where('p.id = :id', { id })
        .getOne();

      if (!p) throw new NotFoundException('Producto no encontrado');

      const newStock = Math.max(0, this.num(p.stock) + delta);
      p.stock = newStock;

      const saved = await em.save(Product, p);
      return {
        ...saved,
        available: this.computeAvailable(saved),
      };
    });
  }

  // ---------- next SKU preview ----------
  /**
   * Calcula el próximo DDD sin incrementar la secuencia:
   * - GREATEST(last_value de product_sku_seq, MAX(DDD) en products) + 1
   */
  async getNextDdd(): Promise<string> {
    const row = await this.repo.query(`
      SELECT LPAD(
        (
          GREATEST(
            COALESCE((SELECT last_value FROM product_sku_seq), 0),
            COALESCE((SELECT MAX(CAST(SUBSTRING(sku FROM 4) AS INT)) FROM public.products WHERE sku ~ '^[A-Z]{3}[0-9]{3}$'), 0)
          ) + 1
        )::text,
        3,
        '0'
      ) AS ddd;
    `);
    return row?.[0]?.ddd ?? '001';
  }

  /**
   * Construye el próximo SKU combinando prefijo (derivado o explícito) + DDD calculado.
   * NO incrementa la secuencia; es solo un "preview".
   */
  async nextSku(opts: { prefix?: string; category?: string; name?: string }) {
    const prefix = this.normalizePrefix(opts?.prefix, opts?.category, opts?.name);
    const ddd = await this.getNextDdd();
    return { prefix, ddd, next: `${prefix}${ddd}` };
  }
}
