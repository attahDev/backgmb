import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';

/**
 * Gates endpoints that are called server-to-server by our own trusted
 * services (the Market Research / Pitch Deck / Proposal Builder FastAPI
 * tools) rather than by a logged-in user's browser — so JwtAuthGuard
 * doesn't apply here. Callers authenticate with a shared secret in the
 * `X-Internal-Secret` header instead of a user's bearer token.
 */
@Injectable()
export class InternalServiceGuard implements CanActivate {
  private readonly logger = new Logger(InternalServiceGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const secret = process.env.INTERNAL_ACTIVITY_SECRET;
    if (!secret) {
      // Fail closed: never accept requests as "authenticated" just because
      // the operator forgot to configure the shared secret in this env.
      this.logger.error('INTERNAL_ACTIVITY_SECRET is not set — refusing internal request');
      throw new ServiceUnavailableException('Internal logging is not configured');
    }

    const request = context.switchToHttp().getRequest();
    const provided = request.headers['x-internal-secret'];

    if (provided !== secret) {
      throw new UnauthorizedException('Invalid internal service credentials');
    }

    return true;
  }
}
