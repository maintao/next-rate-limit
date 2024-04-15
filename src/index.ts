import { NextApiRequest, NextApiResponse, NextApiHandler } from "next";
import { Redis } from "ioredis"; // 使用 ioredis 的类型
import { UrlWithParsedQuery, parse } from "url";

export type RateLimitOptions = {
  redisClient: Redis;
  nextApiHandler: NextApiHandler;
  defaultKeyPrefix?: string;

  // 用户需要主动调用这个函数，返回限流规则，限流规则须包含指定字段
  makeRule: () => Promise<{
    maxCount: number;
    windowMs: number; // 单位是豪秒
    redisKey?: string;
  }>;

  onBlock?: (ctx: {
    req: NextApiRequest;
    res: NextApiResponse;
    nextApiHandler: NextApiHandler;
    redisKey: string;
    redisCount: number;
    expireTimestamp: number; // 到这个时间又可以访问了
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

export function getClientIp(req: NextApiRequest) {
  const ip = req.headers["x-real-ip"] || req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  return ip;
}

export function getUrlWithParsedQuery(req: NextApiRequest): UrlWithParsedQuery {
  return parse(req.url as string, true);
}

const getCurrentCount = async (redisClient: Redis, redisKey: string, windowMs: number) => {
  return new Promise<number>((resolve, reject) => {
    const lua = `
    local count
    count = tonumber(redis.call("incr", KEYS[1]))
    if count == 1 then
      redis.call("pexpire", KEYS[1], ARGV[1])
    end
    return count`;

    redisClient.eval(lua, 1, redisKey, windowMs, (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result as number);
      }
    });
  });
};

function defaultKey(req: NextApiRequest, { defaultKeyPrefix }: RateLimitOptions): string {
  const ip = getClientIp(req);
  const path = parse(req.url as string, true).pathname;
  let key = `next-rate-limit:path=${path}:ip=${ip}`;
  if (defaultKeyPrefix) {
    key = `${defaultKeyPrefix}:${key}`;
  }
  return key;
}

export function RateLimitWrap(options: RateLimitOptions): NextApiHandler {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const { redisClient, nextApiHandler, makeRule, onBlock, onPass, onError } = options;

    try {
      let { maxCount, windowMs, redisKey } = await makeRule();
      if (!redisKey) {
        redisKey = defaultKey(req, options);
      }
      console.log("next-rate-limit redisKey:", redisKey);

      const redisCount = await getCurrentCount(redisClient, redisKey, windowMs);
      if (redisCount > maxCount) {
        const ttlMs = await redisClient.pttl(redisKey); // 还有多少毫秒过期
        const expireTimestamp = Date.now() + ttlMs;
        if (onBlock) {
          return await onBlock({ req, res, redisKey, redisCount, nextApiHandler, expireTimestamp });
        } else {
          res.status(429).json({ code: 1, errMsg: "Too many requests" });
        }
      } else {
        if (onPass) {
          return await onPass({
            req,
            res,
            nextApiHandler,
            redisKey,
            redisCount,
          });
        } else {
          return await nextApiHandler(req, res); //  没到上限，放行
        }
      }
    } catch (e) {
      if (onError) {
        const error = e as Error;
        return await onError({ error, req, res, nextApiHandler });
      } else {
        res.status(500).json({ code: 1, errMsg: "Internal Server Error" });
      }
    }
  };
}
