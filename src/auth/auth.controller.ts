import { Body, Controller, HttpCode, HttpStatus, Post, Get, Req, Res, UnauthorizedException, UseGuards, Query } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterUserDto } from './dto/register.dto';
import type { Response } from 'express';
import { LoginUserDto } from './dto/login.dto';
import { RefreshTokenGuard } from './guards/refresh-token.guard';
import { JwtPayload } from './interfaces/jwt_payload.interface';
import { AccessTokenGuard } from './guards/access-token.guards';
import { GetCurrentUser } from 'src/common/decorators/get-current-user.decorator';
import { GoogleAuthGuard } from './guards/google.guard';
import { CookieService } from './services/cookie.service';
import { resendVerificationDTO } from './dto/resend-verification.dto';

@Controller('auth')
export class AuthController {
    constructor(
        private authService: AuthService,
        private readonly cookieSerive: CookieService
    ) { }

    @Get("google")
    @UseGuards(GoogleAuthGuard)
    googleLogin() {

    }

    @Get("google/callback")
    @UseGuards(GoogleAuthGuard)
    async googleCallback(
        @Req() req,
        @Res({ passthrough: true }) res: Response
    ) {
        const tokens = await this.authService.googleLogin(req.user);

        this.cookieSerive.setRefreshCookie(
            res,
            tokens.refreshToken
        );
        if (process.env.NODE_ENV === 'production') {
            return res.redirect(`http://localhost:3000/oauth-success?accessToken=${tokens.accessToken}`);
        }
        return {
            accessToken: tokens.accessToken
        }

    }

    @Post("register")
    async registerUser(
        @Body() dto: RegisterUserDto,
        @Res({ passthrough: true }) res: Response,
    ) {
        const { accessToken, refreshToken } = await this.authService.registerUser(dto);
        this.cookieSerive.setRefreshCookie(res, refreshToken);

        return {
            message: "User registered successfully",
            accessToken: accessToken
        }
    }

    @Get("verify-email")
    async verifyEmail(
        @Query("token") token: string
    ){
        return this.authService.verifyEmail(token);
    }

    @Post("resend-verification")
    async resendVerification(
        @Body() dto: resendVerificationDTO,
    ){  
        return this.authService.resendVerification(dto);
    }

    @Post("login")
    @HttpCode(HttpStatus.OK)
    async loginUser(
        @Body() dto: LoginUserDto,
        @Res({ passthrough: true }) res: Response,
    ) {
        const { accessToken, refreshToken } = await this.authService.loginUser(dto);
        this.cookieSerive.setRefreshCookie(res, refreshToken);
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
        await this.cookieSerive.setRefreshCookie(res, newRefreshToken);

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
        this.cookieSerive.clearRefreshCookie(res);

        return ({
            message: "Logged out from all devices"
        });
    }

}

