import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    // 1. Retrieve the secret using the argument 'configService' (NOT 'this.configService')
    const secret = configService.get<string>('JWT_SECRET');

    // 2. Add a runtime check for safety
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is not defined.');
    }

    // 3. Call super() FIRST, passing the guaranteed string value
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: any) {
    // Same tradeoff RolesGuard makes for role checks: one extra lookup per
    // request buys immediate effect when admin deactivates someone, instead
    // of the account staying usable until the token naturally expires (7d).
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { isActive: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    return {
      userId: payload.sub,
      email: payload.email,
    };
  }
}
