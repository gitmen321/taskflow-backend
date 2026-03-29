import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RegisterUserDto } from './dto/register.dto';
import * as argon2 from "argon2";
import { AuthProvider } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import ms from 'ms';

@Injectable()
export class AuthService {
    constructor(private prisma: PrismaService,
        private jwtService: JwtService,
        private config: ConfigService
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
            expiresIn: this.config.getOrThrow<string>('JWT_REFRESH_EXPIRES_IN') as any,
        }
        );
    }

    private async storeRefreshToken(
        userId: string,
        refreshToken: string,
    ) {
        const hashedToken = await argon2.hash(refreshToken);
        const expiresIn = this.config.getOrThrow<string>('JWT_REFRESH_EXPIRES_IN')as any
        return this.prisma.refreshToken.create({
            data: {
                userId,
                token: hashedToken,
                expiresAt: new Date(Date.now() + ms(expiresIn)),
            },
        });
    }


    async registerUser(dto: RegisterUserDto) {
        const { email, password, confirmPassword, ...rest } = dto;

        const existingUser = await this.prisma.user.findUnique({
            where: {
                email
            }
        });

        if (existingUser) {
            throw new ConflictException("EMAIL_ALREADY_EXISTED");
        }

        const hashedPassword = await argon2.hash(password, {
            type: argon2.argon2id,
            memoryCost: 65536,
            timeCost: 3,
            parallelism: 4,
        });

        const newUser = await this.prisma.user.create({
            data: {
                ...rest,
                email,
                password: hashedPassword,
                provider: AuthProvider.LOCAL,
            }
        });

        const refreshSession = await this.storeRefreshToken(
            newUser.id,
            'temp'
        );

        const refreshToken = await this.generateRefreshToken(
            newUser.id,
            refreshSession.id
        );

        await this.prisma.refreshToken.update({
            where: { id: refreshSession.id },
            data: {
                token: await argon2.hash(refreshToken),
            }
        });

        const accessToken = await this.generateAccessToken(
            newUser.id,
            refreshSession.id
        );

        return {
            message: "User registered successfully",
            data: accessToken
        };
    }
}

