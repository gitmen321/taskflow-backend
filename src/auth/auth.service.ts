import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RegisterUserDto } from './dto/register.dto';
import * as argon2 from "argon2";
import { AuthProvider, Prisma } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { LoginUserDto } from './dto/login.dto';
import { DUMMY_HASH } from 'src/common/constants/constants';
import { TokenService } from './services/token.service';
import { SessionService } from './services/session.service';
import { generateEmailVerificationToken } from './helpers/email.token.helper';

@Injectable()
export class AuthService {
    constructor(
        private tokenService: TokenService,
        private readonly prisma: PrismaService,
        private readonly jwtService: JwtService,
        private readonly config: ConfigService,
        private readonly sessionService: SessionService
    ) { }


    async registerUser(dto: RegisterUserDto) {

        const emailToken =  generateEmailVerificationToken();
        const hashedEmailToken = await argon2.hash(emailToken);

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

            await tx.emailVerification.create({
                data: {
                userId: newUser.id,
                 tokenHash: hashedEmailToken,
                 expiresAt: new Date(Date.now() + 1000 * 60 * 15),
                },
                select: {
                    id: true,
                    tokenHash: true,
                }
            })

            const refreshSession = await this.sessionService.createSession(newUser.id, tx);

            const refreshToken = await this.tokenService.generateRefreshToken(
                newUser.id,
                refreshSession.id
            );
            const hashedToken = await argon2.hash(refreshToken);

            await this.tokenService.storeRefreshTokenHash(refreshSession.id, hashedToken, tx);

            const accessToken = await this.tokenService.generateAccessToken(
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

            const refreshSession = await this.sessionService.createSession(userData.id, tx);
            const refreshToken = await this.tokenService.generateRefreshToken(userData.id, refreshSession.id);
            const accessToken = await this.tokenService.generateAccessToken(userData.id, refreshSession.id);

            const hashedToken = await argon2.hash(refreshToken);
            await this.tokenService.storeRefreshTokenHash(refreshSession.id, hashedToken, tx);

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
            await this.sessionService.revokeAllSession(userId);
            console.log("session or token revoked");
            throw new UnauthorizedException('REFRESH_TOKEN_REUSE_DETECTED',);
        }

        const isTokenValid = await argon2.verify(session.token, refreshToken);

        if (!isTokenValid) {
            await this.sessionService.revokeAllSession(userId);
            console.log("invalid token");
            throw new UnauthorizedException('REFRESH_TOKEN_REUSE_DETECTED');
        }

        if (session.expiresAt < new Date()) {
            await this.sessionService.revokeSession(sessionId, userId);
            throw new UnauthorizedException('REFRESH_TOKEN_EXPIRED');
        }


        const newRefreshToken = await this.tokenService.generateRefreshToken(userId, sessionId);

        const hashedToken = await argon2.hash(newRefreshToken);

        await this.tokenService.storeRefreshTokenHash(sessionId, hashedToken);

        const accessToken = await this.tokenService.generateAccessToken(userId, sessionId);

        if (process.env.NODE_ENV !== 'production') console.log(`new refreshToken: ${newRefreshToken}`);

        return {
            accessToken,
            newRefreshToken
        }
    }

    async logOut(sessionId: string, userId: string) {
        return await this.sessionService.revokeSession(sessionId, userId);
    }

    async logoutAll(userId: string) {
        return await this.sessionService.revokeAllSession(userId);
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
        
        const session = await this.sessionService.createSession(user.id);

        const refreshToken = await this.tokenService.generateRefreshToken(user.id, session.id);

        await this.tokenService.storeRefreshTokenHash(session.id, refreshToken);

        const accessToken = await this.tokenService.generateAccessToken(user.id, session.id);

        return {
            accessToken, refreshToken
        }
    }
}

