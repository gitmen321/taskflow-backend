import { Injectable } from '@nestjs/common';

import { PassportStrategy } from '@nestjs/passport';

import { ExtractJwt, Strategy } from 'passport-jwt';

import { ConfigService } from '@nestjs/config';
import { JwtPayload } from '../interfaces/jwt_payload.interface';

@Injectable()
export class AccessTokenStrategy extends PassportStrategy(
    Strategy,
    'jwt-access',
) {
    constructor(config: ConfigService) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),

            secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        });
    }

    validate(payload: JwtPayload) {
        return payload;
    }
}

