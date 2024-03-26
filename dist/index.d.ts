/// <reference types="node" />
import { IncomingMessage, ServerResponse } from "http";
import { Redis } from "ioredis";
type Handler = (req: IncomingMessage, res: ServerResponse) => void | Promise<void>;
export type RateLimitOptions = {
    redisClient: Redis;
    windowMs: number;
    maxAmount: number;
    keyGenerator?: (req: IncomingMessage) => Promise<string>;
    onLimitReached?: (req: IncomingMessage, res: ServerResponse, handler: Handler, redisKey: string, redisValue: number) => Promise<void>;
};
export declare function getClientIp(req: IncomingMessage): string | string[] | undefined;
export declare function RateLimitWrap(handler: Handler, options: RateLimitOptions): Handler;
export {};
//# sourceMappingURL=index.d.ts.map