import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';

import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AccessTokenStrategy } from './guards/access-token.guards';
import { RefreshTokenStrategy } from './guards/refresh-token.guard';


@Module({
  imports: [
    ConfigModule,

    JwtModule.registerAsync({
      inject: [ConfigService],

      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET') ,

        signOptions: {
          expiresIn: config.getOrThrow<string>('JWT_EXPIRES_IN') as any ,
        },
      }),
    }),
  ],
  controllers: [AuthController],

  providers: [
    AuthService,
    AccessTokenStrategy,
    RefreshTokenStrategy,
  ],
})
export class AuthModule { }
