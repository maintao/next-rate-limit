import { IncomingMessage, ServerResponse } from "http";
import { Redis } from "ioredis"; // 使用 ioredis 的类型
import { parse } from "url";

type Handler = (req: IncomingMessage, res: ServerResponse) => void | Promise<void>;

export type RateLimitOptions = {
  redisClient: Redis;
  windowMs: number; // 单位是豪秒
  maxAmount: number;
  keyGenerator?: (req: IncomingMessage) => Promise<string>; // 根据实际上下文（ctx）类型替换 'any'
  onLimitReached?: (
    req: IncomingMessage,
    res: ServerResponse,
    handler: Handler,
    redisKey: string,
    redisValue: number
  ) => Promise<void>;
  // onError?: (err: Error, ctx: any, next: () => Promise<any>) => Promise<void>;
  // skip?: (ctx: any) => Promise<boolean>;
};

export function getClientIp(req: IncomingMessage) {
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
    function errorHandler(err: Error) {
      reject(err);
    }

    redisClient.once("error", errorHandler);

    redisClient.eval(lua, 1, redisKey, windowMs, (err, result) => {
      redisClient.removeListener("error", errorHandler);
      if (err) {
        reject(err);
      } else {
        resolve(result as number);
      }
    });
  });
};

async function getKey(req: IncomingMessage, { keyGenerator }: RateLimitOptions): Promise<string> {
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

export function RateLimitWrap(handler: Handler, options: RateLimitOptions): Handler {
  return async (req: IncomingMessage, res: ServerResponse) => {
    try {
      const key = await getKey(req, options);
      const count = await getCurrentCount(key, options);
      if (count > options.maxAmount) {
        if (options.onLimitReached) {
          await options.onLimitReached(req, res, handler, key, count);
        } else {
          res.statusCode = 429;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ code: 1, errMsg: "too many requests" }));
        }
      } else {
        await handler(req, res); // 没有限流，调用下一层
      }
    } catch (error) {}
  };
}
