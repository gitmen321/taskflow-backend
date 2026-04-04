import * as crypto from "crypto";


export function generateEmailVerificationToken() {

    return crypto.randomBytes(32).toString("hex");
}