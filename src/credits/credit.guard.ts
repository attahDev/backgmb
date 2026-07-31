import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CREDIT_COST_KEY, CreditCostMeta } from './require-credits.decorator';
import {
  CreditsService,
  EntitlementError,
  InsufficientCreditsError,
} from './credits.service';

/** Must run AFTER JwtAuthGuard, same ordering requirement as RolesGuard.
 *  Routes with no @RequireCredits metadata pass through untouched — this
 *  guard is opt-in per route, not applied globally. */
@Injectable()
export class CreditGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly credits: CreditsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const meta = this.reflector.getAllAndOverride<CreditCostMeta>(
      CREDIT_COST_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!meta) return true;

    const request = context.switchToHttp().getRequest();
    const userId =
      request.user?.id ?? request.user?.sub ?? request.user?.userId;
    if (!userId) {
      if (meta.optional) return true; // anonymous visitor — free, ungated pass-through
      throw new ForbiddenException('Not authenticated');
    }

    try {
      await this.credits.checkEntitlement(userId, meta.minTier);
    } catch (e) {
      if (e instanceof EntitlementError) {
        throw new ForbiddenException(e.message);
      }
      throw e;
    }

    try {
      request.creditReservation = await this.credits.reserve(
        userId,
        meta.service,
        meta.cost,
      );
    } catch (e) {
      if (e instanceof InsufficientCreditsError) {
        throw new HttpException(e.message, HttpStatus.PAYMENT_REQUIRED);
      }
      throw e;
    }

    return true;
  }
}
