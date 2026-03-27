import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from "passport-jwt";




@Injectable()
export class AccessTokenStrategy extends PassportStrategy(
    Strategy,
    'Jwt-access',
) {
    constructor(config: ConfigService) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),

            secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SCRET'),
        });
    }

    validate(payload: any) {
        return payload;
    }
}