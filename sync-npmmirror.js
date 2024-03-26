const packageJson = require("./package.json");

fetch(`https://registry-direct.npmmirror.com/-/package/${packageJson.name}/syncs`, {
  headers: {
    accept: "*/*",
    "accept-language": "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7",
    "cache-control": "no-cache",
    pragma: "no-cache",
    "sec-ch-ua": '"Not_A Brand";v="8", "Chromium";v="120", "Microsoft Edge";v="120"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"macOS"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-site",
    Referer: "https://npmmirror.com/",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  },
  body: null,
  method: "PUT",
})
  .then(async (res) => {
    console.log("sync npmmirror success");
    console.log(await res.json());
  })
  .catch((err) => {
    console.error("sync npmmirror error");
    console.error(err);
  });
