import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Pulls listings from external opportunity APIs and upserts them into the
 * same `opportunities` table as manual admin entries, tagged
 * source = API / provider = "<name>". They show up in the normal
 * findAll()/search/category flow — the frontend doesn't need to know or
 * care whether a row was typed in by an admin or synced in.
 *
 * Currently wired to Adzuna (the only provider with a real, keyed,
 * self-serve search API — this used to be called directly from the
 * browser with the key exposed client-side; it's now server-side only).
 *
 * Neither Indeed nor LinkedIn offer a public self-serve job-search API —
 * Indeed retired its public API and LinkedIn's job search is partner-only.
 * For those, a manual admin entry with the LinkedIn/Indeed posting URL as
 * `applyUrl` is the supported path (see OpportunitiesController.create).
 * If a provider with real API access becomes available later, add a
 * `sync<Provider>()` method below alongside syncAdzuna() and call it from
 * syncNow() — the upsert/category logic stays the same.
 */
@Injectable()
export class OpportunitiesSyncService {
  private readonly logger = new Logger(OpportunitiesSyncService.name);

  constructor(
    private prisma: PrismaService,
    private http: HttpService,
    private config: ConfigService,
  ) {}

  async syncNow(query = 'sustainability') {
    return this.syncAdzuna(query);
  }

  private async syncAdzuna(query: string) {
    const appId = this.config.get<string>('ADZUNA_APP_ID');
    const appKey = this.config.get<string>('ADZUNA_APP_KEY');

    if (!appId || !appKey) {
      this.logger.warn('ADZUNA_APP_ID / ADZUNA_APP_KEY not set — skipping sync');
      return { synced: 0, skipped: 'missing_credentials' };
    }

    const country = this.config.get<string>('ADZUNA_COUNTRY') ?? 'gb';
    const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/1`;

    const { data } = await firstValueFrom(
      this.http.get(url, {
        params: {
          app_id: appId,
          app_key: appKey,
          results_per_page: 20,
          what: query,
          'content-type': 'application/json',
        },
      }),
    );

    let synced = 0;

    for (const job of data?.results ?? []) {
      await this.prisma.opportunity.upsert({
        where: {
          provider_externalId: { provider: 'adzuna', externalId: String(job.id) },
        },
        create: {
          title: job.title ?? 'Untitled role',
          company: job.company?.display_name ?? 'Unknown company',
          location: job.location?.display_name ?? null,
          category: job.category?.label ?? 'Jobs',
          type: job.contract_type ?? null,
          description: job.description ?? null,
          applyUrl: job.redirect_url,
          source: 'API',
          provider: 'adzuna',
          externalId: String(job.id),
          postedAt: job.created ? new Date(job.created) : new Date(),
        },
        update: {
          title: job.title ?? 'Untitled role',
          company: job.company?.display_name ?? 'Unknown company',
          location: job.location?.display_name ?? null,
          category: job.category?.label ?? 'Jobs',
          type: job.contract_type ?? null,
          description: job.description ?? null,
          applyUrl: job.redirect_url,
          isActive: true,
        },
      });
      synced += 1;
    }

    this.logger.log(`Adzuna sync: ${synced} opportunities upserted for query "${query}"`);
    return { synced, provider: 'adzuna', query };
  }
}
