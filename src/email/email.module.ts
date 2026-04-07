import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailProcessor } from './email.processor';

@Module({
    imports: [
        BullModule.registerQueue({
            name: "email"
        }),
    ],
    providers: [
        EmailProcessor, EmailService],
    exports: [EmailService, BullModule],

})
export class EmailModule { }
