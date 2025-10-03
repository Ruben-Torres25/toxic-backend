import { Controller, Get, Param, Post, Body, Patch, Delete, Query } from '@nestjs/common';
import { ProductsService, ProductSearchParams } from './products.service';
import { CreateProductDto, UpdateProductDto, UpdateStockDto } from './dto';

@Controller('products')
export class ProductsController {
  constructor(private readonly service: ProductsService) {}

  @Get()
  search(
    @Query('q') q?: string,
    @Query('name') name?: string,
    @Query('sku') sku?: string,
    @Query('category') category?: string,
    @Query('barcode') barcode?: string,
    @Query('codeLetters') codeLetters?: string, // 🔤
    @Query('codeDigits') codeDigits?: string,   // #️⃣
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: string,
  ) {
    const params: ProductSearchParams = {
      q, name, sku, category, barcode,
      codeLetters, codeDigits,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      sortBy: sortBy as any,
      sortDir: sortDir as any,
    };
    return this.service.search(params);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateProductDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Patch(':id/stock')
  adjustStock(@Param('id') id: string, @Body() dto: UpdateStockDto) {
    return this.service.adjustStock(id, dto.quantity);
  }
}
