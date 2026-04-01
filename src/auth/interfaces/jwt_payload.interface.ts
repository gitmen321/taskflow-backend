export interface JwtPayload{
    sub: string,
    sessionId: string,
    refreshToken: string
}