import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { SearchService } from './search.service';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async search(@Query('q') q?: string) {
    const results = await this.searchService.search(q ?? '');
    return { results };
  }
}
