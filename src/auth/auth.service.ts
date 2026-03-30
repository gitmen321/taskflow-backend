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
        tx: Prisma.TransactionClient,
        sessionId: string,
        refreshToken: string,
    ) {
        const hashedToken = await argon2.hash(refreshToken);

        return tx.refreshToken.update({
            where: { id: sessionId },
            data: { token: hashedToken },
        });
    }

    private async createSession(tx: Prisma.TransactionClient, userId: string) {
        const expiresIn = this.config.getOrThrow<string>('JWT_REFRESH_EXPIRES_IN') as StringValue;

        return tx.refreshToken.create({
            data: {
                userId,
                token: '',
                expiresAt: new Date(Date.now() + ms(expiresIn)),
            }
        })
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

    async registerUser(dto: RegisterUserDto) {
        const userData = dto;

        const existingUser = await this.prisma.user.findUnique({
            where: {
                email: userData.email,
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

            const newUser = await this.prisma.user.create({
                data: {
                    ...userData,
                    password: hashedPassword,
                    provider: AuthProvider.LOCAL,
                }
            });

            const refreshSession = await this.createSession(tx, newUser.id,);

            const refreshToken = await this.generateRefreshToken(
                newUser.id,
                refreshSession.id
            );

            await this.storeRefreshTokenHash(tx, refreshSession.id, refreshToken);

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

            const refreshSession = await this.createSession(tx, userData.id);
            const refreshToken = await this.generateRefreshToken(userData.id, refreshSession.id);
            const accessToken = await this.generateAccessToken(userData.id, refreshSession.id);
            await this.storeRefreshTokenHash(tx, refreshSession.id, refreshToken);

            if (process.env.NODE_ENV !== 'production') console.log(`refreshToken: ${refreshToken}`);

            return { accessToken, refreshToken };
        });

    }
}

