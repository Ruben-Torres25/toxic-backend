import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './product.entity';
import { CreateProductDto, UpdateProductDto } from './dto';

@Injectable()
export class ProductsService {
  constructor(@InjectRepository(Product) private repo: Repository<Product>) {}

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

  /**
   * Ajusta stock físico. No toca 'reserved'.
   */
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
