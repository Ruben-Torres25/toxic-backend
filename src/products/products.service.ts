import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Product } from './product.entity';
import { CreateProductDto, UpdateProductDto } from './dto';

type SortBy = 'name' | 'sku' | 'price' | 'stock' | 'createdAt';
type SortDir = 'asc' | 'desc';

export type ProductSearchParams = {
  q?: string;          // busca en name, sku, category, barcode
  name?: string;
  sku?: string;
  category?: string;
  barcode?: string;
  page?: number;       // 1..N
  limit?: number;      // 5..100
  sortBy?: SortBy;
  sortDir?: SortDir;
};

@Injectable()
export class ProductsService {
  constructor(@InjectRepository(Product) private repo: Repository<Product>) {}

  // ---------- BÚSQUEDA con filtros + paginado ----------
  async search(params: ProductSearchParams) {
    const {
      q, name, sku, category, barcode,
      page = 1,
      limit = 20,
      sortBy = 'name',
      sortDir = 'asc',
    } = params;

    const qb = this.repo.createQueryBuilder('p');

    // Filtros específicos
    if (name)      qb.andWhere('p.name ILIKE :name',       { name: `%${name}%` });
    if (sku)       qb.andWhere('p.sku ILIKE :sku',         { sku: `%${sku}%` });
    if (category)  qb.andWhere('p.category ILIKE :cat',    { cat: `%${category}%` });
    if (barcode)   qb.andWhere('p.barcode ILIKE :barcode', { barcode: `%${barcode}%` });

    // Búsqueda libre (multi-campo)
    if (q) {
      qb.andWhere(
        `(p.name ILIKE :q OR p.sku ILIKE :q OR p.category ILIKE :q OR p.barcode ILIKE :q)`,
        { q: `%${q}%` }
      );
    }

    // Orden seguro
    const safeSortBy: SortBy = (['name','sku','price','stock','createdAt'] as const)
      .includes(sortBy) ? sortBy : 'name';
    const safeSortDir: 'ASC' | 'DESC' = sortDir?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    qb.orderBy(`p.${safeSortBy}`, safeSortDir);

    // Paginación segura
    const take = Math.min(Math.max(Number(limit) || 20, 5), 100);
    const skip = Math.max((Number(page) || 1) - 1, 0) * take;

    qb.take(take).skip(skip);

    const [rows, total] = await qb.getManyAndCount();
    const items = rows.map((p) => ({
      ...p,
      available: Math.max(0, Number(p.stock || 0) - Number(p.reserved || 0)),
    }));

    return {
      items,
      page: Number(page) || 1,
      limit: take,
      total,
      pages: Math.max(1, Math.ceil(total / take)),
    };
  }

  // ---------- Categorías únicas (para el dropdown) ----------
  async listCategories(): Promise<string[]> {
    const qb = this.repo.createQueryBuilder('p')
      .select('DISTINCT p.category', 'category')
      .where('p.category IS NOT NULL')
      .andWhere("TRIM(p.category) <> ''")
      .orderBy('p.category', 'ASC');

    const rows = await qb.getRawMany<{ category: string }>();
    return rows.map(r => r.category);
  }

  // ---------- Listado simple (retro-compat) ----------
  async findAll() {
    const list = await this.repo.find();
    return list.map((p) => ({
      ...p,
      available: Math.max(0, Number(p.stock || 0) - Number(p.reserved || 0)),
    }));
  }

  async findOne(id: string) {
    const p = await this.repo.findOne({ where: { id } });
    if (!p) throw new NotFoundException('Producto no encontrado');
    return {
      ...p,
      available: Math.max(0, Number(p.stock || 0) - Number(p.reserved || 0)),
    };
  }

  async create(dto: CreateProductDto) {
    const p = this.repo.create({ ...dto, reserved: 0 });
    const saved = await this.repo.save(p);
    return {
      ...saved,
      available: Math.max(0, Number(saved.stock || 0) - Number(saved.reserved || 0)),
    };
  }

  async update(id: string, dto: UpdateProductDto) {
    const p = await this.repo.findOne({ where: { id } });
    if (!p) throw new NotFoundException('Producto no encontrado');
    Object.assign(p, dto);
    const saved = await this.repo.save(p);
    return {
      ...saved,
      available: Math.max(0, Number(saved.stock || 0) - Number(saved.reserved || 0)),
    };
  }

  async remove(id: string) {
    await this.repo.delete(id);
  }

  /** Ajuste de stock físico (no toca 'reserved'). */
  async adjustStock(id: string, quantity: number) {
    const p = await this.repo.findOne({ where: { id } });
    if (!p) throw new NotFoundException('Producto no encontrado');
    p.stock = Math.max(0, Number(p.stock || 0) + Number(quantity || 0));
    const saved = await this.repo.save(p);
    return {
      ...saved,
      available: Math.max(0, Number(saved.stock || 0) - Number(saved.reserved || 0)),
    };
  }
}
