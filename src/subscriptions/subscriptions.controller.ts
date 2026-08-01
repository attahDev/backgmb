import {
  Controller,
  Post,
  Body,
  Req,
  Res,
  Get,
  Param,
  UseGuards,
  UsePipes,
  ValidationPipe,
  RawBodyRequest,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { RolesGuard } from 'src/guards/roles.guard';
import { Roles } from 'src/decorators/roles.decorator';
import { CurrentUser } from 'src/decorators/current-user.decorator';
import { SubscriptionsService } from './subscriptions.service';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { GrantTierDto } from './dto/grant-tier.dto';
import { PrismaService } from '../prisma/prisma.service';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(
    private readonly subs: SubscriptionsService,
    private readonly prisma: PrismaService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMine(@CurrentUser() user: any) {
    const sub = await this.prisma.subscription.findUnique({
      where: { userId: user.userId },
    });
    return sub ?? { tier: 'EXPLORER', status: 'MANUAL' };
  }

  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true }))
  @Post('checkout')
  createCheckout(@CurrentUser() user: any, @Body() dto: CreateCheckoutDto) {
    return this.subs.createCheckoutSession(user.userId, user.email, dto.tier, dto.billingCycle);
  }

  // Testing/support only, no Stripe involved — sets SubscriptionStatus.MANUAL.
  // Lets the full entitlement/reserve/commit/refund flow be exercised live
  // before real checkout is wired up.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @UsePipes(new ValidationPipe({ whitelist: true }))
  @Post('admin/grant')
  grantTier(@Body() dto: GrantTierDto) {
    return this.subs.grantManualTier(dto.userId, dto.tier);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('admin/:userId')
  getForUser(@Param('userId') userId: string) {
    return this.subs.getForUser(userId);
  }

  // No JwtAuthGuard — Stripe calls this directly; authenticated by signature instead.
  @Post('webhook')
  async webhook(@Req() req: RawBodyRequest<Request>, @Res() res: Response) {
    const sig = req.headers['stripe-signature'] as string;
    let event;
    try {
      event = this.subs.verifyAndConstructEvent(req.rawBody!, sig);
    } catch (err: any) {
      return res.status(400).send(`Webhook signature verification failed: ${err.message}`);
    }
    await this.subs.handleEvent(event);
    res.status(200).send({ received: true });
  }
}
