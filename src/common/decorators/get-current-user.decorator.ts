import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export const GetCurrentUser = createParamDecorator(
    (_, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest();
        
        if (!request.user) return null;
        return {
            sub: request.user?.sub,
            sessionId: request.user?.sessionId,
            refreshToken: request.user?.refreshToken
        };
    }
);  

