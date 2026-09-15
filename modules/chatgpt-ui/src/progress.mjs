export const PROGRESS_ROOT_ID = "spark-progress-overlay";
export const PROGRESS_STYLE_ID = "spark-progress-overlay-style";

function safeSnapshot(snapshot = {}) {
  const activity = snapshot?.activity && typeof snapshot.activity === "object"
    ? snapshot.activity
    : {};
  return {
    checkedAt: typeof snapshot?.checkedAt === "string" ? snapshot.checkedAt : null,
    transportError: typeof snapshot?.transportError === "string" ? snapshot.transportError : null,
    activity: {
      active: activity.active ?? null,
      pendingUncertainMutation: activity.pendingUncertainMutation ?? null,
      last: activity.last ?? null,
    },
  };
}

function progressCss(theme) {
  const c = theme.colors;
  return [
    `#${PROGRESS_ROOT_ID} { position: fixed; inset: 0; z-index: 2147483647; pointer-events: none; font: 600 9px/1.18 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; color: ${c.text.primary}; }`,
    `#${PROGRESS_ROOT_ID} .spark-progress-panel { position: fixed; box-sizing: border-box; overflow: hidden; border: 1px solid ${c.borders.strong}; border-radius: 5px; background: ${c.surfaces.elevatedBackground}; box-shadow: 0 2px 8px rgba(0,0,0,.18); opacity: .92; }`,
    `#${PROGRESS_ROOT_ID} .spark-progress-top { width: 140px; padding: 4px 5px; }`,
    `#${PROGRESS_ROOT_ID} .spark-progress-bottom { width: 124px; padding: 4px 5px; }`,
    `#${PROGRESS_ROOT_ID} .spark-progress-row { display: grid; grid-template-columns: 34px 1fr auto; gap: 4px; align-items: center; min-height: 15px; }`,
    `#${PROGRESS_ROOT_ID} .spark-progress-label { color: ${c.text.secondary}; letter-spacing: .02em; }`,
    `#${PROGRESS_ROOT_ID} .spark-progress-value { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }`,
    `#${PROGRESS_ROOT_ID} .spark-progress-time { color: ${c.text.secondary}; min-width: 24px; text-align: right; }`,
    `#${PROGRESS_ROOT_ID} .spark-progress-track { grid-column: 2 / 4; height: 2px; margin: -1px 0 2px; border-radius: 2px; overflow: hidden; background: ${c.surfaces.elevatedSecondaryBackground}; }`,
    `#${PROGRESS_ROOT_ID} .spark-progress-fill { height: 100%; width: 0%; border-radius: inherit; transition: width .2s linear; background: ${c.charts.blue}; }`,
    `#${PROGRESS_ROOT_ID} .spark-progress-fill.working { width: 34%; animation: spark-progress-slide 1.5s ease-in-out infinite alternate; }`,
    `#${PROGRESS_ROOT_ID} .spark-progress-fill.success { background: ${c.charts.green}; }`,
    `#${PROGRESS_ROOT_ID} .spark-progress-fill.warning { background: ${c.charts.orange}; }`,
    `#${PROGRESS_ROOT_ID} .spark-progress-fill.danger { background: ${c.charts.red}; }`,
    `#${PROGRESS_ROOT_ID} .spark-telemetry-row { display: flex; justify-content: space-between; gap: 4px; min-height: 12px; white-space: nowrap; }`,
    `#${PROGRESS_ROOT_ID} .spark-telemetry-row span:first-child { color: ${c.text.secondary}; }`,
    `#${PROGRESS_ROOT_ID} .spark-telemetry-row span:last-child { overflow: hidden; text-overflow: ellipsis; text-align: right; }`,
    '@keyframes spark-progress-slide { from { transform: translateX(-35%); } to { transform: translateX(190%); } }',
  ].join('\n');
}

function progressHtml() {
  return [
    '<div class="spark-progress-panel spark-progress-top" data-k="top-panel">',
    '<div class="spark-progress-row"><span class="spark-progress-label">BRAIN</span><span class="spark-progress-value" data-k="brain"></span><span class="spark-progress-time" data-k="brain-time"></span><div class="spark-progress-track"><div class="spark-progress-fill" data-k="brain-fill"></div></div></div>',
    '<div class="spark-progress-row"><span class="spark-progress-label">SPARK</span><span class="spark-progress-value" data-k="spark"></span><span class="spark-progress-time" data-k="spark-time"></span><div class="spark-progress-track"><div class="spark-progress-fill" data-k="spark-fill"></div></div></div>',
    '</div>',
    '<div class="spark-progress-panel spark-progress-bottom" data-k="bottom-panel">',
    '<div class="spark-telemetry-row"><span>MODEL</span><span data-k="model"></span></div>',
    '<div class="spark-telemetry-row"><span>CHAT</span><span data-k="chat-chars"></span></div>',
    '<div class="spark-telemetry-row"><span>TOK~</span><span data-k="chat-tokens"></span></div>',
    '</div>',
  ].join('');
}

export function buildProgressExpression(theme, snapshot = {}) {
  const payload = JSON.stringify({
    rootId: PROGRESS_ROOT_ID,
    styleId: PROGRESS_STYLE_ID,
    snapshot: safeSnapshot(snapshot),
    css: progressCss(theme),
    html: progressHtml(),
  });

  return `(() => {
    const payload = ${payload};
    const now = Date.now();
    const visible = (node) => {
      if (!node) return false;
      const style = getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden") return false;
      const rect = node.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    const controls = Array.from(document.querySelectorAll("button,[role=button]"));
    const stopControl = controls.find((node) => {
      if (!visible(node)) return false;
      const label = [node.getAttribute("aria-label"), node.getAttribute("title"), node.textContent]
        .filter(Boolean).join(" ").trim().toLowerCase();
      return /(^|\\s)(stop|cancel)(\\s|$)/.test(label) && !/stop sharing/.test(label);
    });
    const browserState = globalThis.__sparkProgressState ??= { brainStartedAt: null };
    const brainWorking = Boolean(stopControl);
    if (brainWorking && !browserState.brainStartedAt) browserState.brainStartedAt = now;
    if (!brainWorking) browserState.brainStartedAt = null;
    const brainElapsedMs = browserState.brainStartedAt ? now - browserState.brainStartedAt : 0;
    const formatSeconds = (milliseconds) => {
      const seconds = Math.max(0, Math.floor(milliseconds / 1000));
      const minutes = Math.floor(seconds / 60);
      const remainder = seconds % 60;
      return minutes > 0 ? minutes + ":" + String(remainder).padStart(2, "0") : seconds + "s";
    };
    const formatCompact = (value) => {
      if (!Number.isFinite(value) || value <= 0) return "0";
      if (value >= 1000000) return (value / 1000000).toFixed(value >= 10000000 ? 0 : 1) + "m";
      if (value >= 1000) return (value / 1000).toFixed(value >= 10000 ? 0 : 1) + "k";
      return String(Math.round(value));
    };

    let style = document.getElementById(payload.styleId);
    if (!style) {
      style = document.createElement("style");
      style.id = payload.styleId;
      document.head?.appendChild(style);
    }
    style.textContent = payload.css;

    let root = document.getElementById(payload.rootId);
    if (!root) {
      root = document.createElement("div");
      root.id = payload.rootId;
      root.setAttribute("aria-hidden", "true");
      root.innerHTML = payload.html;
      document.body?.appendChild(root);
    }

    const aside = document.querySelector("aside.app-shell-left-panel") || document.querySelector("aside");
    const topPanel = root.querySelector('[data-k="top-panel"]');
    const bottomPanel = root.querySelector('[data-k="bottom-panel"]');
    if (aside && visible(aside)) {
      const rect = aside.getBoundingClientRect();
      const enoughWidth = rect.width >= 260;
      if (topPanel) {
        topPanel.style.display = enoughWidth ? "block" : "none";
        topPanel.style.left = Math.max(rect.left + 118, rect.right - 195) + "px";
        topPanel.style.top = rect.top + 5 + "px";
      }
      if (bottomPanel) {
        bottomPanel.style.display = enoughWidth ? "block" : "none";
        bottomPanel.style.left = Math.max(rect.left + 205, rect.right - 128) + "px";
        bottomPanel.style.top = Math.max(rect.top + 5, rect.bottom - 50) + "px";
      }
    } else {
      if (topPanel) topPanel.style.display = "none";
      if (bottomPanel) bottomPanel.style.display = "none";
    }

    const setText = (key, value) => {
      const node = root.querySelector('[data-k="' + key + '"]');
      if (node) node.textContent = value;
    };
    const brainFill = root.querySelector('[data-k="brain-fill"]');
    if (brainFill) {
      brainFill.className = "spark-progress-fill" + (brainWorking ? " working" : " success");
      if (!brainWorking) brainFill.style.width = "0%";
    }
    setText("brain", brainWorking ? "WORKING" : "IDLE");
    setText("brain-time", brainWorking ? formatSeconds(brainElapsedMs) : "");

    const activity = payload.snapshot.activity ?? {};
    const active = activity.active;
    const pending = activity.pendingUncertainMutation;
    const sparkFill = root.querySelector('[data-k="spark-fill"]');
    if (active) {
      const parsedStart = Date.parse(active.startedAt ?? "");
      const startedAtMs = Number.isFinite(Number(active.startedAtMs)) ? Number(active.startedAtMs) : parsedStart;
      const elapsedMs = Number.isFinite(startedAtMs) ? Math.max(0, now - startedAtMs) : 0;
      const watchdogMs = Number(active.watchdogMs) > 0 ? Number(active.watchdogMs) : 0;
      const percent = watchdogMs > 0 ? Math.min(100, Math.max(0, elapsedMs / watchdogMs * 100)) : 0;
      setText("spark", String(active.operation ?? "operation"));
      setText("spark-time", watchdogMs > 0 ? formatSeconds(elapsedMs) + "/" + formatSeconds(watchdogMs) : formatSeconds(elapsedMs));
      if (sparkFill) {
        sparkFill.className = "spark-progress-fill";
        sparkFill.style.width = percent.toFixed(1) + "%";
      }
    } else if (pending) {
      setText("spark", "UNCERTAIN");
      setText("spark-time", "check");
      if (sparkFill) {
        sparkFill.className = "spark-progress-fill danger";
        sparkFill.style.width = "100%";
      }
    } else if (payload.snapshot.transportError) {
      setText("spark", "OFFLINE");
      setText("spark-time", "");
      if (sparkFill) {
        sparkFill.className = "spark-progress-fill warning";
        sparkFill.style.width = "100%";
      }
    } else {
      setText("spark", "IDLE");
      setText("spark-time", "");
      if (sparkFill) {
        sparkFill.className = "spark-progress-fill success";
        sparkFill.style.width = "0%";
      }
    }

    const modelControl = controls.find((node) => node.getAttribute("aria-label") === "Select ChatGPT model");
    const model = (modelControl?.innerText || modelControl?.textContent || "-").trim().replace(/\\s+/g, " ").slice(0, 18) || "-";
    const turns = Array.from(document.querySelectorAll("[data-turn-key]"));
    const renderedChars = turns.reduce((sum, node) => sum + ((node.innerText || node.textContent || "").length), 0);
    const estimatedTokens = Math.round(renderedChars / 3.2);
    setText("model", model);
    setText("chat-chars", formatCompact(renderedChars) + "C");
    setText("chat-tokens", "~" + formatCompact(estimatedTokens));

    return {
      rootPresent: Boolean(document.getElementById(payload.rootId)),
      brainWorking,
      sparkState: active ? "active" : pending ? "uncertain" : payload.snapshot.transportError ? "offline" : "idle",
      sparkOperation: active?.operation ?? pending?.operation ?? null,
      model,
      renderedChars,
      estimatedTokens,
      sidebarAttached: Boolean(aside && visible(aside)),
    };
  })()`;
}

export function buildProgressRestoreExpression() {
  return `(() => {
    document.getElementById(${JSON.stringify(PROGRESS_ROOT_ID)})?.remove();
    document.getElementById(${JSON.stringify(PROGRESS_STYLE_ID)})?.remove();
    delete globalThis.__sparkProgressState;
    return { restored: true };
  })()`;
}
