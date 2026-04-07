import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Resend } from "resend";

@Injectable()
export class EmailService {
    private resend = new Resend;

    constructor(private config: ConfigService) {
        this.resend = new Resend(
            this.config.getOrThrow<string>("RESEND_API_KEY"),
        )
    }

    async sendVerificationEmail(
        email: string,
        token: string,
    ) {
        console.log("Resend initialised successfully");

        const verificationUrl = `${this.config.get("FRONTEND_URL")}/verify_email>token=${token}`;

        console.log('verification token:', token); 


        const recipient = this.config.get("NODE_ENV") === "production" ? email : this.config.get("EMAIL_SANDBOX_RECIPIENT");


        console.log("Sending Verification Email");


        await this.resend.emails.send({
            //from: "TaskFlow <no-reply@taskflow.app>",
            from: "onboarding@resend.dev",
            to: recipient,
            subject: "verify yout Email",
            html: `
            <p>Click below to verify your email: </p>
            <a href="${verificationUrl}">
            Verify Email
            </a>
            `,
        });
    }
}