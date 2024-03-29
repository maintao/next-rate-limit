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
exports.RateLimitWrap = exports.getClientIp = void 0;
const url_1 = require("url");
function getClientIp(req) {
    const ip = req.headers["x-real-ip"] || req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    return ip;
}
exports.getClientIp = getClientIp;
const getCurrentCount = (redisKey, { redisClient, windowMs }) => __awaiter(void 0, void 0, void 0, function* () {
    return new Promise((resolve, reject) => {
        const lua = `
    local current
    current = tonumber(redis.call("incr", KEYS[1]))
    if current == 1 then
      redis.call("pexpire", KEYS[1], ARGV[1])
    end
    return current`;
        function errorNextApiHandler(err) {
            reject(err);
        }
        redisClient.once("error", errorNextApiHandler);
        redisClient.eval(lua, 1, redisKey, windowMs, (err, result) => {
            redisClient.removeListener("error", errorNextApiHandler);
            if (err) {
                reject(err);
            }
            else {
                resolve(result);
            }
        });
    });
});
function getKey(req, { keyGenerator }) {
    return __awaiter(this, void 0, void 0, function* () {
        let key;
        if (keyGenerator) {
            key = yield keyGenerator(req);
        }
        else {
            // 没指定 keyGenerator，使用默认的规则：根据请求的路径和 IP 生成 key
            const ip = getClientIp(req);
            const path = (0, url_1.parse)(req.url, true).pathname;
            key = `next-rate-limit:path=${path}:ip=${ip}`;
        }
        console.log("next-rate-limit key:", key);
        return key;
    });
}
function RateLimitWrap(NextApiHandler, options) {
    return (req, res) => __awaiter(this, void 0, void 0, function* () {
        const { skip, onLimitReached, maxAmount } = options;
        try {
            const key = yield getKey(req, options);
            if (skip && (yield skip(req, key))) {
                return yield NextApiHandler(req, res); // 没有限流，调用下一层
            }
            const count = yield getCurrentCount(key, options);
            if (count > maxAmount) {
                if (onLimitReached) {
                    return yield onLimitReached(req, res, NextApiHandler, key, count);
                }
                else {
                    res.status(429).json({ code: 1, errMsg: "Too many requests" });
                }
            }
            else {
                return yield NextApiHandler(req, res); // 没有限流，调用下一层
            }
        }
        catch (error) { }
    });
}
exports.RateLimitWrap = RateLimitWrap;
//# sourceMappingURL=index.js.map