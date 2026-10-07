// The player: an Australian white ibis. Bald black head, scythe beak,
// questionable morals.

import * as THREE from "three";
import { part } from "./toon.js";
import { BOUNDS } from "./world.js";

export const WALK = 4.4;
export const RUN = 7.2;
const AIR = 6.4;
const FLAP_V = 6.8;
const GRAVITY = 22;
const GLIDE_GRAVITY = 6;
export const MAX_STAMINA = 3;

const WHITE = 0xf2eee3, INK = 0x1f1c1a;

function wrap(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export class Ibis {
  constructor(scene) {
    this.root = new THREE.Group();
    this.body = new THREE.Group(); // bobs while walking
    this.root.add(this.body);

    const torso = part(new THREE.SphereGeometry(1, 18, 14), WHITE, { outline: 0.05 });
    torso.scale.set(0.42, 0.4, 0.66);
    torso.position.set(0, 1.0, 0);
    this.body.add(torso);

    const tail = part(new THREE.ConeGeometry(0.22, 0.6, 7), INK, { outline: 0.03 });
    tail.rotation.x = -Math.PI / 2 - 0.35;
    tail.position.set(0, 0.92, -0.68);
    this.body.add(tail);

    this.wings = [];
    for (const s of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(s * 0.32, 1.12, 0.05);
      const wing = part(new THREE.SphereGeometry(1, 12, 8), WHITE, { outline: 0.04 });
      wing.scale.set(0.5, 0.08, 0.5);
      wing.position.set(s * 0.42, 0, -0.08);
      const tip = part(new THREE.SphereGeometry(1, 10, 6), INK);
      tip.scale.set(0.24, 0.07, 0.3);
      tip.position.set(s * 0.82, -0.01, -0.22);
      pivot.add(wing, tip);
      pivot.rotation.z = s * -1.25; // folded against the body
      pivot.userData.side = s;
      this.body.add(pivot);
      this.wings.push(pivot);
    }

    this.legs = [];
    for (const s of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(s * 0.14, 0.78, 0.05);
      const leg = part(new THREE.CylinderGeometry(0.035, 0.03, 0.78, 6), INK);
      leg.position.y = -0.39;
      const foot = part(new THREE.BoxGeometry(0.16, 0.03, 0.24), INK);
      foot.position.set(0, -0.77, 0.06);
      hip.add(leg, foot);
      this.root.add(hip);
      this.legs.push(hip);
    }

    // Neck + head pivot so the bird can peck
    this.neck = new THREE.Group();
    this.neck.position.set(0, 1.15, 0.48);
    const neckMesh = part(new THREE.CylinderGeometry(0.075, 0.11, 0.62, 8), INK, { outline: 0.025 });
    neckMesh.position.set(0, 0.28, 0.06);
    neckMesh.rotation.x = 0.22;
    const ruff = part(new THREE.SphereGeometry(0.17, 10, 8), WHITE, { outline: 0.02 });
    ruff.position.set(0, 0.02, 0);
    this.head = new THREE.Group();
    this.head.position.set(0, 0.6, 0.14);
    const skull = part(new THREE.SphereGeometry(0.16, 12, 10), INK, { outline: 0.025 });
    skull.scale.set(0.9, 1, 1.15);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 6), new THREE.MeshBasicMaterial({ color: 0x8b1d1d }));
    const eye2 = eye.clone();
    eye.position.set(0.12, 0.04, 0.05);
    eye2.position.set(-0.12, 0.04, 0.05);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.01, 0.12),
      new THREE.Vector3(0, -0.05, 0.42),
      new THREE.Vector3(0, -0.18, 0.68),
      new THREE.Vector3(0, -0.38, 0.8),
    ]);
    const beak = part(new THREE.TubeGeometry(curve, 16, 0.04, 6, false), INK, { outline: 0.012 });
    this.beakSlot = new THREE.Group();
    this.beakSlot.position.set(0, -0.4, 0.82);
    this.head.add(skull, eye, eye2, beak, this.beakSlot);
    this.neck.add(neckMesh, ruff, this.head);
    this.body.add(this.neck);

    // Soft ground shadow blob for readability while airborne
    this.blob = new THREE.Mesh(
      new THREE.CircleGeometry(0.55, 20),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false }),
    );
    this.blob.rotation.x = -Math.PI / 2;
    scene.add(this.blob);

    scene.add(this.root);

    this.pos = this.root.position.set(0, 0, 14);
    this.vel = new THREE.Vector3();
    this.vy = 0;
    this.heading = Math.PI;
    this.onGround = true;
    this.stamina = MAX_STAMINA;
    this.carry = null;
    this.stun = 0;
    this.speed = 0;
    this.running = false;
    this.hidden = false;
    this.peck = 0; // >0 while pecking/eating
    this.honk = 0;
    this.phase = 0;
    this.flapAnim = 0;
    this._f = new THREE.Vector3();
  }

  reset() {
    this.pos.set(0, 0, 14);
    this.vel.set(0, 0, 0);
    this.vy = 0;
    this.heading = Math.PI;
    this.onGround = true;
    this.stamina = MAX_STAMINA;
    this.carry = null;
    this.stun = 0;
  }

  forward(out = this._f) {
    return out.set(Math.sin(this.heading), 0, Math.cos(this.heading));
  }

  // Returns true if a flap happened this frame (for sfx).
  update(dt, input, colliders, people) {
    let flapped = false;
    const ix = input.axis.x, iz = input.axis.z;
    const mag = Math.min(1, Math.hypot(ix, iz));
    const control = this.stun <= 0;
    this.stun = Math.max(0, this.stun - dt);

    this.running = input.held("run") || input.axis.boost;
    let max = this.onGround ? (this.running ? RUN : WALK) : AIR;
    if (this.carry) max *= 0.9;
    const tx = control ? (ix / (mag || 1)) * mag * max : 0;
    const tz = control ? (iz / (mag || 1)) * mag * max : 0;
    const k = 1 - Math.exp(-(this.onGround ? 12 : 4) * dt);
    this.vel.x += (tx - this.vel.x) * k;
    this.vel.z += (tz - this.vel.z) * k;

    if (control && mag > 0.1) {
      const target = Math.atan2(ix, iz);
      const d = wrap(target - this.heading);
      this.heading += Math.sign(d) * Math.min(Math.abs(d), 13 * dt);
    }

    // Flap / glide
    if (control && input.consume("flap") && this.stamina >= 1) {
      this.vy = FLAP_V;
      this.stamina -= 1;
      this.onGround = false;
      this.flapAnim = 0.35;
      flapped = true;
    }
    const gliding = !this.onGround && this.vy < 0 && input.held("flap");
    this.vy -= (gliding ? GLIDE_GRAVITY : GRAVITY) * dt;
    if (gliding) this.vy = Math.max(this.vy, -2.4);

    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    this.pos.y += this.vy * dt;
    if (this.pos.y <= 0) {
      this.pos.y = 0;
      this.vy = 0;
      this.onGround = true;
    }
    if (this.onGround) this.stamina = Math.min(MAX_STAMINA, this.stamina + 0.75 * dt);

    // Collisions
    for (const c of colliders) {
      if (this.pos.y > c.h) continue;
      pushOut(this.pos, c.x, c.z, c.r + 0.4);
    }
    if (this.onGround) for (const p of people) pushOut(this.pos, p.root.position.x, p.root.position.z, 0.75);
    this.pos.x = Math.min(BOUNDS.maxX, Math.max(BOUNDS.minX, this.pos.x));
    this.pos.z = Math.min(BOUNDS.maxZ, Math.max(BOUNDS.minZ, this.pos.z));

    this.speed = Math.hypot(this.vel.x, this.vel.z);
    this.animate(dt, gliding);
    return flapped;
  }

  animate(dt, gliding) {
    this.root.rotation.y = this.heading;
    const sp = this.speed;
    const t = performance.now() / 1000;

    if (this.onGround) {
      this.phase += dt * (3 + sp * 2.1);
      const amp = Math.min(1, sp / WALK) * 0.65;
      this.legs[0].rotation.x = Math.sin(this.phase) * amp;
      this.legs[1].rotation.x = -Math.sin(this.phase) * amp;
      this.body.position.y = Math.abs(Math.sin(this.phase)) * 0.06 * Math.min(1, sp / WALK);
      this.body.rotation.z = Math.sin(this.phase) * 0.05 * Math.min(1, sp / WALK);
    } else {
      this.legs[0].rotation.x = this.legs[1].rotation.x = -0.9;
      this.body.position.y = 0;
      this.body.rotation.z = 0;
    }

    // Wings
    this.flapAnim = Math.max(0, this.flapAnim - dt);
    for (const w of this.wings) {
      const s = w.userData.side;
      let target;
      if (this.flapAnim > 0) target = s * (Math.sin(t * 34) * 0.9);
      else if (!this.onGround) target = gliding ? s * 0.1 : s * Math.sin(t * 18) * 0.7;
      else if (this.honk > 0) target = s * -0.4;
      else target = s * -1.25;
      w.rotation.z += (target - w.rotation.z) * Math.min(1, dt * 20);
    }

    // Neck: peck / honk / idle head-bob
    this.honk = Math.max(0, this.honk - dt);
    let nx = this.onGround ? Math.sin(this.phase * 2) * 0.12 * Math.min(1, sp / WALK) : -0.25;
    if (this.peck > 0) nx = 0.9 + Math.sin(t * 26) * 0.35;
    if (this.honk > 0) nx = -0.7;
    if (this.stun > 0) nx = Math.sin(t * 30) * 0.4;
    this.neck.rotation.x += (nx - this.neck.rotation.x) * Math.min(1, dt * 18);

    this.blob.position.set(this.pos.x, 0.03, this.pos.z);
    const h = Math.min(1, this.pos.y / 6);
    this.blob.scale.setScalar(1 - h * 0.5);
    this.blob.material.opacity = 0.25 * (1 - h * 0.6);
  }
}

function pushOut(p, x, z, r) {
  const dx = p.x - x, dz = p.z - z;
  const d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return;
  const d = Math.sqrt(d2) || 0.0001;
  p.x = x + (dx / d) * r;
  p.z = z + (dz / d) * r;
}
export { pushOut, wrap };
