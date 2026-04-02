import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy, Profile } from "passport-google-oauth20";


@Injectable()
export class GoogleStrategy extends PassportStrategy(
    Strategy,
    "google"
) {
    constructor(config: ConfigService) {
        super({
            clientID: config.getOrThrow("GOOGLE_CLIENT_ID"),
            clientSecret: config.getOrThrow("GOOGLE_CLIENT_SECRET"),
            callbackURL: config.getOrThrow("GOOGLE_CALL_BACK_URL"),
            scope: ["email", "profile"],
        });
    }

    async validate(
        accessToken: string,
        refreshToken: string,
        profle: Profile
    ) {
        return {
            provider: "GOOGLE",
            providerId: profle.id,
            email: profle.emails?.[0].value,
            name: profle.displayName,
        };
    }
}