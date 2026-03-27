import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RegisterUserDto } from './dto/register.dto';
import * as argon2 from "argon2";
import { AuthProvider } from '@prisma/client';


@Injectable()
export class AuthService {
    constructor(private prisma: PrismaService) { }

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

        return {
            message: "User registered successfully",
            user: {
                id: newUser.id,
                email: newUser.email,
                name: newUser.name,
            }

        };
    }
}

