"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimitWrap = exports.getUrlWithParsedQuery = exports.getClientIp = void 0;
const url_1 = require("url");
function getClientIp(req) {
    const ip = req.headers["x-real-ip"] || req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    return ip;
}
exports.getClientIp = getClientIp;
function getUrlWithParsedQuery(req) {
    return (0, url_1.parse)(req.url, true);
}
exports.getUrlWithParsedQuery = getUrlWithParsedQuery;
const getCurrentCount = (redisClient, redisKey, windowMs) => __awaiter(void 0, void 0, void 0, function* () {
    return new Promise((resolve, reject) => {
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
            }
            else {
                resolve(result);
            }
        });
    });
});
function defaultKey(req) {
    const ip = getClientIp(req);
    const path = (0, url_1.parse)(req.url, true).pathname;
    const key = `next-rate-limit:path=${path}:ip=${ip}`;
    return key;
}
function RateLimitWrap(options) {
    return (req, res) => __awaiter(this, void 0, void 0, function* () {
        const { redisClient, nextApiHandler, makeRule, onBlock, onPass, onError } = options;
        try {
            let { maxCount, windowMs, redisKey } = yield makeRule();
            if (!redisKey) {
                redisKey = defaultKey(req);
            }
            console.log("next-rate-limit redisKey:", redisKey);
            const redisCount = yield getCurrentCount(redisClient, redisKey, windowMs);
            if (redisCount > maxCount) {
                const ttlMs = yield redisClient.pttl(redisKey); // 还有多少毫秒过期
                const expireTimestamp = Date.now() + ttlMs;
                if (onBlock) {
                    return yield onBlock({ req, res, redisKey, redisCount, nextApiHandler, expireTimestamp });
                }
                else {
                    res.status(429).json({ code: 1, errMsg: "Too many requests" });
                }
            }
            else {
                if (onPass) {
                    return yield onPass({
                        req,
                        res,
                        nextApiHandler,
                        redisKey,
                        redisCount,
                    });
                }
                else {
                    return yield nextApiHandler(req, res); //  没到上限，放行
                }
            }
        }
        catch (e) {
            if (onError) {
                const error = e;
                return yield onError({ error, req, res, nextApiHandler });
            }
            else {
                res.status(500).json({ code: 1, errMsg: "Internal Server Error" });
            }
        }
    });
}
exports.RateLimitWrap = RateLimitWrap;
//# sourceMappingURL=index.js.map