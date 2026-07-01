// Draggable windows: inventory, character, skills, quest log, vendor,
// NPC dialogs, help — plus the crafting-currency cursor mode.

import { G, unlockedSkills, classOf } from "../core/state.js";
import { CLASSES, SKILLS, UNLOCK_LEVELS, AUGMENTS, SKILL_MAX_LEVEL } from "../data/classes.js";
import { SLOT_NAMES, POTIONS, RARITIES } from "../data/items.js";
import { on, emit } from "../core/events.js";
import {
  equipItem, unequipItem, craftWith, levelSkill, refundSkill, socketRune, unsocketRune,
  buyPotion, sellItem, RESPEC_COST, SKILL_REFUND_COST,
} from "../systems/actions.js";
import { usePotion } from "../systems/combat.js";
import { availableFrom, turninsFor, acceptQuest, turnIn, activeQuests, questState, questProgressText } from "../systems/quests.js";
import { QUESTS } from "../data/quests.js";
import { itemTooltipHtml, showTooltipHtml, hideTooltip, positionTooltip, skillTooltip } from "./tooltip.js";
import { initTreeWindow } from "./tree.js";

const windows = new Map();
let zTop = 30;

export function makeWindow(id, title, { x = 120, y = 90, w = null } = {}) {
  if (windows.has(id)) return windows.get(id);
  const el = document.createElement("div");
  el.className = "window";
  el.id = `win-${id}`;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.style.display = "none";
  if (w) el.style.width = `${w}px`;
  el.innerHTML = `<div class="win-title"><span>${title}</span><button class="win-close">✕</button></div><div class="win-body"></div>`;
  document.getElementById("windows").appendChild(el);
  const body = el.querySelector(".win-body");
  const win = {
    id, el, body,
    isOpen: () => el.style.display !== "none",
    open() { el.style.display = "block"; el.style.zIndex = ++zTop; win.render?.(); },
    close() { el.style.display = "none"; hideTooltip(); },
    toggle() { win.isOpen() ? win.close() : win.open(); },
    render: null,
  };
  el.querySelector(".win-close").addEventListener("click", () => win.close());
  el.addEventListener("pointerdown", () => { el.style.zIndex = ++zTop; });

  // dragging
  const titleEl = el.querySelector(".win-title");
  let drag = null;
  titleEl.addEventListener("pointerdown", (e) => {
    if (e.target.classList.contains("win-close")) return;
    drag = { dx: e.clientX - el.offsetLeft, dy: e.clientY - el.offsetTop };
    titleEl.setPointerCapture(e.pointerId);
  });
  titleEl.addEventListener("pointermove", (e) => {
    if (!drag) return;
    el.style.left = `${Math.max(0, Math.min(window.innerWidth - 80, e.clientX - drag.dx))}px`;
    el.style.top = `${Math.max(0, Math.min(window.innerHeight - 40, e.clientY - drag.dy))}px`;
    el.style.transform = "none";
  });
  titleEl.addEventListener("pointerup", () => { drag = null; });

  windows.set(id, win);
  return win;
}

export function initWindows() {
  buildInventory();
  buildCharacter();
  buildSkills();
  buildQuestLog();
  buildVendor();
  buildDialog();
  buildHelp();
  initTreeWindow(makeWindow);
  initCraftCursor();

  on("toggleWindow", (id) => windows.get(id)?.toggle());
  on("escape", () => {
    if (G.craftMode) { setCraftMode(null); return; }
    const open = [...windows.values()].filter((w) => w.isOpen()).sort((a, b) => b.el.style.zIndex - a.el.style.zIndex);
    if (open.length) open[0].close();
    else if (G.target) { G.target = null; emit("targetChanged"); }
  });
  on("inventoryChanged", () => { windows.get("inventory")?.isOpen() && windows.get("inventory").render(); windows.get("vendor")?.isOpen() && windows.get("vendor").render(); });
  on("statsChanged", () => { windows.get("character")?.isOpen() && windows.get("character").render(); });
  on("skillsChanged", () => { windows.get("skills")?.isOpen() && windows.get("skills").render(); });
  on("questsChanged", () => { windows.get("quests")?.isOpen() && windows.get("quests").render(); });
  on("npcInteract", openDialog);
}

// ---------- craft mode ----------
function setCraftMode(currencyItem) {
  G.craftMode = currencyItem ? { item: currencyItem } : null;
  const cur = document.getElementById("craft-cursor");
  cur.style.display = currencyItem ? "block" : "none";
  if (currencyItem) cur.textContent = currencyItem.icon;
  document.body.style.cursor = currencyItem ? "crosshair" : "";
}

function initCraftCursor() {
  window.addEventListener("pointermove", (e) => {
    if (!G.craftMode) return;
    const cur = document.getElementById("craft-cursor");
    cur.style.left = `${e.clientX + 14}px`;
    cur.style.top = `${e.clientY + 8}px`;
  });
}

// ---------- inventory ----------
function slotEl(item, { onClick, onRight, hint, cls = "bag-slot" } = {}) {
  const d = document.createElement("div");
  d.className = cls + (item ? ` r-${item.rarity}` : "");
  if (item) {
    d.textContent = item.icon;
    if (item.count > 1) {
      const c = document.createElement("span");
      c.className = "item-count";
      c.textContent = item.count;
      d.appendChild(c);
    }
    d.addEventListener("mouseenter", (e) => showTooltipHtml(itemTooltipHtml(item, {
      compare: true,
      footer: footerFor(item),
    }), e));
    d.addEventListener("mousemove", positionTooltip);
    d.addEventListener("mouseleave", hideTooltip);
  } else if (hint) {
    const s = document.createElement("span");
    s.className = "slot-hint";
    s.textContent = hint;
    d.appendChild(s);
  }
  if (onClick) d.addEventListener("click", () => { onClick(); });
  if (onRight) d.addEventListener("contextmenu", (e) => { e.preventDefault(); onRight(); });
  return d;
}

function footerFor(item) {
  const bits = [];
  if (G.vendorOpen) bits.push("right-click: sell");
  if (item.kind === "equip") bits.push("click: equip");
  if (item.kind === "currency") bits.push("click: use on an item");
  if (item.kind === "potion") bits.push("click: use");
  if (item.kind === "rune") bits.push("socket via Skills (K)");
  return bits.join(" · ");
}

function buildInventory() {
  const win = makeWindow("inventory", "Inventory (B)", { x: window.innerWidth - 430, y: 120, w: 400 });
  win.render = () => {
    const p = G.player;
    const body = win.body;
    body.innerHTML = "";
    hideTooltip();

    // paperdoll
    const pd = document.createElement("div");
    pd.className = "paperdoll";
    const order = ["helmet", "amulet", "ring1", "weapon", "chest", "ring2", "gloves", "belt", "boots"];
    for (const slot of order) {
      const item = p.equipment[slot];
      pd.appendChild(slotEl(item, {
        cls: "equip-slot",
        hint: SLOT_NAMES[slot],
        onClick: () => {
          if (G.craftMode && item) { craftWith(G.craftMode.item, item); if (!G.player.bag.includes(G.craftMode.item)) setCraftMode(null); win.render(); return; }
          if (item) { unequipItem(slot); win.render(); }
        },
      }));
    }
    body.appendChild(pd);

    // bag grid
    const grid = document.createElement("div");
    grid.className = "bag-grid";
    p.bag.forEach((item, idx) => {
      grid.appendChild(slotEl(item, {
        onClick: () => {
          if (!item) return;
          if (G.craftMode) {
            if (item === G.craftMode.item) { setCraftMode(null); return; }
            craftWith(G.craftMode.item, item);
            if (!G.player.bag.includes(G.craftMode.item)) setCraftMode(null);
            win.render();
            return;
          }
          if (item.kind === "equip") equipItem(item);
          else if (item.kind === "currency") setCraftMode(item);
          else if (item.kind === "potion") { p.potions[item.typeId] = (p.potions[item.typeId] || 0) + (item.count || 1); p.bag[idx] = null; emit("inventoryChanged"); }
          win.render();
        },
        onRight: () => {
          if (!item) return;
          if (G.vendorOpen) { sellItem(item); win.render(); }
          else if (item.kind === "currency") setCraftMode(item);
        },
      }));
    });
    body.appendChild(grid);

    const pots = document.createElement("div");
    pots.className = "inv-potions";
    pots.innerHTML = `🧪 Vita ×${p.potions.hp_potion || 0} (Q) &nbsp; 🫙 Aether ×${p.potions.mp_potion || 0} (E) &nbsp; 🪙 ${p.gold.toLocaleString()}`;
    body.appendChild(pots);
  };
}

// ---------- character sheet ----------
function buildCharacter() {
  const win = makeWindow("character", "Character (C)", { x: 40, y: 120, w: 400 });
  win.render = () => {
    const s = G.stats, p = G.player;
    const rows = [
      ["stat-head", "Attributes"],
      ["Strength", s.attrs.str], ["Dexterity", s.attrs.dex], ["Intelligence", s.attrs.int], ["Vitality", s.attrs.vit],
      ["stat-head", "Defense"],
      ["Life", `${Math.ceil(p.hp)} / ${s.maxHp}`], ["Mana", `${Math.ceil(p.mp)} / ${s.maxMp}`],
      ["Life Regen", `${s.hpRegen.toFixed(1)}/s`], ["Mana Regen", `${s.mpRegen.toFixed(1)}/s`],
      ["Armor", s.armor], ["Evasion", `${s.evasion.toFixed(1)}%`],
      ["Fire Res", `${s.fireRes}%`], ["Cold Res", `${s.coldRes}%`], ["Lightning Res", `${s.lightRes}%`],
      ["stat-head", "Offense"],
      ["Weapon Damage", `${s.weapon.min}–${s.weapon.max}`], ["Attack Speed", s.atkSpd.toFixed(2)],
      ["Crit Chance", `${s.critCh.toFixed(1)}%`], ["Crit Multiplier", `${s.critMult}%`],
      ["Move Speed", `${Math.round(s.moveSpd / 8 * 100)}%`], ["Life Leech", `${s.leechPct}%`],
      ["stat-head", "Progress"],
      ["Level", p.level], ["Passive Points", p.passivePoints], ["Skill Points", p.skillPoints],
      ["Deaths", p.deaths], ["Gold", p.gold.toLocaleString()],
    ];
    let h = `<div class="stat-grid">`;
    for (const r of rows) {
      if (r[0] === "stat-head") h += `<div class="stat-head">${r[1]}</div>`;
      else h += `<div><b>${r[0]}</b><span>${r[1]}</span></div>`;
    }
    h += "</div>";
    if (s.specials.size) {
      h += `<div style="margin-top:8px;font-size:11px;color:#ffd700">Keystones/Uniques: ${[...s.specials].join(", ")}</div>`;
    }
    win.body.innerHTML = h;
  };
}

// ---------- skills ----------
function buildSkills() {
  const win = makeWindow("skills", "Skills & Augments (K)", { x: 200, y: 80, w: 470 });
  win.render = () => {
    const p = G.player;
    const cls = classOf();
    const body = win.body;
    body.innerHTML = `<div class="sp-banner">${p.skillPoints} skill point${p.skillPoints === 1 ? "" : "s"} available · refund costs ${SKILL_REFUND_COST}g</div>`;
    cls.skills.forEach((sid, i) => {
      const def = SKILLS[sid];
      const st = p.skills[sid];
      const unlocked = p.level >= UNLOCK_LEVELS[i];
      const row = document.createElement("div");
      row.className = "skill-row" + (unlocked ? "" : " locked");

      const ico = document.createElement("div");
      ico.className = "skill-ico";
      ico.textContent = def.icon;
      ico.addEventListener("mouseenter", (e) => showTooltipHtml(skillTooltip(sid, unlocked, UNLOCK_LEVELS[i]), e));
      ico.addEventListener("mouseleave", hideTooltip);

      const info = document.createElement("div");
      info.className = "skill-info";
      info.innerHTML = `<div class="skill-name">${def.name}</div><div class="skill-desc">${unlocked ? def.desc : `Unlocks at level ${UNLOCK_LEVELS[i]}`}</div>`;

      const lvl = document.createElement("div");
      lvl.className = "skill-lvl";
      lvl.textContent = `${st.level}/${SKILL_MAX_LEVEL}`;

      const plus = document.createElement("button");
      plus.className = "btn small";
      plus.textContent = "+";
      plus.disabled = !unlocked || p.skillPoints <= 0 || st.level >= SKILL_MAX_LEVEL;
      plus.addEventListener("click", () => levelSkill(sid));

      const minus = document.createElement("button");
      minus.className = "btn small";
      minus.textContent = "−";
      minus.disabled = st.level <= 1;
      minus.addEventListener("click", () => refundSkill(sid));

      const sockets = document.createElement("div");
      sockets.className = "skill-sockets";
      [0, 1].forEach((si) => {
        const sEl = document.createElement("div");
        const locked = si === 1 && st.level < 5;
        const aug = st.augments[si];
        sEl.className = "socket" + (aug ? " filled" : "") + (locked ? " locked" : "");
        sEl.textContent = aug ? AUGMENTS[aug].icon : locked ? "🔒" : "＋";
        sEl.addEventListener("mouseenter", (e) => {
          if (aug) showTooltipHtml(`<div class="tt-name">${AUGMENTS[aug].icon} ${AUGMENTS[aug].name}</div><div>${AUGMENTS[aug].text}</div><div class="tt-foot">click to unsocket</div>`, e);
          else showTooltipHtml(`<div class="tt-name">Augment Socket</div><div>${locked ? "Unlocks at skill level 5." : "Click to socket an Augment Rune from your bag."}</div>`, e);
        });
        sEl.addEventListener("mouseleave", hideTooltip);
        sEl.addEventListener("click", () => {
          if (locked || !unlocked) return;
          if (aug) { unsocketRune(sid, si); return; }
          openRunePicker(row, sid, si, win);
        });
        sockets.appendChild(sEl);
      });

      row.append(ico, info, lvl, plus, minus, sockets);
      body.appendChild(row);
    });
  };
}

function openRunePicker(row, sid, socketIdx, win) {
  const existing = row.querySelector(".rune-pick");
  if (existing) { existing.remove(); return; }
  const runes = G.player.bag.filter((it) => it && it.kind === "rune");
  const pick = document.createElement("div");
  pick.className = "rune-pick";
  if (!runes.length) pick.innerHTML = `<span style="color:#9a94b0;font-size:12px">No Augment Runes in your bag — mobs drop them.</span>`;
  for (const r of runes) {
    const o = document.createElement("div");
    o.className = "rune-opt";
    o.innerHTML = `${r.icon} ${AUGMENTS[r.typeId].name}`;
    o.addEventListener("mouseenter", (e) => showTooltipHtml(`<div class="tt-name">${r.name}</div><div>${r.text}</div>`, e));
    o.addEventListener("mouseleave", hideTooltip);
    o.addEventListener("click", () => { hideTooltip(); socketRune(sid, socketIdx, r); });
    pick.appendChild(o);
  }
  row.appendChild(pick);
}

// ---------- quest log ----------
function buildQuestLog() {
  const win = makeWindow("quests", "Quest Log (L)", { x: 300, y: 130, w: 380 });
  win.render = () => {
    const body = win.body;
    body.innerHTML = "";
    const act = activeQuests();
    if (act.length) {
      for (const q of act) {
        const s = questState(q.id);
        const d = document.createElement("div");
        d.className = "ql-quest";
        d.innerHTML = `<div class="ql-name">${q.name}</div><div class="ql-obj ${s.status === "complete" ? "ql-done" : ""}">${s.status === "complete" ? `✔ Return to ${q.turnin === "maren" ? "Captain Maren" : "Skill Sage Elowen"}` : questProgressText(q)}</div>`;
        body.appendChild(d);
      }
    } else body.innerHTML = `<div style="color:#9a94b0">No active quests. Look for <b style="color:#ffd23e">!</b> markers in town.</div>`;
    const done = QUESTS.filter((q) => questState(q.id)?.status === "done");
    if (done.length) {
      const h = document.createElement("div");
      h.style.cssText = "margin-top:10px;color:#7df0a0;font-weight:bold";
      h.textContent = `Completed (${done.length}/${QUESTS.length})`;
      body.appendChild(h);
      for (const q of done) {
        const d = document.createElement("div");
        d.style.cssText = "color:#8a94a8;font-size:12px;padding:2px 4px";
        d.textContent = `✔ ${q.name}`;
        body.appendChild(d);
      }
    }
  };
}

// ---------- vendor ----------
function buildVendor() {
  const win = makeWindow("vendor", "Merchant Poppy", { x: window.innerWidth / 2 - 190, y: 160, w: 380 });
  const origClose = win.close;
  win.close = () => { G.vendorOpen = false; origClose(); };
  win.render = () => {
    const body = win.body;
    body.innerHTML = "";
    for (const pot of Object.values(POTIONS)) {
      const row = document.createElement("div");
      row.className = "vendor-row";
      row.innerHTML = `<span class="v-ico">${pot.icon}</span><span class="v-name">${pot.name}<br/><small style="color:#9a94b0">${pot.text}</small></span><span style="color:#ffd23e">${pot.price}g</span>`;
      const b1 = document.createElement("button"); b1.className = "btn small"; b1.textContent = "Buy";
      b1.addEventListener("click", () => { buyPotion(pot.id, 1); win.render(); });
      const b5 = document.createElement("button"); b5.className = "btn small"; b5.textContent = "×5";
      b5.addEventListener("click", () => { buyPotion(pot.id, 5); win.render(); });
      row.append(b1, b5);
      body.appendChild(row);
    }
    const note = document.createElement("div");
    note.className = "vendor-note";
    note.innerHTML = `While this window is open, <b>right-click</b> items in your bag to sell them.<br/>Gold: <span style="color:#ffd23e">${G.player.gold.toLocaleString()}</span>`;
    body.appendChild(note);
  };
}

// ---------- NPC dialog ----------
function buildDialog() {
  makeWindow("dialog", "…", { x: window.innerWidth / 2 - 220, y: 140, w: 440 });
}

const GREETINGS = {
  maren: "Maren leans on the bulletin board, scanning the horizon. \"Brightshore stands because people like you keep standing. What do you need?\"",
  poppy: "Poppy beams behind a crate of clinking bottles. \"Potions! Sundries! Fair-ish prices! What'll it be, dear?\"",
  elowen: "Elowen looks up from a scroll, pink petals drifting from the great tree. \"Ah. Your constellation is stirring. Sit, ask, learn.\"",
};

function openDialog(npc) {
  const win = windows.get("dialog");
  win.el.querySelector(".win-title span").textContent = npc.name;
  const body = win.body;
  body.innerHTML = "";

  const turnins = turninsFor(npc.id);
  const avail = availableFrom(npc.id);

  const text = document.createElement("div");
  text.className = "dlg-text";
  text.textContent = GREETINGS[npc.id] || "…";
  body.appendChild(text);

  const actions = document.createElement("div");
  actions.className = "dlg-actions";

  for (const q of turnins) {
    const b = document.createElement("button");
    b.className = "btn";
    b.innerHTML = `✔ Complete: <b>${q.name}</b><div class="dlg-reward">${rewardText(q)}</div>`;
    b.addEventListener("click", () => {
      turnIn(q);
      text.textContent = q.done;
      actions.remove();
      const cont = document.createElement("button");
      cont.className = "btn";
      cont.textContent = "Continue";
      cont.addEventListener("click", () => openDialog(npc));
      body.appendChild(cont);
    });
    actions.appendChild(b);
  }

  for (const q of avail) {
    const b = document.createElement("button");
    b.className = "btn";
    b.innerHTML = `! Accept: <b>${q.name}</b><div class="dlg-reward">${q.objective} — ${rewardText(q)}</div>`;
    b.addEventListener("click", () => {
      acceptQuest(q);
      text.textContent = q.intro;
      openDialogActionsOnly(npc, body);
    });
    actions.appendChild(b);
  }

  if (npc.id === "poppy") {
    const b = document.createElement("button");
    b.className = "btn";
    b.textContent = "🛒 Browse wares";
    b.addEventListener("click", () => { G.vendorOpen = true; windows.get("vendor").open(); });
    actions.appendChild(b);
  }
  if (npc.id === "elowen") {
    const b = document.createElement("button");
    b.className = "btn";
    b.textContent = "🌀 About respeccing";
    b.addEventListener("click", () => {
      text.textContent = `"Paths can be unwalked, for a price. Refunding a passive point costs ${RESPEC_COST} gold — click an allocated node in your constellation (P). Skill points refund for ${SKILL_REFUND_COST} gold in your Skills window (K)."`;
    });
    actions.appendChild(b);
    const b2 = document.createElement("button");
    b2.className = "btn";
    b2.textContent = "✨ Open my constellation (P)";
    b2.addEventListener("click", () => emit("toggleWindow", "tree"));
    actions.appendChild(b2);
  }

  const bye = document.createElement("button");
  bye.className = "btn";
  bye.textContent = "Farewell";
  bye.addEventListener("click", () => win.close());
  actions.appendChild(bye);

  body.appendChild(actions);
  win.open();
}

function openDialogActionsOnly(npc, body) {
  const old = body.querySelector(".dlg-actions");
  if (old) old.remove();
  const actions = document.createElement("div");
  actions.className = "dlg-actions";
  const cont = document.createElement("button");
  cont.className = "btn";
  cont.textContent = "Continue";
  cont.addEventListener("click", () => openDialog(npc));
  actions.appendChild(cont);
  body.appendChild(actions);
}

function rewardText(q) {
  const r = q.reward || {};
  const bits = [];
  if (r.gold) bits.push(`${r.gold}g`);
  if (r.xp) bits.push(`${r.xp} XP`);
  if (r.passivePoints) bits.push(`+${r.passivePoints} passive pt`);
  if (r.currency) bits.push(Object.entries(r.currency).map(([k, n]) => `${n}× currency`).join(", "));
  if (r.item) bits.push(`${r.item.rarity} item`);
  if (r.augment) bits.push("augment rune");
  if (r.unique) bits.push("a UNIQUE item");
  if (r.title) bits.push(`title <${r.title}>`);
  return bits.join(" · ");
}

// ---------- help ----------
function buildHelp() {
  const win = makeWindow("help", "How to Play (H)", { x: window.innerWidth / 2 - 230, y: 90, w: 460 });
  win.body.innerHTML = `
    <div style="line-height:1.7;font-size:12.5px">
      <b style="color:#ffd23e">Move</b> — WASD / arrows, or click the ground. Hold &amp; drag to orbit the camera, wheel to zoom.<br/>
      <b style="color:#ffd23e">Fight</b> — <b>Tab</b> or click a monster to target it, <b>1–6</b> for skills, <b>R</b> toggles auto-attack. You'll walk into range automatically.<br/>
      <b style="color:#ffd23e">Survive</b> — <b>Q</b> life potion, <b>E</b> mana potion. Dying costs a little XP, never gear.<br/>
      <b style="color:#ffd23e">Loot</b> — click beams or press <b>Z</b> to vacuum nearby drops. Rarity: <span style="color:#e8e8e8">Normal</span> → <span style="color:#6fe06f">Uncommon</span> → <span style="color:#5ab2ff">Rare</span> → <span style="color:#c07dff">Epic</span> → <span style="color:#ffa632">Legendary</span> → <span style="color:#ffd700">Unique</span>.<br/>
      <b style="color:#ffd23e">Craft</b> — click a currency in your bag (<b>B</b>), then click a piece of gear to reforge it.<br/>
      <b style="color:#ffd23e">Build</b> — level up skills and socket Augment Runes (<b>K</b>); allocate the passive constellation (<b>P</b>).<br/>
      <b style="color:#ffd23e">Quest</b> — talk to NPCs with <b style="color:#ffd23e">!</b> marks in Brightshore. The chain ends at the Duskfang Alpha.<br/>
      <b style="color:#ffd23e">Windows</b> — <b>B</b> bag · <b>C</b> character · <b>K</b> skills · <b>P</b> passives · <b>L</b> quests · <b>M</b> mute · <b>Esc</b> close.
    </div>`;
  win.render = () => {};
}
