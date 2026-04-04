import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { privateDecrypt } from "crypto";
import { PrismaService } from "src/prisma/prisma.service";
import ms, { StringValue } from 'ms';
import { Prisma } from '@prisma/client';

@Injectable()
export class SessionService{
    constructor (
        private readonly prisma: PrismaService,
        private readonly config: ConfigService
    ){}
     async createSession(userId: string, tx?: Prisma.TransactionClient,) {
            const expiresIn = this.config.getOrThrow<string>('JWT_REFRESH_EXPIRES_IN') as StringValue;
    
            const client = tx ?? this.prisma;
    
            return client.refreshToken.create({
                data: {
                    userId,
                    token: '',
                    expiresAt: new Date(Date.now() + ms(expiresIn)),
                }
            })
        }
    
         async revokeAllSession(userId: string) {
            return this.prisma.refreshToken.updateMany({
                where: {
                    userId,
                    revoked: false,
                },
                data: {
                    revoked: true,
                }
            });
        }
    
         async revokeSession(sessionId: string, userId: string) {
            return this.prisma.refreshToken.update({
                where: {
                    id: sessionId,
                    userId: userId
                },
                data: {
                    revoked: true,
                }
            });
        }
    
    
}