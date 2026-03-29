import { Injectable, Req } from '@nestjs/common';

import { PassportStrategy } from '@nestjs/passport';

import { ExtractJwt, Strategy } from 'passport-jwt';

import { Request } from 'express';

import { ConfigService } from '@nestjs/config';

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => req?.cookies?.refreshToken,
      ]),

      secretOrKey: config.getOrThrow<string>('JWT_REFRESH_SECRET'),

      passReqToCallback: true
    });
  }

  validate(req: Request, payload: any) {
    return {
      ...payload,
      refreshToken: req.cookies.refreshToken,
    };
  }
}
