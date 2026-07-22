import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { ExchangeService } from './exchange.service';
import { CreateCreditListingDto, TradeCreditDto, UpdateCreditListingDto } from './dto/exchange.dto';

@Controller('green-exchange')
@UseGuards(JwtAuthGuard)
export class ExchangeController {
  constructor(private exchangeService: ExchangeService) {}

  @Get('listings')
  listings(@CurrentUser() user: any) {
    return this.exchangeService.listingsForUser(user.userId);
  }

  @Get('transactions')
  transactions(@CurrentUser() user: any) {
    return this.exchangeService.myTransactions(user.userId);
  }

  @Post('listings/:id/buy')
  buy(@CurrentUser() user: any, @Param('id') listingId: string, @Body() dto: TradeCreditDto) {
    return this.exchangeService.buy(user.userId, listingId, dto);
  }

  @Post('listings/:id/sell')
  sell(@CurrentUser() user: any, @Param('id') listingId: string, @Body() dto: TradeCreditDto) {
    return this.exchangeService.sell(user.userId, listingId, dto);
  }

  // ───────────────────────── Admin: listing management ─────────────────────────

  @Get('admin/listings')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  listAllListings() {
    return this.exchangeService.listAllListings();
  }

  @Post('admin/listings')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  createListing(@Body() dto: CreateCreditListingDto) {
    return this.exchangeService.createListing(dto);
  }

  @Patch('admin/listings/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  updateListing(@Param('id') id: string, @Body() dto: UpdateCreditListingDto) {
    return this.exchangeService.updateListing(id, dto);
  }

  @Delete('admin/listings/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  removeListing(@Param('id') id: string) {
    return this.exchangeService.removeListing(id);
  }
}
