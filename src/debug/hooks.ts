/**
 * window.__kk debug hooks (DESIGN §8.5) for tests, screenshots and the console:
 *   __kk.app / __kk.world / __kk.stats()
 *   __kk.skipTo(seconds)       fast-forward the current run (bot-driven, muted)
 *   __kk.spawn(id, n = 1)      spawn enemies around the player ("puff", "batbun", ..., elite: "puff!")
 *   __kk.giveXp(n) / __kk.levelUp()   trigger level-ups (opens the modal)
 *   __kk.chest(golden?)        drop a chest on the player
 *   __kk.ult()                 fill the overdrive meter
 *   __kk.give(id, level = 5)   add / level a weapon or passive ("rainbow_cannon", "twin_charm"); an evolved
 *                              id replaces its base weapon (or takes a free slot)
 *   __kk.clearWeapons()        drop every weapon (isolate one for screenshots)
 *   __kk.boss(id, warn = false) bring a boss in now ("nightmare_teddy", "lady_lunatic"; warn = with the WARNING)
 *   __kk.bossHp(frac)          set the live boss's HP to a fraction (jump to a phase: 0.55 / 0.2)
 *   __kk.enrage()              enrage the final boss now (10:30 rule)
 *   __kk.setSpeed(x)           sim speed multiplier
 *   __kk.god(on = true)        toggle invulnerability
 *   __kk.pause() / __kk.endRun() / __kk.start(hero) / __kk.screen
 * Season 2:
 *   __kk.relic(id, stars = 0)  equip a relic mid-run (mods + install, as at run start)
 *   __kk.twist(id, rank = 1)   add a Plot Twist mid-run
 *   __kk.endless()             start the Filler Arc now (as if the final boss had just died in an endless run)
 *   __kk.stageFx(kind, value, seconds?, id?)   a sim stageFx directive (grade / renderScale / animFps / speedLines / still / reset)
 *   __kk.runStats()            the RunStats collected so far
 *   __kk.prewarm()             UI sprite prewarm progress { done, total } (it waits out runs / modals / overlays)
 *   (run configs from the URL: ?stage= ?endless=1 ?twists= ?relics= ?talents= ?cons= ?flags= ... see params.ts)
 * Developer suite (src/debug/dev.ts adds these; docs/DEVTOOLS.md §3):
 *   __kk.step(frames, dt) / __kk.render() / __kk.freeze()      deterministic step mode (?step=1)
 *   await __kk.scenario(name) / __kk.scenarios() / __kk.snapshot()   named states, structured live state
 *   __kk.diagnostics() / __kk.dev() / __kk.perf                 diagnostics text, the dev console, the profiler
 */
import { time } from "../core/time";
import type { App } from "../ui/app";
import { prewarmState } from "../ui/dom";
import { simulate, Bot } from "./bot";
import { PASSIVE_BY_ID } from "../game/passives";
import { BOSSES, RELICS, TWISTS, WEAPONS, evolvesInto } from "../game/registry";

export function installHooks(app: App): void {
  const world = () => app.game?.world ?? app.attract?.world ?? null;
  const api = {
    app,
    time,
    get world() {
      return world();
    },
    get screen() {
      return app.screen;
    },
    get modal() {
      return app.modalKind;
    },
    skipTo(sec: number) {
      const w = app.game?.world;
      if (!w) return false;
      const dt = Math.max(0, sec - w.t);
      w.muted = true;
      simulate(w, dt, 1 / 30, app.game?.bot ?? new Bot(5));
      w.muted = false;
      app.r.camera.snapTo(w.player.x, w.player.y - 8);
      // (a boss that arrived during the muted skip never sent bossSpawn: sync the bar, like Session.endSkip)
      const b = w.boss;
      app.hud.bossBar(b && !b.dead && b.def.boss ? b : null, b?.def.boss?.title ?? "");
      return w.t;
    },
    spawn(id: string, n = 1) {
      const w = world();
      if (!w) return 0;
      const elite = id.endsWith("!");
      const key = elite ? id.slice(0, -1) : id;
      let k = 0;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        if (w.spawnEnemy(key, w.player.x + Math.cos(a) * 70, w.player.y + Math.sin(a) * 70, elite)) k++;
      }
      return k;
    },
    giveXp(n: number) {
      world()?.addXp(n);
    },
    levelUp() {
      const w = world();
      if (w) w.addXp(w.xpNext - w.xp + 0.01);
    },
    chest(golden = false) {
      const w = world();
      if (w) {
        const k = w.dropPickup("chest", w.player.x, w.player.y + 2, 1, golden);
        k.vx = k.vy = 0;
        k.t = 0.35; // collectible on the next step (lands on the hero)
      }
    },
    give(id: string, level = 5) {
      const w = world();
      if (!w) return false;
      if (PASSIVE_BY_ID.has(id)) {
        if (w.passiveLevel(id) > 0) w.setPassiveLevel(id, level);
        else w.addPassive(id, level);
        return true;
      }
      const def = WEAPONS.get(id);
      if (!def) return false;
      const have = w.hasWeapon(id);
      if (have) {
        w.setWeaponLevel(have, level);
        return true;
      }
      if (def.evolved) {
        // evolve the base weapon if owned, else add the evolution directly
        for (const inst of w.weapons) if (evolvesInto(inst.def, id)) return !!w.evolveWeapon(inst, id);
        return !!w.addWeapon(id, 1);
      }
      return !!w.addWeapon(id, level);
    },
    clearWeapons() {
      const w = world();
      if (!w) return;
      for (const inst of w.weapons) {
        inst.def.dispose?.(w, inst);
        for (const p of inst.projs) p.dead = true;
      }
      w.weapons.length = 0;
      w.buildVersion++;
    },
    boss(id: string, warn = false) {
      const w = world();
      const def = BOSSES.get(id);
      if (!w || !def) return false;
      w.director.warnBoss(def, 0.4);
      if (!warn && w.director.warning) w.director.warning.t = 0;
      return true;
    },
    bossHp(frac: number) {
      const b = world()?.boss;
      if (!b) return false;
      b.hp = Math.max(1, b.maxHp * frac);
      return true;
    },
    enrage() {
      const w = world();
      if (!w || w.director.enraged) return false;
      w.director.enraged = true;
      w.emit("bossEnrage", {});
      return true;
    },
    ult() {
      world()?.addUlt(100);
    },
    relic(id: string, stars = 0) {
      const w = world();
      const def = RELICS.get(id);
      if (!w || !def || w.run.relics.some((r) => r.id === id)) return false;
      w.run.relics.push({ id, stars });
      def.install?.(w, stars);
      w.recomputeStats();
      return true;
    },
    twist(id: string, rank = 1) {
      const w = world();
      const def = TWISTS.get(id);
      if (!w || !def || w.twistIds.includes(id)) return false;
      w.twistIds.push(id);
      w.twistRanks[id] = Math.max(1, Math.min(def.maxRank, rank));
      def.install(w, w.twistRanks[id]);
      w.recomputeStats();
      return true;
    },
    endless() {
      const w = world();
      if (!w || w.endlessOn || w.phase !== "play") return false;
      w.stageCleared = true;
      w.finalBossDown = true;
      w.startEndless();
      return true;
    },
    stageFx(kind: string, value: number, seconds = 0, id = "") {
      world()?.emit("stageFx", { kind, value, seconds, id });
    },
    runStats() {
      return world()?.summary().stats ?? null;
    },
    prewarm() {
      return { done: prewarmState.done, total: prewarmState.total };
    },
    setSpeed(x: number) {
      time.speed = x;
    },
    god(on = true) {
      const w = world();
      if (w) (w as unknown as { god: boolean }).god = on;
    },
    pause() {
      app.pause();
    },
    endRun() {
      app.endRun();
    },
    start(hero = "hoshi") {
      app.startRun(hero);
    },
    stats() {
      const w = world();
      return {
        screen: app.screen,
        modal: app.modalKind,
        t: w?.t ?? 0,
        level: w?.level ?? 0,
        kills: w?.kills ?? 0,
        enemies: w?.enemyCount ?? 0,
        projectiles: w?.projectiles.count ?? 0,
        bullets: w?.bullets.count ?? 0,
        boss: w?.boss ? `${w.boss.def.id}:${Math.round(w.boss.hp)}/${w.boss.maxHp}:s${w.boss.state}` : "",
        gems: w?.gems.count ?? 0,
        particles: app.fx.ps.count,
        hp: w?.player.hp ?? 0,
        phase: w?.phase ?? "",
        tier: app.tier,
        fps: Math.round(app.fpsMeter.fps),
        sprites: app.r.batch.stats.instances,
        missingArt: app.r.atlas.missing.length,
      };
    },
  };
  (window as unknown as { __kk: typeof api }).__kk = api;
}
