import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import ms, { StringValue } from 'ms';
import type { Response } from 'express';


@Injectable()
export class CookieService{
    constructor(
        private readonly config: ConfigService
    ){}
    
            async setRefreshCookie(res: Response, token: string) {
    
            const expiresIn = this.config.getOrThrow<string>('JWT_REFRESH_EXPIRES_IN') as StringValue;
    
            res.cookie('refreshToken', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: ms(expiresIn),
            });
        }
    
        clearRefreshCookie(res: Response) {
            res.clearCookie("refreshToken");
        }
}
