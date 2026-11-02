/**
 * window.__kk debug hooks (DESIGN §8.5) for tests, screenshots and the console:
 *   __kk.app / __kk.world / __kk.stats()
 *   __kk.skipTo(seconds)       fast-forward the current run (bot-driven, muted)
 *   __kk.spawn(id, n = 1)      spawn enemies around the player ("puff", "batbun", ..., elite: "puff!")
 *   __kk.giveXp(n) / __kk.levelUp()   trigger level-ups (opens the modal)
 *   __kk.chest(golden?)        drop a chest on the player
 *   __kk.ult()                 fill the overdrive meter
 *   __kk.setSpeed(x)           sim speed multiplier
 *   __kk.god(on = true)        toggle invulnerability
 *   __kk.pause() / __kk.endRun() / __kk.start(hero) / __kk.screen
 */
import { time } from "../core/time";
import type { App } from "../ui/app";
import { simulate, Bot } from "./bot";

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
    ult() {
      world()?.addUlt(100);
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
