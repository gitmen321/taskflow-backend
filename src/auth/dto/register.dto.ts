import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';


export class RegisterUserDto {
    @IsString()
    @IsNotEmpty()
    @Transform(({ value }) => value?.trim())
    name: string;

    @IsEmail()
    @Transform(({ value }) => value?.toLowerCase().trim()) 
    email: string;

    @IsString()
    @MinLength(8, { message: 'Password must be at least 8 characters long' })
    password: string;

}