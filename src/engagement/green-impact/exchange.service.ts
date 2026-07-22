import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GreenImpactService } from './green-impact.service';
import { CreateCreditListingDto, TradeCreditDto, UpdateCreditListingDto } from './dto/exchange.dto';

/**
 * Green Exchange — an internal, gamified marketplace where members spend
 * or earn their Green Exchange balance (itself derived from real logged
 * CO2 offset points, see GreenImpactService.stats). This is NOT a real
 * external carbon-credit market: pointsPerCredit is a balance cost/payout
 * inside the platform, not a real-money price.
 */
@Injectable()
export class ExchangeService {
  constructor(
    private prisma: PrismaService,
    private greenImpact: GreenImpactService,
  ) {}

  async listActiveListings() {
    return this.prisma.creditListing.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async listAllListings() {
    return this.prisma.creditListing.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async createListing(dto: CreateCreditListingDto) {
    return this.prisma.creditListing.create({ data: dto });
  }

  async updateListing(id: string, dto: UpdateCreditListingDto) {
    return this.prisma.creditListing.update({ where: { id }, data: dto });
  }

  async removeListing(id: string) {
    return this.prisma.creditListing.delete({ where: { id } });
  }

  /** Earned balance (from real CO2 points) plus the net effect of every
   *  buy/sell this user has made — spending on a purchase reduces it,
   *  proceeds from a sale add back to it. This is what stops someone from
   *  re-spending balance that a purchase already used up. */
  private async availableBalance(userId: string): Promise<number> {
    const [{ balance: earnedBalance }, agg] = await Promise.all([
      this.greenImpact.stats(userId),
      this.prisma.creditTransaction.aggregate({
        where: { userId },
        _sum: { pointsDelta: true },
      }),
    ]);
    return Math.round((earnedBalance + (agg._sum.pointsDelta ?? 0)) * 100) / 100;
  }

  /** How many credits of this listing the user currently holds — derived
   *  from their own transaction history rather than a mutable counter, so
   *  it can never drift out of sync with the ledger. */
  private async ownedQuantity(userId: string, listingId: string): Promise<number> {
    const rows = await this.prisma.creditTransaction.findMany({
      where: { userId, listingId },
      select: { type: true, quantity: true },
    });
    return rows.reduce((sum, r) => sum + (r.type === 'BUY' ? r.quantity : -r.quantity), 0);
  }

  async buy(userId: string, listingId: string, dto: TradeCreditDto) {
    return this.prisma.$transaction(async (tx) => {
      const listing = await tx.creditListing.findUnique({ where: { id: listingId } });
      if (!listing || !listing.isActive) throw new NotFoundException('Listing not found');
      if (listing.availableQuantity < dto.quantity) {
        throw new BadRequestException('Not enough credits available in this listing');
      }

      const cost = Math.round(listing.pointsPerCredit * dto.quantity * 100) / 100;
      const balance = await this.availableBalance(userId);
      if (balance < cost) {
        throw new BadRequestException('Insufficient Green Exchange balance for this purchase');
      }

      await tx.creditListing.update({
        where: { id: listingId },
        data: { availableQuantity: { decrement: dto.quantity } },
      });

      return tx.creditTransaction.create({
        data: {
          userId,
          listingId,
          type: 'BUY',
          quantity: dto.quantity,
          pointsDelta: -cost,
        },
      });
    });
  }

  async sell(userId: string, listingId: string, dto: TradeCreditDto) {
    return this.prisma.$transaction(async (tx) => {
      const listing = await tx.creditListing.findUnique({ where: { id: listingId } });
      if (!listing) throw new NotFoundException('Listing not found');

      const owned = await this.ownedQuantity(userId, listingId);
      if (owned < dto.quantity) {
        throw new BadRequestException("You don't own enough credits of this listing to sell");
      }

      const proceeds = Math.round(listing.pointsPerCredit * dto.quantity * 100) / 100;

      await tx.creditListing.update({
        where: { id: listingId },
        data: { availableQuantity: { increment: dto.quantity } },
      });

      return tx.creditTransaction.create({
        data: {
          userId,
          listingId,
          type: 'SELL',
          quantity: dto.quantity,
          pointsDelta: proceeds,
        },
      });
    });
  }

  /** Powers the "Recent Transactions" list and the wallet balance shown
   *  on the Green Exchange page — real ledger entries only. */
  async myTransactions(userId: string, limit = 20) {
    const [transactions, balance] = await Promise.all([
      this.prisma.creditTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: { listing: { select: { title: true } } },
      }),
      this.availableBalance(userId),
    ]);

    return {
      balance,
      transactions: transactions.map((t) => ({
        id: t.id,
        title: `${t.type === 'BUY' ? 'Purchased' : 'Sold'} ${t.quantity} credits — ${t.listing.title}`,
        date: t.createdAt.toISOString(),
        points: t.pointsDelta,
        type: t.type.toLowerCase() as 'buy' | 'sell',
      })),
    };
  }

  /** Listings enriched with how many of each the current user owns —
   *  needed so the frontend can disable/limit the Sell button. */
  async listingsForUser(userId: string) {
    const listings = await this.listActiveListings();
    return Promise.all(
      listings.map(async (listing) => ({
        ...listing,
        ownedByMe: await this.ownedQuantity(userId, listing.id),
      })),
    );
  }
}
