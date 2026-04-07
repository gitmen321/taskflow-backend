import { IsEmail } from "class-validator";
import { Transform } from 'class-transformer';

export class resendVerificationDTO {
    @IsEmail()
    @Transform(({ value }) => value?.toLowerCase().trim())
    email: string;
}