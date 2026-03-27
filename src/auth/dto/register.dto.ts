import {IsEmail, IsNotEmpty, IsString, MinLength} from 'class-validator';
import { Match } from 'src/common/decorators/match.decorator';

export class RegisterUserDto {
    @IsString()
    name: string;

    @IsEmail()
    email: string;

    @IsString()
    @IsNotEmpty()
    @MinLength(8)
    password: string;

    @IsString()
    @MinLength(8)
    @Match('password', {
        message: 'Password do not match',
    })
    confirmPassword: string;
}