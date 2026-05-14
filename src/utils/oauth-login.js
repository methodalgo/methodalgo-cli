import crypto from "crypto";
import http from "http";
import { spawn } from "child_process";
import config from "./config-manager.js";

const DEFAULT_ACCOUNT_BASE = "https://account.methodalgo.com";
const CALLBACK_TIMEOUT_MS = 180000;
const CLI_USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 methodalgo-cli/1.0";
const CLOUDFLARE_BLOCK_MARKER = "Attention Required! | Cloudflare";

function getCallbackPageCopy() {
    const lang = config.get("lang") || "en";
    if (lang === "zh") {
        return {
            htmlLang: "zh-CN",
            lang,
            title: "MethodAlgo CLI 登录成功",
            brand: "MethodAlgo CLI",
            heading: "登录成功",
            body: "浏览器授权已完成，请返回终端继续完成 CLI 配置。",
            status: "此标签页可以安全关闭。",
            accountButton: "管理您的账户"
        };
    }

    return {
        htmlLang: "en",
        lang,
        title: "MethodAlgo CLI Login Complete",
        brand: "MethodAlgo CLI",
        heading: "Login approved",
        body: "Your browser authorization is complete. Return to the terminal to finish CLI setup.",
        status: "This tab can be closed safely.",
        accountButton: "Manage your account"
    };
}

function getAccountManageUrl(lang) {
    const accountBase = getAccountBase();
    return `${accountBase}${lang === "zh" ? "/zh/account" : "/account"}`;
}

function renderCallbackSuccessPage() {
    const copy = getCallbackPageCopy();
    const accountUrl = getAccountManageUrl(copy.lang);
    return `<!doctype html>
<html lang="${copy.htmlLang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${copy.title}</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #09090b;
      --panel: #111114;
      --line: rgba(255,255,255,.12);
      --text: #f4f4f5;
      --muted: #a1a1aa;
      --accent: #d4d4d8;
      --ok: #22c55e;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      background: radial-gradient(circle at 50% -20%, rgba(34,197,94,.16), transparent 38%), var(--bg);
      color: var(--text);
      font: 16px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    main {
      width: min(440px, calc(100vw - 32px));
      padding: 32px;
      border: 1px solid var(--line);
      border-radius: 18px;
      background: color-mix(in srgb, var(--panel) 92%, transparent);
      box-shadow: 0 24px 80px rgba(0,0,0,.42);
      text-align: center;
    }
    .mark {
      width: 56px;
      height: 56px;
      margin: 0 auto 20px;
      display: grid;
      place-items: center;
      border-radius: 50%;
      background: rgba(34,197,94,.12);
      border: 1px solid rgba(34,197,94,.28);
      color: var(--ok);
      font-size: 28px;
      font-weight: 700;
    }
    .brand {
      margin: 0 0 8px;
      font-size: 14px;
      letter-spacing: .08em;
      text-transform: uppercase;
      color: var(--accent);
      font-weight: 700;
    }
    h1 {
      margin: 0;
      font-size: 28px;
      line-height: 1.15;
      letter-spacing: 0;
    }
    p {
      margin: 14px 0 0;
      color: var(--muted);
    }
    .status {
      margin-top: 24px;
      padding: 14px 16px;
      border-radius: 12px;
      background: rgba(255,255,255,.04);
      border: 1px solid var(--line);
      color: #d4d4d8;
      font-size: 14px;
    }
    .actions {
      margin-top: 18px;
    }
    .account-link {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 42px;
      padding: 0 18px;
      border-radius: 10px;
      background: #f4f4f5;
      color: #18181b;
      font-weight: 700;
      text-decoration: none;
      box-shadow: 0 12px 32px rgba(0,0,0,.28);
    }
    .account-link:hover {
      background: #ffffff;
    }
  </style>
</head>
<body>
  <main>
    <div class="mark">✓</div>
    <p class="brand">${copy.brand}</p>
    <h1>${copy.heading}</h1>
    <p>${copy.body}</p>
    <div class="status">${copy.status}</div>
    <div class="actions">
      <a class="account-link" href="${accountUrl}" target="_blank" rel="noopener noreferrer">${copy.accountButton}</a>
    </div>
  </main>
</body>
</html>`;
}

function base64Url(buffer) {
    return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function createPkcePair() {
    const codeVerifier = base64Url(crypto.randomBytes(32));
    const codeChallenge = base64Url(crypto.createHash("sha256").update(codeVerifier).digest());
    return { codeVerifier, codeChallenge };
}

function getAccountBase() {
    return (process.env.METHODALGO_ACCOUNT_BASE || config.get("accountBase") || DEFAULT_ACCOUNT_BASE).replace(/\/+$/g, "");
}

async function fetchOAuthConfig(accountBase) {
    const response = await fetch(`${accountBase}/api/cli/oauth/config`, {
        headers: {
            Accept: "application/json",
            "User-Agent": CLI_USER_AGENT
        }
    });

    let data = null;
    try {
        data = await response.json();
    } catch (_) {}

    if (!response.ok || data?.status !== true) {
        throw new Error(data?.message || `OAuth config request failed (${response.status})`);
    }

    return data;
}

function openBrowser(url) {
    const command = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
    const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
    const child = spawn(command, args, {
        detached: true,
        stdio: "ignore"
    });
    child.unref();
}

function createOAuthCallbackServer(redirectUri, expectedState) {
    const callbackUrl = new URL(redirectUri);
    const port = Number(callbackUrl.port);
    const hostname = callbackUrl.hostname || "127.0.0.1";
    const pathname = callbackUrl.pathname;

    if (!port) {
        throw new Error("OAuth redirect URI must include a fixed localhost port");
    }

    let server;
    const callbackPromise = new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            server.close();
            reject(new Error("OAuth login timed out"));
        }, CALLBACK_TIMEOUT_MS);

        server = http.createServer((req, res) => {
            const requestUrl = new URL(req.url, `http://${req.headers.host}`);

            if (requestUrl.pathname !== pathname) {
                res.writeHead(404);
                res.end("Not Found");
                return;
            }

            const state = requestUrl.searchParams.get("state");
            const code = requestUrl.searchParams.get("code");
            const error = requestUrl.searchParams.get("error");
            const errorDescription = requestUrl.searchParams.get("error_description");

            if (state !== expectedState) {
                res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
                res.end("OAuth state mismatch. You can close this window.");
                clearTimeout(timer);
                server.close();
                reject(new Error("OAuth state mismatch"));
                return;
            }

            if (error) {
                res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
                res.end("OAuth login was cancelled. You can close this window.");
                clearTimeout(timer);
                server.close();
                reject(new Error(errorDescription || error));
                return;
            }

            if (!code) {
                res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
                res.end("Missing OAuth code. You can close this window.");
                clearTimeout(timer);
                server.close();
                reject(new Error("Missing OAuth code"));
                return;
            }

            res.writeHead(200, {
                "Content-Type": "text/html; charset=utf-8",
                "Cache-Control": "no-store, max-age=0"
            });
            res.end(renderCallbackSuccessPage());
            clearTimeout(timer);
            server.close();
            resolve(code);
        });

        server.once("error", (err) => {
            clearTimeout(timer);
            reject(err);
        });
    });

    const ready = new Promise((resolve, reject) => {
        server.once("listening", resolve);
        server.once("error", reject);
        server.listen(port, hostname);
    });

    return { ready, callbackPromise };
}

async function exchangeOAuthCode(exchangeUrl, payload) {
    const response = await fetch(exchangeUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "User-Agent": CLI_USER_AGENT
        },
        body: JSON.stringify(payload)
    });

    let data = null;
    let rawText = "";
    try {
        rawText = await response.text();
        data = rawText ? JSON.parse(rawText) : null;
    } catch (_) {}

    if (!response.ok || data?.status !== true || !data?.apiKey) {
        if (rawText.includes(CLOUDFLARE_BLOCK_MARKER)) {
            throw new Error("Cloudflare blocked the CLI OAuth exchange request. Add a WAF skip rule for /api/cli/oauth/exchange.");
        }
        throw new Error(data?.message || rawText || `OAuth exchange failed (${response.status})`);
    }

    return data;
}

export async function loginWithOAuth() {
    const accountBase = getAccountBase();
    const oauthConfig = await fetchOAuthConfig(accountBase);
    const { codeVerifier, codeChallenge } = createPkcePair();
    const state = base64Url(crypto.randomBytes(24));
    const authUrl = new URL(oauthConfig.authorizationUrl);

    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", oauthConfig.clientId);
    authUrl.searchParams.set("redirect_uri", oauthConfig.redirectUri);
    authUrl.searchParams.set("scope", oauthConfig.scope || "email profile");
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("code_challenge", codeChallenge);
    authUrl.searchParams.set("code_challenge_method", "S256");

    const callbackServer = createOAuthCallbackServer(oauthConfig.redirectUri, state);
    await callbackServer.ready;
    openBrowser(authUrl.toString());
    const code = await callbackServer.callbackPromise;

    return exchangeOAuthCode(oauthConfig.exchangeUrl, {
        code,
        codeVerifier,
        redirectUri: oauthConfig.redirectUri,
        clientId: oauthConfig.clientId
    });
}
