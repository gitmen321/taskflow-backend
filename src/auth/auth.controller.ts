import { Body, Controller, HttpCode, HttpStatus, Post, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterUserDto } from './dto/register.dto';
import type { Response } from 'express';
import { LoginUserDto } from './dto/login.dto';
import { RefreshTokenGuard } from './guards/refresh-token.guard';
import { JwtPayload } from './interfaces/jwt_payload.interface';
import { AccessTokenGuard } from './guards/access-token.guards';
import { GetCurrentUser } from 'src/common/decorators/get-current-user.decorator';

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
    @HttpCode(HttpStatus.OK)
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
    @HttpCode(HttpStatus.OK)
    @UseGuards(RefreshTokenGuard)
    async refreshTokens(
        @GetCurrentUser() user: { sub: string; sessionId: string; refreshToken: string },
        @Res({ passthrough: true }) res: Response,
    ) {

        const { accessToken, newRefreshToken } = await this.authService.refreshTokens(user.sub, user.sessionId, user.refreshToken);
        await this.authService.setRefreshCookie(res, newRefreshToken);

        return {
            accessToken
        }
    }

    @Post("logout")
    @HttpCode(HttpStatus.NO_CONTENT)
    @UseGuards(AccessTokenGuard)
    async logOut(
        @GetCurrentUser() user: { sub: string; sessionId: string },
        @Res({ passthrough: true }) res: Response,
    ) {
        await this.authService.logOut(user.sessionId, user.sub);
        res.clearCookie("refreshToken");

        return ({
            message: "Loggedout Successfully"
        });
    }

    @Post("logout-all")
    @HttpCode(HttpStatus.NO_CONTENT)
    @UseGuards(AccessTokenGuard)
    async logoutAll(
        @GetCurrentUser() user: { sub: string },
        @Res({ passthrough: true }) res: Response,
    ) {

        await this.authService.logoutAll(user.sub);
        this.authService.clearRefreshCookie(res);

        return ({
            message: "Logged out from all devices"
        });
    }
}

