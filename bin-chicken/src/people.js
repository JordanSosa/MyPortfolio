// Picnickers, walkers and one hyper-vigilant BBQ dad. Each has a view cone;
// let them see you near their food and they'll come for you.

import * as THREE from "three";
import { part } from "./toon.js";
import { BOUNDS, PATH } from "./world.js";
import { pushOut, wrap } from "./ibis.js";

const SHIRTS = [0xe85d4a, 0x3d8bd9, 0xf2c94c, 0x55b979, 0x9b6bd6, 0xf28fb5, 0x2bb3b1, 0xfafafa, 0x39404d, 0xff8c42];
const PANTS = [0x2f3e5c, 0x6b5a45, 0x3a3a3a, 0x8aa1b8, 0xd9c9a3];
const SKIN = [0xf5d0b0, 0xe0ac85, 0xc68863, 0x8d5a3b, 0x5e3a24, 0xf1c7a0];
const HAIR = [0x2a1d14, 0x5a3a1e, 0xd9b45a, 0x8a2f1a, 0x111111, 0xbdbdbd];
const CONE_CALM = new THREE.Color(0xfff0a0);
const CONE_ALERT = new THREE.Color(0xff3b3b);

export const SHOUTS = ["OI!", "SHOO!", "GET OUTTA IT!", "MY CHIPS!", "BLOODY BIN CHICKEN!", "NOT TODAY!", "GARN, GIT!"];
export const SULKS = ["...my lunch?", "Unbelievable.", "Every. Single. Time.", "I'd just bought that!"];

const POSES = {
  ground: { hip: 0.22, body: 0.62, head: 1.16, leg: -Math.PI / 2 },
  bench: { hip: 0.52, body: 0.94, head: 1.48, leg: -1.35 },
  stand: { hip: 0.8, body: 1.22, head: 1.76, leg: 0 },
};

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const rand = (a, b) => a + Math.random() * (b - a);

export class Person {
  constructor(scene, opts) {
    const { pos, facing, pose, spot, kind = "sitter", range = 8, half = 0.6, speed = 5.3, path = null } = opts;
    this.kind = kind;
    this.spot = spot;
    this.home = pos.clone();
    this.homeFacing = facing;
    this.homePose = pose;
    this.range = range;
    this.half = half;
    this.speed = speed;
    this.path = path; // { t, dir }

    this.root = new THREE.Group();
    this.root.position.copy(pos);
    this.root.rotation.y = facing;

    const skin = pick(SKIN);
    this.torso = new THREE.Group();
    this.root.add(this.torso);
    this.bodyMesh = part(new THREE.CapsuleGeometry(0.3, 0.5, 4, 10), pick(SHIRTS), { outline: 0.025 });
    this.headGroup = new THREE.Group();
    const head = part(new THREE.SphereGeometry(0.25, 14, 10), skin, { outline: 0.025 });
    this.headGroup.add(head);
    const r = Math.random();
    if (r < 0.3) {
      const cap = part(new THREE.SphereGeometry(0.265, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), pick(SHIRTS), { outline: 0.02 });
      const brim = part(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 12), pick(SHIRTS));
      brim.position.set(0, 0.03, 0.22);
      brim.scale.z = 0.7;
      this.headGroup.add(cap, brim);
    } else if (r < 0.5) {
      const hat = part(new THREE.CylinderGeometry(0.22, 0.36, 0.22, 14), 0xe9d9ae, { outline: 0.02 });
      hat.position.y = 0.2;
      this.headGroup.add(hat);
    } else {
      const hair = part(new THREE.SphereGeometry(0.27, 12, 8, 0, Math.PI * 2, 0, Math.PI / 1.7), pick(HAIR), { outline: 0.02 });
      hair.rotation.x = -0.25;
      this.headGroup.add(hair);
    }
    // sunnies
    if (Math.random() < 0.5) {
      const shades = part(new THREE.BoxGeometry(0.34, 0.07, 0.04), 0x111111, { shadow: false });
      shades.position.set(0, 0.04, 0.23);
      this.headGroup.add(shades);
    } else {
      for (const s of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), new THREE.MeshBasicMaterial({ color: 0x111111 }));
        eye.position.set(s * 0.09, 0.04, 0.23);
        this.headGroup.add(eye);
      }
    }
    this.torso.add(this.bodyMesh, this.headGroup);

    this.arms = [];
    for (const s of [-1, 1]) {
      const sh = new THREE.Group();
      const arm = part(new THREE.CapsuleGeometry(0.08, 0.38, 3, 6), skin, { outline: 0.015 });
      arm.position.y = -0.26;
      const hand = new THREE.Group();
      hand.position.y = -0.52;
      sh.add(arm, hand);
      sh.userData.side = s;
      sh.userData.hand = hand;
      this.torso.add(sh);
      this.arms.push(sh);
    }
    this.hand = this.arms[1].userData.hand;

    const pants = pick(PANTS);
    this.legs = [];
    for (const s of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.x = s * 0.14;
      const leg = part(new THREE.CapsuleGeometry(0.1, 0.48, 3, 6), pants, { outline: 0.015 });
      leg.position.y = -0.36;
      hip.add(leg);
      this.root.add(hip);
      this.legs.push(hip);
    }

    // View cone on the ground
    this.coneMat = new THREE.MeshBasicMaterial({ color: CONE_CALM.clone(), transparent: true, opacity: 0.16, depthWrite: false });
    this.cone = new THREE.Group();
    const fan = new THREE.Mesh(new THREE.CircleGeometry(range, 24, -Math.PI / 2 - half, half * 2), this.coneMat);
    fan.rotation.x = -Math.PI / 2;
    fan.renderOrder = 2;
    this.cone.add(fan);
    this.cone.position.y = 0.05;
    scene.add(this.cone);
    scene.add(this.root);

    this.state = kind === "walker" ? "walk" : "idle";
    this.alert = 0;
    this.sees = false;
    this.lookTarget = 0;
    this.lookTimer = rand(0.5, 3);
    this.timer = 0;
    this.chaseTime = 0;
    this.lastSeen = new THREE.Vector3();
    this.phase = Math.random() * 10;
    this.robbed = false;
    this.setPose(pose);
  }

  setPose(name) {
    const p = POSES[name];
    this.pose = name;
    this.bodyMesh.position.y = p.body;
    this.headGroup.position.y = p.head;
    for (const a of this.arms) {
      a.position.set(a.userData.side * 0.36, p.body + 0.22, 0);
      a.rotation.set(name === "stand" ? 0 : -0.7, 0, a.userData.side * 0.15);
    }
    for (const l of this.legs) {
      l.position.y = p.hip;
      l.rotation.x = p.leg;
    }
    if (this.kind === "walker") this.arms[1].rotation.x = -1.1; // holding food out front
  }

  lookAngle() {
    return this.root.rotation.y + this.torso.rotation.y;
  }

  ownsCarry(ib) {
    return ib.carry && ib.carry.spot === this.spot;
  }

  // ---------------------------------------------------------------------
  update(dt, g) {
    const ib = g.ibis;
    const p = this.root.position;
    const dx = ib.pos.x - p.x, dz = ib.pos.z - p.z;
    const dist = Math.hypot(dx, dz);
    const toIbis = Math.atan2(dx, dz);
    const visible = !ib.hidden && g.playing;
    this.sees = visible && dist < this.range && Math.abs(wrap(toIbis - this.lookAngle())) < this.half;
    if (this.sees) this.lastSeen.copy(ib.pos);

    switch (this.state) {
      case "idle":
      case "walk":
        this.updateCalm(dt, g, dist, toIbis);
        break;
      case "noticing":
        this.turnTorsoTo(wrap(toIbis - this.root.rotation.y), 6, dt);
        this.timer -= dt;
        if (this.timer <= 0) {
          if (dist < 15 && visible) this.startChase(g);
          else this.sulk(g);
        }
        break;
      case "chase":
        this.updateChase(dt, g, dist);
        break;
      case "return":
        this.updateReturn(dt, g);
        break;
    }

    this.animate(dt);
    this.updateCone();
  }

  detect(dt, g, dist) {
    const ib = g.ibis;
    if (this.sees) {
      if (this.ownsCarry(ib)) return this.startChase(g);
      let near = false;
      for (const f of this.spot.foods()) {
        const fp = f.worldPos();
        if (Math.hypot(fp.x - ib.pos.x, fp.z - ib.pos.z) < 3.6) { near = true; break; }
      }
      let rate = near ? 1.15 : 0.22;
      if (ib.carry) rate += 0.45;
      if (ib.running && ib.speed > 5) rate *= 1.6;
      if (ib.peck > 0) rate *= 1.4;
      rate *= Math.max(0.35, 1.5 - dist / this.range);
      this.alert += rate * dt;
      if (this.alert >= 1) this.startChase(g);
    } else {
      this.alert = Math.max(0, this.alert - 0.26 * dt);
    }
  }

  updateCalm(dt, g, dist, toIbis) {
    if (this.kind === "walker") this.walkPath(dt);

    this.lookTimer -= dt;
    if (this.lookTimer <= 0) {
      const span = this.kind === "walker" ? 0.8 : this.kind === "bbq" ? 2.0 : 1.7;
      this.lookTarget = rand(-span, span);
      this.lookTimer = this.kind === "bbq" ? rand(0.8, 2.2) : rand(1.4, 4.2);
    }
    const suspicious = this.alert > 0.35;
    const target = suspicious ? wrap(toIbis - this.root.rotation.y) : this.lookTarget;
    this.turnTorsoTo(target, suspicious ? 3.2 : 1.8, dt);
    this.detect(dt, g, dist);
  }

  turnTorsoTo(target, rate, dt) {
    const lim = this.pose === "stand" ? Math.PI : 2.1;
    const t = Math.max(-lim, Math.min(lim, target));
    const d = t - this.torso.rotation.y;
    this.torso.rotation.y += Math.sign(d) * Math.min(Math.abs(d), rate * dt);
  }

  walkPath(dt) {
    const { rx, rz } = PATH;
    const t = this.path.t;
    const tx = -rx * Math.sin(t) * this.path.dir, tz = rz * Math.cos(t) * this.path.dir;
    const tl = Math.hypot(tx, tz);
    this.path.t += (dt * 1.5 * this.path.dir) / tl * 1;
    const nt = this.path.t;
    this.root.position.set(rx * Math.cos(nt), 0, rz * Math.sin(nt));
    this.root.rotation.y = Math.atan2(tx, tz);
    this.moving = 1.5;
  }

  startChase(g) {
    if (this.state === "chase") return;
    this.state = "chase";
    this.alert = 1;
    this.chaseTime = this.kind === "bbq" ? 6.5 : 5;
    this.windup = 0.4; // a beat to stand up before giving chase
    this.lastSeen.copy(g.ibis.pos);
    if (this.pose !== "stand") this.setPose("stand");
    this.root.rotation.y = this.lookAngle();
    this.torso.rotation.y = 0;
    g.shout(this, pick(SHOUTS));
  }

  notice(delay) {
    if (this.state === "chase") return;
    this.state = "noticing";
    this.timer = delay;
    this.alert = Math.max(this.alert, 0.6);
  }

  sulk(g) {
    this.state = this.kind === "walker" ? "walk" : "idle";
    this.alert = 0.4;
    g.say(this, pick(SULKS));
  }

  updateChase(dt, g, dist) {
    const ib = g.ibis;
    const visible = !ib.hidden;
    if (visible && dist < 9) {
      this.lastSeen.copy(ib.pos);
      this.chaseTime = Math.max(this.chaseTime, 1.2);
    }
    const target = visible ? ib.pos : this.lastSeen;
    const p = this.root.position;
    let dx = target.x - p.x, dz = target.z - p.z;
    const d = Math.hypot(dx, dz);
    if (this.windup > 0) {
      this.windup -= dt;
      this.root.rotation.y += wrap(Math.atan2(dx, dz) - this.root.rotation.y) * Math.min(1, dt * 12);
      this.torso.rotation.y *= 0.8;
      return;
    }
    if (d > 0.3) {
      dx /= d;
      dz /= d;
      this.steer(g, p, d, dx, dz);
      dx = this._steer.x;
      dz = this._steer.z;
      const s = this.speed * (ib.hidden ? 0.6 : 1);
      p.x += dx * s * dt;
      p.z += dz * s * dt;
      const want = Math.atan2(dx, dz);
      this.root.rotation.y += wrap(want - this.root.rotation.y) * Math.min(1, dt * 10);
      this.moving = s;
    } else this.moving = 0;
    this.torso.rotation.y *= 0.8;
    this.collide(g, false);

    this.chaseTime -= dt * (ib.hidden ? 2.5 : 1);
    if (visible && dist < 1.2 && ib.pos.y < 0.9 && ib.stun <= 0) {
      g.caught(this);
      this.goHome();
      return;
    }
    if (this.chaseTime <= 0 || dist > 20) {
      this.goHome();
      if (Math.random() < 0.5) g.say(this, ib.hidden ? "Where'd it go?" : "Bloody birds...");
    }
  }

  // Veer around the first obstacle that sits on the straight line to the target.
  steer(g, p, dist, dx, dz) {
    const out = (this._steer ||= { x: 0, z: 0 });
    out.x = dx;
    out.z = dz;
    for (const c of g.colliders) {
      const cx = c.x - p.x, cz = c.z - p.z;
      const along = cx * dx + cz * dz;
      if (along <= 0 || along > Math.min(dist, c.r + 2.5)) continue;
      const lateral = cx * dz - cz * dx; // signed distance of the obstacle from our line
      const clear = c.r + 0.6;
      if (Math.abs(lateral) >= clear) continue;
      const side = lateral >= 0 ? -1 : 1; // go round the side away from the obstacle centre
      const w = 1 - Math.abs(lateral) / clear;
      out.x = dx + side * dz * (0.6 + w);
      out.z = dz - side * dx * (0.6 + w);
      const l = Math.hypot(out.x, out.z);
      out.x /= l;
      out.z /= l;
      break;
    }
    return out;
  }

  goHome() {
    this.state = "return";
    this.alert = 0.5;
    this.setPose("stand"); // resets the fist-shaking arm
    if (this.kind === "walker") {
      // rejoin the loop at the nearest point
      const p = this.root.position;
      this.path.t = Math.atan2(p.z / PATH.rz, p.x / PATH.rx);
      this.home.set(PATH.rx * Math.cos(this.path.t), 0, PATH.rz * Math.sin(this.path.t));
    }
  }

  updateReturn(dt, g) {
    const p = this.root.position;
    const dx = this.home.x - p.x, dz = this.home.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.2) {
      p.copy(this.home);
      this.moving = 0;
      if (this.kind === "walker") {
        this.state = "walk";
      } else {
        this.state = "idle";
        this.root.rotation.y = this.homeFacing;
        this.setPose(this.homePose);
      }
      this.torso.rotation.y = 0;
      return;
    }
    const s = 2.8;
    const step = Math.min(d, s * dt);
    p.x += (dx / d) * step;
    p.z += (dz / d) * step;
    this.root.rotation.y += wrap(Math.atan2(dx, dz) - this.root.rotation.y) * Math.min(1, dt * 8);
    this.moving = s;
    if (d > 2.5) this.collide(g, true);
    // still watching on the way back
    this.turnTorsoTo(0, 2, dt);
    this.detect(dt * 0.6, g, Math.hypot(g.ibis.pos.x - p.x, g.ibis.pos.z - p.z));
  }

  collide(g) {
    const p = this.root.position;
    for (const c of g.colliders) pushOut(p, c.x, c.z, c.r + 0.35);
    p.x = Math.min(BOUNDS.maxX, Math.max(BOUNDS.minX, p.x));
    p.z = Math.min(BOUNDS.maxZ, Math.max(BOUNDS.minZ, p.z));
  }

  animate(dt) {
    const m = this.moving || 0;
    if (this.pose === "stand" && m > 0) {
      this.phase += dt * (2 + m * 1.6);
      const a = Math.min(1, m / 4) * 0.8;
      this.legs[0].rotation.x = Math.sin(this.phase) * a;
      this.legs[1].rotation.x = -Math.sin(this.phase) * a;
      if (this.kind !== "walker" || this.state === "chase") {
        this.arms[0].rotation.x = -Math.sin(this.phase) * a;
        this.arms[1].rotation.x = Math.sin(this.phase) * a;
      }
      if (this.state === "chase") this.arms[1].rotation.x = -2.6 + Math.sin(this.phase * 2) * 0.4; // shaking a fist
      this.torso.position.y = Math.abs(Math.sin(this.phase)) * 0.06;
    } else {
      this.torso.position.y = Math.sin(performance.now() / 700 + this.phase) * 0.01;
    }
    this.moving = 0;
  }

  updateCone() {
    this.cone.position.x = this.root.position.x;
    this.cone.position.z = this.root.position.z;
    this.cone.rotation.y = this.lookAngle();
    const a = this.state === "chase" ? 1 : this.alert;
    this.coneMat.color.copy(CONE_CALM).lerp(CONE_ALERT, Math.min(1, a));
    this.coneMat.opacity = 0.13 + a * 0.22;
    this.cone.visible = this.state !== "chase" && this.state !== "return";
  }
}
