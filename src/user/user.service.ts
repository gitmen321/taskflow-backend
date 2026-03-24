import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UserService {
    constructor(private prisma: PrismaService) { }

    async createUser(dto: CreateUserDto) {
        return this.prisma.user.create({
            data: dto,
        });
    }

    async getAllUsers() {
        return this.prisma.user.findMany();
    }
}
