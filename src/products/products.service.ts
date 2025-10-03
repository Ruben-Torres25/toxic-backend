import { Injectable, NotFoundException } from '@nestjs/common';
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

  // 🔤 + #️⃣
  codeLetters?: string;
  codeDigits?: string;

  page?: number;
  limit?: number;
  sortBy?: SortBy;
  sortDir?: SortDir;
};

@Injectable()
export class ProductsService {
  constructor(@InjectRepository(Product) private repo: Repository<Product>) {}

  async search(params: ProductSearchParams) {
    const {
      q, name, sku, category, barcode,
      codeLetters, codeDigits,
      page = 1, limit = 20, sortBy = 'name', sortDir = 'asc',
    } = params;

    const qb = this.repo.createQueryBuilder('p');

    // filtros directos
    if (name)      qb.andWhere('p.name ILIKE :name',       { name: `%${name}%` });
    if (sku)       qb.andWhere('p.sku ILIKE :sku',         { sku: `%${sku}%` });
    if (category)  qb.andWhere('p.category ILIKE :cat',    { cat: `%${category}%` });
    if (barcode)   qb.andWhere('p.barcode ILIKE :barcode', { barcode: `%${barcode}%` });

    // 🔎 búsqueda libre
    if (q) {
      qb.andWhere(
        `(p.name ILIKE :q OR p.sku ILIKE :q OR p.category ILIKE :q OR p.barcode ILIKE :q)`,
        { q: `%${q}%` }
      );
    }

    // 🧠 lógica letras/números
    const L = codeLetters?.trim();
    const D = codeDigits?.trim();

    if (L && D) {
      // SKU que contenga letras y luego (no necesariamente adyacente) números: regex case-insensitive
      // Ej: ABC-001, AB001, A_B.C123 → ^.*ABC.*[0-9]*123.*$
      // Usamos ~* para ignorar mayúsculas/minúsculas
      const regex = `^.*${escapeRegex(L)}.*${escapeDigitsRegex(D)}.*$`;

      qb.andWhere(new Brackets((w) => {
        w.where('p.sku ~* :rx', { rx: regex })           // SKU con patrón letras…dígitos
         .orWhere('p.barcode ILIKE :dcont', { dcont: `%${D}%` }); // o barcode contiene dígitos
      }));
    } else if (L) {
      qb.andWhere(new Brackets((w) => {
        w.where('p.sku ILIKE :lstart', { lstart: `${L}%` })
         .orWhere('p.sku ILIKE :lcont', { lcont: `%${L}%` });
      }));
    } else if (D) {
      qb.andWhere(new Brackets((w) => {
        w.where('p.barcode ILIKE :dcont', { dcont: `%${D}%` })
         .orWhere('p.sku ILIKE :dcontSku', { dcontSku: `%${D}%` }); // por si SKU incluye números
      }));
    }

    // Orden
    const safeSortBy: SortBy = (['name','sku','price','stock','createdAt'] as const)
      .includes(sortBy) ? sortBy : 'name';
    const safeSortDir: 'ASC' | 'DESC' = sortDir?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    qb.orderBy(`p.${safeSortBy}`, safeSortDir);

    // Paginación
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

// --- helpers ---
function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function escapeDigitsRegex(d: string) {
  // sólo dígitos; por si acaso escapamos
  return d.replace(/[^0-9]/g, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
