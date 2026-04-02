import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RegisterUserDto } from './dto/register.dto';
import * as argon2 from "argon2";
import { AuthProvider, Prisma } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import ms, { StringValue } from 'ms';
import type { Response } from 'express';
import { LoginUserDto } from './dto/login.dto';
import { DUMMY_HASH } from 'src/common/constants/constants';

@Injectable()
export class AuthService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly jwtService: JwtService,
        private readonly config: ConfigService
    ) { }

    private async generateAccessToken(
        userId: string,
        sessionId: string
    ) {
        const payload = {
            sub: userId,
            sessionId
        };
        return this.jwtService.signAsync(payload);
    }

    private async generateRefreshToken(
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

    private async storeRefreshTokenHash(
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

    private async createSession(userId: string, tx?: Prisma.TransactionClient,) {
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

    private async revokeAllSession(userId: string) {
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

    private async revokeSession(sessionId: string, userId: string) {
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

    async registerUser(dto: RegisterUserDto) {
        const userData = dto;

        const existingUser = await this.prisma.user.findUnique({
            where: {
                email: userData.email,
            },
            select: {
                id: true,
            }
        });

        if (existingUser) {
            throw new ConflictException("EMAIL_ALREADY_EXISTED");
        }

        const hashedPassword = await argon2.hash(userData.password, {
            type: argon2.argon2id,
            memoryCost: 65536,
            timeCost: 3,
            parallelism: 4,
        });


        return await this.prisma.$transaction(async (tx) => {

            const newUser = await tx.user.create({
                data: {
                    ...userData,
                    password: hashedPassword,
                    provider: AuthProvider.LOCAL,
                },
                select: {
                    id: true,
                }
            });

            const refreshSession = await this.createSession(newUser.id, tx);

            const refreshToken = await this.generateRefreshToken(
                newUser.id,
                refreshSession.id
            );
            const hashedToken = await argon2.hash(refreshToken);

            await this.storeRefreshTokenHash(refreshSession.id, hashedToken, tx);

            const accessToken = await this.generateAccessToken(
                newUser.id,
                refreshSession.id
            );

            if (process.env.NODE_ENV !== 'production') console.log(`refreshToken: ${refreshToken}`);

            return { accessToken, refreshToken }

        });

    }

    async loginUser(dto: LoginUserDto) {

        const user = await this.prisma.user.findUnique({
            where: {
                email: dto.email,
            },
            select: {
                id: true,
                email: true,
                password: true,
                provider: true,
            }
        });

        const isLocal = user?.provider === AuthProvider.LOCAL;
        const hashToVerify = (isLocal && user.password) || DUMMY_HASH;

        const isPasswordValid = await argon2.verify(hashToVerify, dto.password);

        if (!user || !isLocal || !isPasswordValid) {
            throw new UnauthorizedException("INVALID_CREDENTIALS");
        }

        const { password: _, ...userData } = user;

        return await this.prisma.$transaction(async (tx) => {

            const refreshSession = await this.createSession(userData.id, tx);
            const refreshToken = await this.generateRefreshToken(userData.id, refreshSession.id);
            const accessToken = await this.generateAccessToken(userData.id, refreshSession.id);

            const hashedToken = await argon2.hash(refreshToken);
            await this.storeRefreshTokenHash(refreshSession.id, hashedToken, tx);

            if (process.env.NODE_ENV !== 'production') console.log(`refreshToken: ${refreshToken}`);

            return { accessToken, refreshToken };
        });
    }

    async refreshTokens(
        userId: string,
        sessionId: string,
        refreshToken: string

    ) {

        const session = await this.prisma.refreshToken.findUnique({
            where: { id: sessionId },
            select: {
                token: true,
                id: true,
                revoked: true,
                expiresAt: true,
            }
        });

        if (!session || session.revoked) {
            await this.revokeAllSession(userId);
            console.log("session or token revoked");
            throw new UnauthorizedException('REFRESH_TOKEN_REUSE_DETECTED',);
        }

        const isTokenValid = await argon2.verify(session.token, refreshToken);

        if (!isTokenValid) {
            await this.revokeAllSession(userId);
            console.log("invalid token");
            throw new UnauthorizedException('REFRESH_TOKEN_REUSE_DETECTED');
        }

        if (session.expiresAt < new Date()) {
            await this.revokeSession(sessionId, userId);
            throw new UnauthorizedException('REFRESH_TOKEN_EXPIRED');
        }


        const newRefreshToken = await this.generateRefreshToken(userId, sessionId);

        const hashedToken = await argon2.hash(newRefreshToken);

        await this.storeRefreshTokenHash(sessionId, hashedToken);

        const accessToken = await this.generateAccessToken(userId, sessionId);

        if (process.env.NODE_ENV !== 'production') console.log(`new refreshToken: ${newRefreshToken}`);

        return {
            accessToken,
            newRefreshToken
        }
    }

    async logOut(sessionId: string, userId: string) {
        return await this.revokeSession(sessionId, userId);
    }

    async logoutAll(userId: string) {
        return await this.revokeAllSession(userId);
    }

    async googleLogin(profile: {
        email: string,
        providerId: string,
        provider: "GOOGLE",
        name: string
    }) {
        let user = await this.prisma.user.findUnique({
            where: { email: profile.email },
            select: {
                id: true,
                email: true,
                provider: true,
                providerId: true,
            }
        });

        if (!user) {
            user = await this.prisma.user.create({
                data: {
                    name: profile.name,
                    email: profile.email,
                    provider: profile.provider,
                    providerId: profile.providerId,
                },
            });
        }
        
        const session = await this.createSession(user.id);

        const refreshToken = await this.generateRefreshToken(user.id, session.id);

        await this.storeRefreshTokenHash(session.id, refreshToken);

        const accessToken = await this.generateAccessToken(user.id, session.id);

        return {
            accessToken, refreshToken
        }
    }
}

