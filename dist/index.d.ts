import { NextApiRequest, NextApiResponse, NextApiHandler } from "next";
import { Redis } from "ioredis";
export type RateLimitOptions = {
    redisClient: Redis;
    windowMs: number;
    maxAmount: number;
    keyGenerator?: (req: NextApiRequest) => Promise<string>;
    onLimitReached?: (req: NextApiRequest, res: NextApiResponse, handler: NextApiHandler, redisKey: string, redisValue: number) => Promise<void>;
    skip?: (req: NextApiRequest, key: string) => Promise<boolean>;
};
export declare function getClientIp(req: NextApiRequest): string | string[] | undefined;
export declare function RateLimitWrap(NextApiHandler: NextApiHandler, options: RateLimitOptions): NextApiHandler;
//# sourceMappingURL=index.d.ts.map