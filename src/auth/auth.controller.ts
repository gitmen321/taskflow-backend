import { Body, Controller, Post, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterUserDto } from './dto/register.dto';
import type { Response } from 'express';
import { LoginUserDto } from './dto/login.dto';

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
}
