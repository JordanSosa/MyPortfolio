// HUD: frames, hotbar, minimap, quest tracker, chat, toasts, death overlay.

import { G, xpToLevel, unlockedSkills, classOf } from "../core/state.js";
import { SKILLS, UNLOCK_LEVELS, CLASSES } from "../data/classes.js";
import { on, emit } from "../core/events.js";
import { useSkill, usePotion, respawnPlayer, GCD } from "../systems/combat.js";
import { buffs } from "../systems/stats.js";
import { ZONES, zoneAt, terrainHeight } from "../world/scene.js";
import { AMBIENT_CHAT, GZ_LINES, FAKE_NAMES } from "../data/names.js";
import { rng } from "../core/rng.js";
import { skillTooltip, showTooltipHtml, hideTooltip } from "./tooltip.js";
import { activeQuests, questProgressText, questState } from "../systems/quests.js";

const $ = (id) => document.getElementById(id);
let hotbarEls = [];

export function initHud() {
  buildHotbar();
  initMinimapBg();
  initChat();
  $("respawn-btn").addEventListener("click", () => {
    $("death-overlay").style.display = "none";
    respawnPlayer();
  });
  on("hudDirty", renderFrames);
  on("statsChanged", renderFrames);
  on("targetChanged", renderFrames);
  on("levelUp", ({ level }) => {
    addChat({ channel: "system", text: `You are now level ${level}! (+1 skill point, +1 passive point)` });
    buildHotbar();
    setTimeout(() => {
      if (rng.chance(0.8)) addChat({ channel: "ambient", from: rng.pick(FAKE_NAMES), text: rng.pick(GZ_LINES) });
    }, 1200);
  });
  on("questsChanged", renderTracker);
  on("chat", addChat);
  on("uiError", showError);
  on("playerDied", ({ penalty }) => {
    $("death-text").textContent = `The isle claims another… you lost ${penalty} XP. Your gear is safe.`;
    $("death-overlay").style.display = "flex";
  });
  on("skillsChanged", buildHotbar);
  renderFrames();
  renderTracker();
}

// ---------- frames ----------
function renderFrames() {
  const p = G.player;
  if (!p || !G.stats) return;
  const s = G.stats;
  $("pf-name").textContent = p.name + (p.title ? ` <${p.title}>` : "");
  $("pf-level").textContent = `Lv ${p.level} ${classOf(p).name}`;
  $("pf-hp").style.width = `${(p.hp / s.maxHp) * 100}%`;
  $("pf-hp-t").textContent = `${Math.ceil(p.hp)} / ${s.maxHp}`;
  $("pf-mp").style.width = `${(p.mp / s.maxMp) * 100}%`;
  $("pf-mp-t").textContent = `${Math.ceil(p.mp)} / ${s.maxMp}`;
  const need = xpToLevel(p.level);
  $("pf-xp").style.width = `${(p.xp / need) * 100}%`;
  $("pf-xp-t").textContent = `${Math.floor((p.xp / need) * 100)}%`;
  $("gold-amt").textContent = p.gold.toLocaleString();

  const t = G.target;
  const tf = $("target-frame");
  if (t && !t.dead) {
    tf.style.display = "block";
    $("tf-name").textContent = t.species.name;
    $("tf-level").textContent = `Lv ${t.level}`;
    $("tf-hp").style.width = `${(t.hp / t.maxHp) * 100}%`;
    $("tf-hp-t").textContent = `${Math.ceil(t.hp)} / ${t.maxHp}`;
  } else tf.style.display = "none";

  // buffs
  const bx = $("buffs");
  bx.innerHTML = "";
  for (const b of buffs) {
    const d = document.createElement("div");
    d.className = "buff-ico";
    d.innerHTML = `${b.icon}<small>${Math.ceil(b.until - G.now)}s</small>`;
    d.title = b.name;
    bx.appendChild(d);
  }
}

// ---------- hotbar ----------
function buildHotbar() {
  const hb = $("hotbar");
  hb.innerHTML = "";
  hotbarEls = [];
  const cls = classOf();
  cls.skills.forEach((sid, i) => {
    const sk = SKILLS[sid];
    const unlocked = G.player.level >= UNLOCK_LEVELS[i];
    const el = document.createElement("div");
    el.className = "hb-slot" + (unlocked ? "" : " locked");
    el.innerHTML = `<span class="hb-key">${i + 1}</span>${sk.icon}`;
    const cd = document.createElement("div");
    cd.className = "hb-cd";
    cd.style.display = "none";
    el.appendChild(cd);
    el.addEventListener("click", () => { if (unlocked && !G.dead) useSkill(sid); });
    el.addEventListener("mouseenter", (e) => showTooltipHtml(skillTooltip(sid, unlocked, UNLOCK_LEVELS[i]), e));
    el.addEventListener("mouseleave", hideTooltip);
    hb.appendChild(el);
    hotbarEls.push({ el, cd, sid, unlocked });
  });

  hb.appendChild(Object.assign(document.createElement("div"), { className: "hb-sep" }));

  // potions Q / E
  for (const [key, typeId, icon] of [["Q", "hp_potion", "🧪"], ["E", "mp_potion", "🫙"]]) {
    const el = document.createElement("div");
    el.className = "hb-slot";
    el.innerHTML = `<span class="hb-key">${key}</span>${icon}<span class="hb-count"></span>`;
    const cd = document.createElement("div");
    cd.className = "hb-cd";
    cd.style.display = "none";
    el.appendChild(cd);
    el.addEventListener("click", () => usePotion(typeId));
    el.addEventListener("mouseenter", (e) => showTooltipHtml(
      `<div class="tt-name">${typeId === "hp_potion" ? "Vita Potion" : "Aether Potion"}</div><div>Restores 40% of your maximum ${typeId === "hp_potion" ? "Life" : "Mana"}.</div><div class="tt-foot">8s shared cooldown · buy more from Merchant Poppy</div>`, e));
    el.addEventListener("mouseleave", hideTooltip);
    hb.appendChild(el);
    hotbarEls.push({ el, cd, potion: typeId, countEl: el.querySelector(".hb-count") });
  }

  // auto-attack indicator
  const auto = document.createElement("div");
  auto.className = "hb-slot";
  auto.innerHTML = `<span class="hb-key">R</span>⚔️`;
  auto.addEventListener("click", () => { G.autoAttack = !G.autoAttack; });
  auto.addEventListener("mouseenter", (e) => showTooltipHtml(`<div class="tt-name">Auto Attack</div><div>Attacks your target when in range. Toggling on also walks you toward your target.</div>`, e));
  auto.addEventListener("mouseleave", hideTooltip);
  hb.appendChild(auto);
  hotbarEls.push({ el: auto, auto: true });
}

export function updateHotbar() {
  for (const h of hotbarEls) {
    if (h.sid) {
      const readyAt = G.cooldowns[h.sid] || 0;
      const left = readyAt - G.now;
      if (left > 0) { h.cd.style.display = "flex"; h.cd.textContent = left > 1 ? Math.ceil(left) : left.toFixed(1); }
      else h.cd.style.display = "none";
      h.el.classList.toggle("gcd", G.now < G.gcdUntil && left <= 0);
    } else if (h.potion) {
      const left = G.potCdUntil - G.now;
      if (left > 0) { h.cd.style.display = "flex"; h.cd.textContent = Math.ceil(left); }
      else h.cd.style.display = "none";
      h.countEl.textContent = G.player.potions[h.potion] || 0;
    } else if (h.auto) {
      h.el.classList.toggle("auto-on", G.autoAttack);
    }
  }
}

// ---------- quest tracker ----------
function renderTracker() {
  const el = $("quest-tracker");
  el.innerHTML = "";
  for (const q of activeQuests().slice(0, 4)) {
    const s = questState(q.id);
    const d = document.createElement("div");
    d.className = "qt-quest" + (s.status === "complete" ? " complete" : "");
    d.innerHTML = `<div class="qt-name">${q.name}</div><div class="qt-obj">${s.status === "complete" ? "✔ Ready to turn in" : questProgressText(q)}</div>`;
    el.appendChild(d);
  }
}

// ---------- minimap ----------
let mmBg = null;
function initMinimapBg() {
  const cv = document.createElement("canvas");
  cv.width = 148; cv.height = 148;
  const ctx = cv.getContext("2d");
  ctx.fillStyle = "#3a7ab0";
  ctx.fillRect(0, 0, 148, 148);
  // island
  const toMap = (x, z) => [74 + x * 0.34, 74 + z * 0.34];
  ctx.fillStyle = "#7cb86a";
  ctx.beginPath();
  ctx.arc(74, 74, 66, 0, Math.PI * 2);
  ctx.fill();
  for (const zo of ZONES) {
    const [mx, my] = toMap(zo.x, zo.z);
    ctx.fillStyle = `rgba(${zo.color.map((c) => Math.round(c * 255)).join(",")},0.85)`;
    ctx.beginPath();
    ctx.arc(mx, my, zo.r * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  mmBg = cv;
}

export function updateMinimap() {
  const cv = $("minimap-cv");
  const ctx = cv.getContext("2d");
  ctx.drawImage(mmBg, 0, 0);
  const toMap = (x, z) => [74 + x * 0.34, 74 + z * 0.34];
  // npcs
  ctx.fillStyle = "#ffd23e";
  for (const n of G.npcs) {
    const [x, y] = toMap(n.pos.x, n.pos.z);
    ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
  }
  // mobs near player
  ctx.fillStyle = "#e05a4f";
  for (const m of G.mobs) {
    if (m.dead) continue;
    const d = Math.hypot(m.pos.x - G.player.pos.x, m.pos.z - G.player.pos.z);
    if (d > 80 && !m.species.boss) continue;
    const [x, y] = toMap(m.pos.x, m.pos.z);
    if (m.species.boss) { ctx.font = "10px sans-serif"; ctx.fillText("💀", x - 5, y + 3); }
    else ctx.fillRect(x - 1, y - 1, 2.4, 2.4);
  }
  // player
  const [px, py] = toMap(G.player.pos.x, G.player.pos.z);
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(px, py, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#222";
  ctx.stroke();

  const zo = zoneAt(G.player.pos.x, G.player.pos.z);
  $("zone-name").textContent = zo.name;
  const hrs = Math.floor(((G.dayT + 0.25) % 1) * 24);
  $("clock").textContent = `${String(hrs).padStart(2, "0")}:00 island time`;
  G.currentZone = zo.id;
}

// ---------- chat ----------
const MAX_LINES = 80;
function addChat({ channel, from, text, rarity }) {
  const lines = $("chat-lines");
  const d = document.createElement("div");
  if (channel === "system") { d.className = "c-system"; d.textContent = text; }
  else if (channel === "loot") {
    d.className = "c-loot";
    d.style.color = rarity ? ({ normal: "#d8d8d8", uncommon: "#6fe06f", rare: "#5ab2ff", epic: "#c07dff", legendary: "#ffa632", unique: "#ffd700" })[rarity] || "#d8d8d8" : "#d8d8d8";
    d.textContent = text;
  } else if (channel === "me") { d.className = "c-me"; d.innerHTML = `<span class="c-from">[${escapeHtml(from)}]</span> ${escapeHtml(text)}`; }
  else { d.className = "c-ambient"; d.innerHTML = `<span class="c-from">[${escapeHtml(from)}]</span> ${escapeHtml(text)}`; }
  lines.appendChild(d);
  while (lines.children.length > MAX_LINES) lines.removeChild(lines.firstChild);
  lines.scrollTop = lines.scrollHeight;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

let chatIdx = 0;
function initChat() {
  const input = $("chat-input");
  input.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Enter") {
      const v = input.value.trim();
      if (v) addChat({ channel: "me", from: G.player.name, text: v });
      input.value = "";
      input.blur();
    }
    if (e.key === "Escape") input.blur();
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && document.activeElement !== input && !G.uiBlocked) input.focus();
  });

  // ambient chatter + join/leave
  const ambient = () => {
    if (!G.player) return;
    if (rng.chance(0.75)) {
      const [from, text] = AMBIENT_CHAT[chatIdx % AMBIENT_CHAT.length];
      chatIdx++;
      addChat({ channel: "ambient", from, text });
    } else {
      const name = rng.pick(FAKE_NAMES);
      addChat({ channel: "system", text: rng.chance(0.5) ? `${name} has entered the world.` : `${name} has gone offline.` });
    }
    setTimeout(ambient, rng.float(14000, 34000));
  };
  setTimeout(ambient, 9000);
}

// ---------- error toast ----------
let errTimer = null;
function showError(msg) {
  const el = $("ui-error");
  el.textContent = msg;
  el.style.opacity = "1";
  clearTimeout(errTimer);
  errTimer = setTimeout(() => { el.style.opacity = "0"; }, 1800);
}
