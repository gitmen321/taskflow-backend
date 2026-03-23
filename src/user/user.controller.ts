import { Body, Controller, Post, Get } from '@nestjs/common';
import { UserService } from './user.service';

@Controller('user')
export class UserController {
    constructor(private userService: UserService) { }

    @Post()
    createUser(@Body() body: any) {
        return this.userService.createUser(body);
    }

    @Get()
    getUsers() {
        return this.userService.getAllUsers();
    }
}
