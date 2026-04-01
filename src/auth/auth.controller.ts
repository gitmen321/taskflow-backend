import { Body, Controller, Post, Req, Res, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterUserDto } from './dto/register.dto';
import type { Response } from 'express';
import { LoginUserDto } from './dto/login.dto';
import { RefreshTokenGuard } from './guards/refresh-token.guard';
import { JwtPayload } from './interfaces/jwt_payload.interface';

@Controller('auth')
export class AuthController {
    constructor(
        private authService: AuthService) { }

    @Post("register")
    async registerUser(
        @Body() dto: RegisterUserDto,
        @Res({ passthrough: true }) res: Response,
    ) {
        const { accessToken, refreshToken } = await this.authService.registerUser(dto);
        this.authService.setRefreshCookie(res, refreshToken);

        return {
            message: "User registered successfully",
            accessToken: accessToken
        }
    }

    @Post("login")
    async loginUser(
        @Body() dto: LoginUserDto,
        @Res({ passthrough: true }) res: Response,
    ) {
        const { accessToken, refreshToken } = await this.authService.loginUser(dto);
        this.authService.setRefreshCookie(res, refreshToken);
        return {
            message: "User logged in successfully",
            accessToken: accessToken
        }
    }

    @Post("refresh")
    @UseGuards(RefreshTokenGuard)
    async refreshTokens(
        @Req() req: Request & { user: JwtPayload },
        @Res({ passthrough: true }) res: Response,
    ) {
        const payload = req.user;

        const { accessToken, newRefreshToken } = await this.authService.refreshTokens(payload);
        await this.authService.setRefreshCookie(res, newRefreshToken);

        return {
            accessToken
        }
    }
}
