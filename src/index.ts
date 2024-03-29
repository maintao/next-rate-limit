import { NextApiRequest, NextApiResponse, NextApiHandler } from "next";
import { Redis } from "ioredis"; // 使用 ioredis 的类型
import { parse } from "url";

export type RateLimitOptions = {
  redisClient: Redis;
  windowMs: number; // 单位是豪秒
  maxAmount: number;
  keyGenerator?: (req: NextApiRequest) => Promise<string>; // 根据实际上下文（ctx）类型替换 'any'
  onLimitReached?: (
    req: NextApiRequest,
    res: NextApiResponse,
    handler: NextApiHandler,
    redisKey: string,
    redisValue: number
  ) => Promise<void>;
  skip?: (req: NextApiRequest, key: string) => Promise<boolean>; // 反悔 true 则跳过限流
  // onError?: (err: Error, ctx: any, next: () => Promise<any>) => Promise<void>;
};

export function getClientIp(req: NextApiRequest) {
  const ip = req.headers["x-real-ip"] || req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  return ip;
}

const getCurrentCount = async (redisKey: string, { redisClient, windowMs }: RateLimitOptions) => {
  return new Promise<number>((resolve, reject) => {
    const lua = `
    local current
    current = tonumber(redis.call("incr", KEYS[1]))
    if current == 1 then
      redis.call("pexpire", KEYS[1], ARGV[1])
    end
    return current`;
    function errorNextApiHandler(err: Error) {
      reject(err);
    }

    redisClient.once("error", errorNextApiHandler);

    redisClient.eval(lua, 1, redisKey, windowMs, (err, result) => {
      redisClient.removeListener("error", errorNextApiHandler);
      if (err) {
        reject(err);
      } else {
        resolve(result as number);
      }
    });
  });
};

async function getKey(req: NextApiRequest, { keyGenerator }: RateLimitOptions): Promise<string> {
  let key;
  if (keyGenerator) {
    key = await keyGenerator(req);
  } else {
    // 没指定 keyGenerator，使用默认的规则：根据请求的路径和 IP 生成 key
    const ip = getClientIp(req);
    const path = parse(req.url as string, true).pathname;
    key = `next-rate-limit:path=${path}:ip=${ip}`;
  }
  console.log("next-rate-limit key:", key);
  return key;
}

export function RateLimitWrap(
  NextApiHandler: NextApiHandler,
  options: RateLimitOptions
): NextApiHandler {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const { skip, onLimitReached, maxAmount } = options;
    try {
      const key = await getKey(req, options);

      if (skip && (await skip(req, key))) {
        return await NextApiHandler(req, res); // 没有限流，调用下一层
      }

      const count = await getCurrentCount(key, options);
      if (count > maxAmount) {
        if (onLimitReached) {
          return await onLimitReached(req, res, NextApiHandler, key, count);
        } else {
          res.status(429).json({ code: 1, errMsg: "Too many requests" });
        }
      } else {
        return await NextApiHandler(req, res); // 没有限流，调用下一层
      }
    } catch (error) {}
  };
}
