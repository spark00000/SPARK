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
    `#${PROGRESS_ROOT_ID} { position: fixed; top: 48px; right: 16px; width: 330px; z-index: 2147483647; box-sizing: border-box; padding: 9px 10px; border-radius: 8px; background: ${c.surfaces.elevatedBackground}; color: ${c.text.primary}; border: 1px solid ${c.borders.strong}; box-shadow: 0 6px 22px rgba(0,0,0,.28); font: 600 11px/1.25 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; pointer-events: none; opacity: .94; }`,
    `#${PROGRESS_ROOT_ID} .spark-progress-row { display: grid; grid-template-columns: 54px 1fr auto; gap: 7px; align-items: center; margin: 3px 0; }`,
    `#${PROGRESS_ROOT_ID} .spark-progress-label { color: ${c.text.secondary}; letter-spacing: .04em; }`,
    `#${PROGRESS_ROOT_ID} .spark-progress-value { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }`,
    `#${PROGRESS_ROOT_ID} .spark-progress-time { color: ${c.text.secondary}; min-width: 48px; text-align: right; }`,
    `#${PROGRESS_ROOT_ID} .spark-progress-track { grid-column: 2 / 4; height: 4px; border-radius: 3px; overflow: hidden; background: ${c.surfaces.elevatedSecondaryBackground}; }`,
    `#${PROGRESS_ROOT_ID} .spark-progress-fill { height: 100%; width: 0%; border-radius: inherit; transition: width .2s linear; background: ${c.charts.blue}; }`,
    `#${PROGRESS_ROOT_ID} .spark-progress-fill.working { width: 38%; animation: spark-progress-slide 1.1s ease-in-out infinite alternate; }`,
    `#${PROGRESS_ROOT_ID} .spark-progress-fill.success { background: ${c.charts.green}; }`,
    `#${PROGRESS_ROOT_ID} .spark-progress-fill.warning { background: ${c.charts.orange}; }`,
    `#${PROGRESS_ROOT_ID} .spark-progress-fill.danger { background: ${c.charts.red}; }`,
    '@keyframes spark-progress-slide { from { transform: translateX(-40%); } to { transform: translateX(165%); } }',
  ].join('\n');
}

function progressHtml() {
  return [
    '<div class="spark-progress-row"><span class="spark-progress-label">BRAIN</span><span class="spark-progress-value" data-k="brain"></span><span class="spark-progress-time" data-k="brain-time"></span><div class="spark-progress-track"><div class="spark-progress-fill" data-k="brain-fill"></div></div></div>',
    '<div class="spark-progress-row"><span class="spark-progress-label">SPARK</span><span class="spark-progress-value" data-k="spark"></span><span class="spark-progress-time" data-k="spark-time"></span><div class="spark-progress-track"><div class="spark-progress-fill" data-k="spark-fill"></div></div></div>',
    '<div class="spark-progress-row"><span class="spark-progress-label">USAGE</span><span class="spark-progress-value" data-k="usage"></span><span class="spark-progress-time" data-k="usage-time"></span></div>',
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
      setText("spark", "UNCERTAIN " + String(pending.operation ?? "mutation"));
      setText("spark-time", "reconcile");
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

    setText("usage", "provider metrics unavailable");
    setText("usage-time", "");
    return {
      rootPresent: Boolean(document.getElementById(payload.rootId)),
      brainWorking,
      sparkState: active ? "active" : pending ? "uncertain" : payload.snapshot.transportError ? "offline" : "idle",
      sparkOperation: active?.operation ?? pending?.operation ?? null,
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
