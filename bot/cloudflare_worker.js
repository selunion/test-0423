export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);

      if (request.method === "GET" && url.pathname === "/") {
        return json({
          ok: true,
          message: "Telegram attendance bot is running.",
          endpoints: ["/webhook", "/healthz"]
        });
      }

      if (request.method === "GET" && url.pathname === "/healthz") {
        return new Response("ok", { status: 200 });
      }

      if (request.method === "POST" && url.pathname === "/webhook") {
        return handleTelegramWebhook(request, env);
      }

      return new Response("Not Found", { status: 404 });
    } catch (err) {
      return new Response(`Worker error: ${err?.stack || err}`, { status: 500 });
    }
  }
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

async function handleTelegramWebhook(request, env) {
  validateWebhookSecret(request, env);

  const update = await request.json().catch(() => ({}));
  const message = update?.message || update?.edited_message;

  if (!message || !message.chat) {
    return json({ ok: true, ignored: "no-message" });
  }

  const text = (message.text || "").trim();
  const from = message.from || {};
  const chat = message.chat || {};
  const meta = {
    userId: String(from.id || ""),
    chatId: String(chat.id || ""),
    username: from.username || "",
    fullName: [from.first_name, from.last_name].filter(Boolean).join(" ").trim()
  };

  // /whoami and /help are always allowed so that admins can discover IDs
  const commandName = getCommandName(text);
  const allowPublic = new Set(["/whoami", "/help", "/start"]);

  if (!allowPublic.has(commandName)) {
    enforceAllowlist(meta, env);
  }

  if (!text) {
    await tgSend(env, chat.id, helpText(meta));
    return json({ ok: true, ignored: "empty-text" });
  }

  try {
    if (commandName === "/start" || commandName === "/help") {
      await tgSend(env, chat.id, helpText(meta));
      return json({ ok: true });
    }

    if (commandName === "/whoami") {
      await tgSend(env, chat.id, [
        "권한 확인용 정보입니다.",
        `user_id: ${meta.userId}`,
        `chat_id: ${meta.chatId}`,
        `username: ${meta.username || "(없음)"}`,
        `name: ${meta.fullName || "(없음)"}`
      ].join("\n"));
      return json({ ok: true });
    }

    const current = await getCurrentStatus(env);

    // 숫자만 보내면 바로 설정
    if (/^\d[\d,\s]*$/.test(text)) {
      const value = parsePositiveInt(text);
      const next = { ...current, attend_num: value, last_updated_iso: nowSeoulIso() };
      const result = await saveStatus(env, next, {
        actor: meta,
        reason: `set ${value} by plain number`
      });
      await tgSend(env, chat.id, formatStatusMessage("참석 인원을 업데이트했습니다.", result.status));
      return json({ ok: true, action: "set-by-number" });
    }

    if (commandName === "/set" || commandName === "/attend") {
      const arg = extractArgument(text);
      const value = parsePositiveInt(arg);
      const next = { ...current, attend_num: value, last_updated_iso: nowSeoulIso() };
      const result = await saveStatus(env, next, {
        actor: meta,
        reason: `set ${value} by command`
      });
      await tgSend(env, chat.id, formatStatusMessage("참석 인원을 업데이트했습니다.", result.status));
      return json({ ok: true, action: "set" });
    }

    if (commandName === "/inc" || commandName === "/plus") {
      const arg = extractArgument(text);
      const delta = parseSignedInt(arg);
      if (delta <= 0) throw new Error("증가값은 1 이상이어야 합니다.");
      const next = {
        ...current,
        attend_num: Math.max(0, Number(current.attend_num || 0) + delta),
        last_updated_iso: nowSeoulIso()
      };
      const result = await saveStatus(env, next, {
        actor: meta,
        reason: `inc ${delta}`
      });
      await tgSend(env, chat.id, formatStatusMessage(`참석 인원을 +${delta} 했습니다.`, result.status));
      return json({ ok: true, action: "inc" });
    }

    if (commandName === "/dec" || commandName === "/minus") {
      const arg = extractArgument(text);
      const delta = parseSignedInt(arg);
      if (delta <= 0) throw new Error("감소값은 1 이상이어야 합니다.");
      const next = {
        ...current,
        attend_num: Math.max(0, Number(current.attend_num || 0) - delta),
        last_updated_iso: nowSeoulIso()
      };
      const result = await saveStatus(env, next, {
        actor: meta,
        reason: `dec ${delta}`
      });
      await tgSend(env, chat.id, formatStatusMessage(`참석 인원을 -${delta} 했습니다.`, result.status));
      return json({ ok: true, action: "dec" });
    }

    if (commandName === "/time") {
      const arg = extractArgument(text);
      if (!arg) throw new Error("예: /time auto 또는 /time 3월 19일 14시 기준");

      let next;
      if (/^(auto|자동)$/i.test(arg)) {
        next = {
          ...current,
          update_time_mode: "auto",
          update_time_text: "",
          last_updated_iso: nowSeoulIso()
        };
      } else {
        next = {
          ...current,
          update_time_mode: "manual",
          update_time_text: arg,
          last_updated_iso: current.last_updated_iso || nowSeoulIso()
        };
      }

      const result = await saveStatus(env, next, {
        actor: meta,
        reason: `time ${arg}`
      });
      await tgSend(env, chat.id, formatStatusMessage("시간 표시 방식을 업데이트했습니다.", result.status));
      return json({ ok: true, action: "time" });
    }

    if (commandName === "/auto") {
      const next = {
        ...current,
        update_time_mode: "auto",
        update_time_text: "",
        last_updated_iso: nowSeoulIso()
      };
      const result = await saveStatus(env, next, {
        actor: meta,
        reason: `auto`
      });
      await tgSend(env, chat.id, formatStatusMessage("시간 표시를 자동 모드로 전환했습니다.", result.status));
      return json({ ok: true, action: "auto" });
    }

    if (commandName === "/status" || commandName === "/show") {
      await tgSend(env, chat.id, formatStatusMessage("현재 상태입니다.", current));
      return json({ ok: true, action: "status" });
    }

    if (commandName === "/ping") {
      await tgSend(env, chat.id, "pong");
      return json({ ok: true, action: "ping" });
    }

    await tgSend(env, chat.id, "알 수 없는 명령입니다.\n/help 를 보내서 사용법을 보세요.");
    return json({ ok: true, ignored: "unknown-command" });
  } catch (err) {
    await tgSend(env, chat.id, `처리에 실패했습니다.\n${err.message || err}`);
    return json({ ok: false, error: String(err?.message || err) }, 200);
  }
}

function validateWebhookSecret(request, env) {
  const configured = (env.TELEGRAM_SECRET_TOKEN || "").trim();
  if (!configured) return;
  const incoming = request.headers.get("x-telegram-bot-api-secret-token") || "";
  if (incoming !== configured) {
    throw new Error("Webhook secret mismatch");
  }
}

function enforceAllowlist(meta, env) {
  const allowedUsers = parseList(env.ALLOWED_USER_IDS);
  const allowedChats = parseList(env.ALLOWED_CHAT_IDS);

  const userAllowed = allowedUsers.length > 0 && allowedUsers.includes(meta.userId);
  const chatAllowed = allowedChats.length > 0 && allowedChats.includes(meta.chatId);

  if (!userAllowed && !chatAllowed) {
    throw new Error([
      "권한이 없습니다.",
      `user_id=${meta.userId}`,
      `chat_id=${meta.chatId}`,
      "관리자가 ALLOWED_USER_IDS 또는 ALLOWED_CHAT_IDS에 추가해야 합니다.",
      "본인 ID 확인은 /whoami 로 가능합니다."
    ].join("\n"));
  }
}

function parseList(value) {
  return String(value || "")
    .split(",")
    .map(v => v.trim())
    .filter(Boolean);
}

function getCommandName(text) {
  const first = String(text || "").split(/\s+/)[0] || "";
  return first.toLowerCase();
}

function extractArgument(text) {
  return String(text || "").replace(/^\S+\s*/, "").trim();
}

function parsePositiveInt(raw) {
  const cleaned = String(raw || "").replace(/[^\d]/g, "");
  if (!cleaned) throw new Error("숫자를 찾지 못했습니다.");
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) throw new Error("유효한 숫자가 아닙니다.");
  return value;
}

function parseSignedInt(raw) {
  const cleaned = String(raw || "").replace(/[^\d+-]/g, "");
  const value = Number(cleaned);
  if (!Number.isFinite(value)) throw new Error("유효한 정수가 아닙니다.");
  return value;
}

function nowSeoulIso() {
  // Returns ISO string normalized to +09:00 for readability in the repo file
  const now = new Date();
  const local = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const year = local.getFullYear();
  const month = String(local.getMonth() + 1).padStart(2, "0");
  const day = String(local.getDate()).padStart(2, "0");
  const hour = String(local.getHours()).padStart(2, "0");
  const min = String(local.getMinutes()).padStart(2, "0");
  const sec = String(local.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${min}:${sec}+09:00`;
}

function formatStatusMessage(prefix, status) {
  const mode = status.update_time_mode === "manual" ? "수동" : "자동";
  const time = status.update_time_mode === "manual"
    ? (status.update_time_text || "(비어 있음)")
    : (status.last_updated_iso || "(없음)");
  return [
    prefix,
    "",
    `참석 인원: ${Number(status.attend_num || 0).toLocaleString()}명`,
    `시간 표시 모드: ${mode}`,
    status.update_time_mode === "manual"
      ? `표시 문구: ${time}`
      : `자동 기준 시각: ${time}`
  ].join("\n");
}

function helpText(meta) {
  return [
    "사용 가능한 명령",
    "",
    "1) 숫자만 보내기",
    "예: 781",
    "",
    "2) /set 781",
    "참석 인원을 지정 숫자로 변경",
    "",
    "3) /inc 10",
    "현재 인원에서 10명 증가",
    "",
    "4) /dec 5",
    "현재 인원에서 5명 감소",
    "",
    "5) /time auto",
    "시간 표시를 자동 모드로 전환",
    "",
    "6) /time 3월 19일 14시 기준",
    "시간 표시를 수동 문구로 고정",
    "",
    "7) /status",
    "현재 설정 조회",
    "",
    "8) /whoami",
    "본인 user_id / chat_id 확인",
    "",
    `현재 호출자 user_id: ${meta.userId || "(없음)"}`,
    `현재 채팅 chat_id: ${meta.chatId || "(없음)"}`
  ].join("\n");
}

async function getCurrentStatus(env) {
  const owner = must(env.GITHUB_OWNER, "GITHUB_OWNER");
  const repo = must(env.GITHUB_REPO, "GITHUB_REPO");
  const path = env.GITHUB_FILE_PATH || "data/status.js";

  const res = await github(
    env,
    `https://api.github.com/repos/${owner}/${repo}/contents/${encodePath(path)}`,
    { method: "GET" }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`현재 status.js 조회 실패: ${res.status} ${body}`);
  }

  const data = await res.json();
  const content = decodeBase64(data.content || "");
  const status = parseStatusJs(content);

  status.__sha = data.sha;
  status.__path = path;
  status.__raw = content;
  return status;
}

function parseStatusJs(content) {
  const attend = matchNumber(content, /attend_num:\s*(\d+)/);
  const mode = matchString(content, /update_time_mode:\s*['"]([^'"]+)['"]/);
  const text = matchString(content, /update_time_text:\s*['"]([^'"]*)['"]/);
  const iso = matchString(content, /last_updated_iso:\s*['"]([^'"]*)['"]/);

  return {
    attend_num: attend ?? 0,
    update_time_mode: mode || "auto",
    update_time_text: text || "",
    last_updated_iso: iso || ""
  };
}

function matchNumber(content, re) {
  const m = content.match(re);
  return m ? Number(m[1]) : null;
}

function matchString(content, re) {
  const m = content.match(re);
  return m ? m[1] : "";
}

function buildStatusJs(status) {
  return [
    "window.SITE_STATUS = {",
    `  attend_num: ${Math.max(0, Number(status.attend_num || 0))},`,
    `  update_time_mode: '${escapeJsString(status.update_time_mode === "manual" ? "manual" : "auto")}', // 'auto' 또는 'manual'`,
    `  update_time_text: '${escapeJsString(status.update_time_text || "")}',     // manual 모드일 때만 사용. 예: '3월 19일 14시 기준'`,
    `  last_updated_iso: '${escapeJsString(status.last_updated_iso || nowSeoulIso())}'`,
    "};",
    ""
  ].join("\n");
}

async function saveStatus(env, status, meta) {
  const owner = must(env.GITHUB_OWNER, "GITHUB_OWNER");
  const repo = must(env.GITHUB_REPO, "GITHUB_REPO");
  const branch = env.GITHUB_BRANCH || "main";
  const current = status.__sha ? status : await getCurrentStatus(env);
  const next = {
    attend_num: Math.max(0, Number(status.attend_num || 0)),
    update_time_mode: status.update_time_mode === "manual" ? "manual" : "auto",
    update_time_text: status.update_time_text || "",
    last_updated_iso: status.last_updated_iso || nowSeoulIso()
  };

  const body = {
    message: buildCommitMessage(next, meta),
    content: encodeBase64Utf8(buildStatusJs(next)),
    sha: current.__sha,
    branch,
    committer: {
      name: env.GITHUB_COMMITTER_NAME || "Attendance Bot",
      email: env.GITHUB_COMMITTER_EMAIL || "attendance-bot@users.noreply.github.com"
    }
  };

  const res = await github(
    env,
    `https://api.github.com/repos/${owner}/${repo}/contents/${encodePath(current.__path || env.GITHUB_FILE_PATH || "data/status.js")}`,
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub 저장 실패: ${res.status} ${text}`);
  }

  const json = await res.json();

  // Optional Cloudflare cache purge
  await maybePurgeCache(env).catch(() => {});

  return {
    ok: true,
    status: next,
    github: json
  };
}

function buildCommitMessage(status, meta) {
  const actor = meta?.actor || {};
  const by = actor.username
    ? `@${actor.username}`
    : (actor.fullName || actor.userId || "unknown");

  return [
    `attendance: ${status.attend_num}명 업데이트`,
    ``,
    `- by: ${by}`,
    `- mode: ${status.update_time_mode}`,
    status.update_time_mode === "manual"
      ? `- time_text: ${status.update_time_text || "(empty)"}`
      : `- last_updated_iso: ${status.last_updated_iso}`
  ].join("\n");
}

async function maybePurgeCache(env) {
  const zoneId = (env.CF_ZONE_ID || "").trim();
  const token = (env.CF_API_TOKEN || "").trim();
  const baseUrl = (env.SITE_BASE_URL || "").trim();

  if (!zoneId || !token || !baseUrl) return;

  const url = `${baseUrl.replace(/\/+$/, "")}/data/status.js`;
  await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${token}`
    },
    body: JSON.stringify({ files: [url] })
  });
}

async function github(env, url, init = {}) {
  const token = must(env.GITHUB_TOKEN, "GITHUB_TOKEN");
  const headers = new Headers(init.headers || {});
  headers.set("authorization", `Bearer ${token}`);
  headers.set("accept", "application/vnd.github+json");
  headers.set("x-github-api-version", "2022-11-28");
  headers.set("user-agent", "attendance-telegram-bot");

  return fetch(url, { ...init, headers });
}

async function tgSend(env, chatId, text) {
  const token = must(env.TELEGRAM_BOT_TOKEN, "TELEGRAM_BOT_TOKEN");
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true
    })
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Telegram sendMessage 실패: ${res.status} ${body}`);
  }
}

function must(value, name) {
  const v = String(value || "").trim();
  if (!v) throw new Error(`${name} 가 비어 있습니다.`);
  return v;
}

function encodePath(path) {
  return path.split("/").map(encodeURIComponent).join("/");
}

function escapeJsString(str) {
  return String(str)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'");
}

function decodeBase64(b64) {
  const normalized = String(b64 || "").replace(/\n/g, "");
  const binary = atob(normalized);
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function encodeBase64Utf8(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}
