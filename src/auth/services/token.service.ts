import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "src/prisma/prisma.service";
import ms, { StringValue } from 'ms';
import { Prisma } from '@prisma/client';



@Injectable()
export class TokenService {

    constructor(
        private readonly jwtService: JwtService,
        private readonly config: ConfigService,
        private readonly prisma: PrismaService
    ){ }
    
         async generateAccessToken(
            userId: string,
            sessionId: string
        ) {
            const payload = {
                sub: userId,
                sessionId
            };
            return this.jwtService.signAsync(payload);
        }
    
         async generateRefreshToken(
            userId: string,
            sessionId: string,
        ) {
            const payload = {
                sub: userId,
                sessionId,
            };
            return this.jwtService.signAsync(payload, {
                secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
                expiresIn: this.config.getOrThrow<string>('JWT_REFRESH_EXPIRES_IN') as StringValue,
            }
            );
        }
    
         async storeRefreshTokenHash(
            sessionId: string,
            refreshToken: string,
            tx?: Prisma.TransactionClient,
        ) {
            const client = tx ?? this.prisma;
    
            return client.refreshToken.update({
                where: { id: sessionId },
                data: { token: refreshToken },
            });
        }
}