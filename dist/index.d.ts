/// <reference types="node" />
import { NextApiRequest, NextApiResponse, NextApiHandler } from "next";
import { Redis } from "ioredis";
import { UrlWithParsedQuery } from "url";
export type RateLimitOptions = {
    redisClient: Redis;
    nextApiHandler: NextApiHandler;
    makeRule: () => Promise<{
        maxCount: number;
        windowMs: number;
        redisKey?: string;
    }>;
    onBlock?: (ctx: {
        req: NextApiRequest;
        res: NextApiResponse;
        nextApiHandler: NextApiHandler;
        redisKey: string;
        redisCount: number;
        expireTimestamp: number;
    }) => Promise<void>;
    onPass?: (ctx: {
        req: NextApiRequest;
        res: NextApiResponse;
        nextApiHandler: NextApiHandler;
        redisKey: string;
        redisCount: number;
    }) => Promise<void>;
    onError?: (ctx: {
        error: Error;
        req: NextApiRequest;
        res: NextApiResponse;
        nextApiHandler: NextApiHandler;
    }) => Promise<void>;
};
export declare function getClientIp(req: NextApiRequest): string | string[] | undefined;
export declare function getUrlWithParsedQuery(req: NextApiRequest): UrlWithParsedQuery;
export declare function RateLimitWrap(options: RateLimitOptions): NextApiHandler;
//# sourceMappingURL=index.d.ts.map