/**
 * Log tab: the recent console errors / warnings ring (src/debug/diag.ts), Copy diagnostics / copy
 * log (with a selectable text box when the host blocks the clipboard), and a test error.
 */
import { copyText, diagCounts, diagLog, diagnosticsText, logListeners } from "../diag";
import type { ConsoleHost, Tab } from "./console";
import { btn, el, esc, row, toast } from "./ui";

let showText: ((t: string) => void) | null = null;

/** Show `text` selectable in the Log tab (the clipboard was blocked). */
export function showLogText(text: string): void {
  showText?.(text);
}

export function logTab(h: ConsoleHost): Tab {
  const app = h.app;
  const root = el("div");
  const head = el("div", "kkd-note");
  const ta = el("textarea", "kkd-ta");
  ta.readOnly = true;
  ta.style.display = "none";
  showText = (t) => {
    ta.value = t;
    ta.style.display = "block";
    ta.focus();
    ta.select();
  };
  const copy = (text: string, what: string) => {
    void copyText(text).then((ok) => {
      if (ok) toast(`${what} copied`);
      else {
        showText?.(text);
        toast("copy blocked here: select the text below");
      }
    });
  };
  root.append(
    row(
      btn("COPY DIAGNOSTICS", () => copy(diagnosticsText(app), "diagnostics")),
      btn("COPY LOG", () => copy(diagLog.map((e) => `${e.t.toFixed(1)}s [${e.level}]${e.n > 1 ? ` x${e.n}` : ""} ${e.msg}`).join("\n"), "log"), "sm"),
      btn("SHOW TEXT", () => showText?.(diagnosticsText(app)), "sm"),
      btn("CLEAR", () => {
        diagLog.length = 0;
        render();
      }, "sm"),
      btn("TEST WARN", () => console.warn("[dev] test warning from the console"), "sm"),
    ),
  );
  root.append(head, ta);
  const ul = el("ul", "kkd-log");
  root.append(ul);
  let shown = -1;
  let dirty = true;
  const render = () => {
    dirty = false;
    head.textContent = `${diagCounts.error} errors · ${diagCounts.warn} warnings since boot (newest first, last ${diagLog.length} kept)`;
    ul.innerHTML = diagLog
      .slice()
      .reverse()
      .map((e) => `<li class="${e.level === "error" ? "e" : "w"}">${e.t.toFixed(1)}s ${e.level}${e.n > 1 ? ` x${e.n}` : ""}: ${esc(e.msg)}</li>`)
      .join("");
    shown = diagLog.length;
  };
  const onLog = () => (dirty = true);
  return {
    id: "log",
    label: "Log",
    el: root,
    show() {
      logListeners.add(onLog);
      render();
    },
    hide() {
      logListeners.delete(onLog);
    },
    update() {
      if (dirty || shown !== diagLog.length) render();
    },
  };
}
