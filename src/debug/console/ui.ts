/** Tiny DOM helpers for the dev console (no framework; every control is a real <button> / <select>). */

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", html = ""): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}

export function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);
}

/** A button; `fn` runs on click (errors are logged and toasted, never thrown into the game). */
export function btn(label: string, fn: (b: HTMLButtonElement) => void, cls = ""): HTMLButtonElement {
  const b = el("button", `kkd-b ${cls}`.trim());
  b.type = "button";
  b.textContent = label;
  b.addEventListener("click", (e) => {
    e.stopPropagation();
    try {
      fn(b);
    } catch (err) {
      console.error("[dev] action failed:", err);
      toast(`failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  return b;
}

/** A destructive button: the first tap arms it ("tap again"), the second within 3 s runs it. */
export function confirmBtn(label: string, fn: () => void, what = "tap again to confirm"): HTMLButtonElement {
  let armed = 0;
  const b = btn(
    label,
    () => {
      if (armed) {
        clearTimeout(armed);
        armed = 0;
        b.classList.remove("arm");
        b.textContent = label;
        fn();
        return;
      }
      b.classList.add("arm");
      b.textContent = what;
      armed = window.setTimeout(() => {
        armed = 0;
        b.classList.remove("arm");
        b.textContent = label;
      }, 3000);
    },
    "warn",
  );
  return b;
}

/** A toggle button: `get` reads the state, `set` changes it; the look follows `get` on refresh(). */
export function toggle(label: string, get: () => boolean, set: (on: boolean) => void): HTMLButtonElement & { refresh(): void } {
  const b = btn(label, () => {
    set(!get());
    sync();
  }) as HTMLButtonElement & { refresh(): void };
  const sync = () => b.classList.toggle("on", get());
  b.refresh = sync;
  sync();
  return b;
}

export function select(options: readonly (string | [string, string])[], value = ""): HTMLSelectElement {
  const s = el("select", "kkd-sel");
  for (const o of options) {
    const [v, t] = typeof o === "string" ? [o, o] : o;
    const op = document.createElement("option");
    op.value = v;
    op.textContent = t;
    s.appendChild(op);
  }
  if (value) s.value = value;
  s.addEventListener("click", (e) => e.stopPropagation());
  return s;
}

export function input(value: string, width = 72, mode: "numeric" | "decimal" | "text" = "decimal"): HTMLInputElement {
  const i = el("input", "kkd-in");
  i.value = value;
  i.inputMode = mode;
  i.style.width = `${width}px`;
  i.addEventListener("click", (e) => e.stopPropagation());
  return i;
}

export function row(...kids: (Node | string)[]): HTMLDivElement {
  const r = el("div", "kkd-row");
  r.append(...kids);
  return r;
}

export function sec(title: string): HTMLDivElement {
  return el("div", "kkd-sec", esc(title));
}

/** Key / value grid; returns a setter that rewrites it. */
export function kv(): { el: HTMLDivElement; set(rows: [string, string | number][]): void } {
  const d = el("div", "kkd-kv");
  let last = "";
  return {
    el: d,
    set(rows) {
      const html = rows.map(([k, v]) => `<span>${esc(k)}</span><span>${esc(String(v))}</span>`).join("");
      if (html !== last) d.innerHTML = last = html;
    },
  };
}

let toastEl: HTMLElement | null = null;
let toastT = 0;
export function toast(msg: string, ms = 2200): void {
  if (!toastEl) {
    toastEl = el("div", "kkd-toast");
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = msg;
  toastEl.style.display = "block";
  clearTimeout(toastT);
  toastT = window.setTimeout(() => {
    if (toastEl) toastEl.style.display = "none";
  }, ms);
}

export const fx1 = (v: number) => (Number.isFinite(v) ? v.toFixed(1) : "-");
export const fx2 = (v: number) => (Number.isFinite(v) ? v.toFixed(2) : "-");
