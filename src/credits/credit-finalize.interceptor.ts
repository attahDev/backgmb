import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { CreditsService, CreditReservation } from './credits.service';

/** Pairs with CreditGuard: the guard reserves credits and stashes the
 *  reservation on request.creditReservation before the handler runs; this
 *  interceptor commits it on success or refunds it if the handler throws.
 *  Routes the guard let through untouched (no @RequireCredits) have no
 *  reservation, so this is a no-op for them. */
@Injectable()
export class CreditFinalizeInterceptor implements NestInterceptor {
  constructor(private readonly credits: CreditsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const reservation: CreditReservation | undefined =
      request.creditReservation;

    if (!reservation) return next.handle();

    return next.handle().pipe(
      tap(() => {
        void this.credits.commit(reservation);
      }),
      catchError((err) => {
        void this.credits.refund(reservation);
        throw err;
      }),
    );
  }
}
