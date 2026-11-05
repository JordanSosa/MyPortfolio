/**
 * Dev console styles (injected once with the lazy chunk). Every class is
 * prefixed `kkd-` (docs/DEVTOOLS.md: two global-CSS class collisions reached
 * the owner last season). Sized for a 360 px portrait phone first.
 */
export const CSS = `
.kkd{position:fixed;z-index:2147483000;font:12px/1.35 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#efe8ff;
  -webkit-user-select:none;user-select:none;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
.kkd *{box-sizing:border-box}
.kkd-panel{width:min(392px,calc(100vw - 12px));max-height:min(72vh,600px);display:flex;flex-direction:column;
  background:rgba(22,14,38,.94);border:1px solid rgba(190,140,255,.55);border-radius:10px;box-shadow:0 8px 28px rgba(0,0,0,.5);overflow:hidden}
.kkd-head{display:flex;align-items:center;gap:6px;padding:4px 4px 4px 8px;background:rgba(120,70,200,.35);cursor:grab;touch-action:none}
.kkd-title{font-weight:700;letter-spacing:.06em;color:#ffd6f5;white-space:nowrap}
.kkd-live{flex:1;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;color:#bfe9ff;font-size:11px}
.kkd-hb{min-width:32px;height:30px;border:0;border-radius:6px;background:rgba(255,255,255,.1);color:#fff;font:inherit;font-size:14px;cursor:pointer;padding:0 6px}
.kkd-hb:active,.kkd-b:active{filter:brightness(1.4)}
.kkd-tabs{display:flex;gap:2px;padding:4px 4px 0;overflow-x:auto;scrollbar-width:none;flex:none}
.kkd-tabs::-webkit-scrollbar{display:none}
.kkd-tab{flex:1 0 auto;min-width:52px;height:30px;border:0;border-radius:6px 6px 0 0;background:rgba(255,255,255,.07);color:#cdbfe8;font:inherit;font-weight:700;cursor:pointer;padding:0 6px}
.kkd-tab.on{background:rgba(190,140,255,.32);color:#fff}
.kkd-body{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:6px 8px 10px;border-top:1px solid rgba(190,140,255,.35);touch-action:pan-y;-webkit-user-select:text;user-select:text}
.kkd-sec{margin:6px 0 2px;color:#ffb8e6;font-weight:700;font-size:11px;letter-spacing:.08em;text-transform:uppercase}
.kkd-row{display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin:3px 0}
.kkd-b{min-height:32px;padding:4px 9px;border:1px solid rgba(190,140,255,.45);border-radius:6px;background:rgba(255,255,255,.08);color:#fff;font:inherit;cursor:pointer;white-space:nowrap}
.kkd-b.on{background:rgba(79,230,223,.28);border-color:#4fe6df}
.kkd-b.warn{border-color:#ff8fa8;color:#ffd0da}
.kkd-b.arm{background:rgba(255,77,109,.45);border-color:#ff4d6d}
.kkd-b.sm{min-height:28px;padding:2px 7px;font-size:11px}
.kkd-b:disabled{opacity:.45}
.kkd-sel,.kkd-in{min-height:32px;max-width:100%;border:1px solid rgba(190,140,255,.45);border-radius:6px;background:#241838;color:#fff;font:inherit;padding:2px 6px}
.kkd-in{width:72px}
.kkd-sel{flex:1;min-width:120px}
.kkd-kv{display:grid;grid-template-columns:auto 1fr;gap:1px 10px;margin:2px 0}
.kkd-kv>span:nth-child(odd){color:#a99bc6}
.kkd-kv>span:nth-child(even){color:#fff;overflow-wrap:anywhere}
.kkd-tbl{width:100%;border-collapse:collapse;margin:2px 0}
.kkd-tbl td,.kkd-tbl th{padding:1px 4px;text-align:right;font-weight:400}
.kkd-tbl th{color:#a99bc6;font-size:11px}
.kkd-tbl td:first-child,.kkd-tbl th:first-child{text-align:left}
.kkd-cv{display:block;width:100%;height:64px;background:rgba(0,0,0,.25);border-radius:4px;margin:3px 0}
.kkd-cv.tall{height:84px}
.kkd-note{color:#a99bc6;font-size:11px;margin:2px 0}
.kkd-bad{color:#ff8fa8}
.kkd-ok{color:#7dffb0}
.kkd-log{margin:0;padding:0;list-style:none}
.kkd-log li{padding:3px 0;border-bottom:1px solid rgba(255,255,255,.07);overflow-wrap:anywhere;font-size:11px}
.kkd-log .e{color:#ff8fa8}.kkd-log .w{color:#ffe08a}
.kkd-scn{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:4px}
.kkd-scn .kkd-b{white-space:normal;overflow-wrap:anywhere;text-align:left;line-height:1.15;font-size:11px;min-width:0}
.kkd-ta{width:100%;height:120px;background:#140c22;color:#fff;border:1px solid rgba(190,140,255,.45);border-radius:6px;font:11px/1.3 ui-monospace,Menlo,monospace;-webkit-user-select:text;user-select:text}
.kkd-pill{display:flex;align-items:center;gap:6px;height:34px;padding:0 10px;border-radius:17px;background:rgba(22,14,38,.9);border:1px solid rgba(190,140,255,.6);
  color:#ffd6f5;font-weight:700;cursor:pointer;touch-action:none;box-shadow:0 4px 14px rgba(0,0,0,.45)}
.kkd-pill small{color:#bfe9ff;font-weight:400}
.kkd-toast{position:fixed;left:50%;bottom:calc(14px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:2147483001;max-width:calc(100vw - 24px);
  padding:7px 12px;border-radius:8px;background:rgba(22,14,38,.95);border:1px solid #4fe6df;color:#fff;font:12px/1.3 ui-monospace,Menlo,monospace;pointer-events:none}
`;
