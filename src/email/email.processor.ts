import { Processor, WorkerHost } from "@nestjs/bullmq";
import { EmailService } from "./email.service";
import { Job } from "bullmq";

@Processor("email")
export class EmailProcessor extends WorkerHost {
    constructor(
        private readonly emailService: EmailService
    ) {
        super();
    }
    async process(job: Job) {
        console.log("EMAIL JOB RECEIVED.", job.name, job.data);

        switch (job.name) {
            case "sendVerificationEmail":
                console.log("Sendng email to:", job.data.email);

                await this.emailService.sendVerificationEmail( 
                    job.data.email,
                    job.data.token
                );
                console.log("email sending request completed");
                break;
        }

    }
}
