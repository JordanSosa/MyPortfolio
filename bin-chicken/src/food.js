// Stealable food. Big items go in the beak and must be scoffed; scraps are
// eaten on contact.

import * as THREE from "three";
import { part } from "./toon.js";

export const FOOD = {
  chips: { name: "hot chips", points: 30, big: true },
  snag: { name: "snag in bread", points: 25, big: true },
  pie: { name: "meat pie", points: 35, big: true },
  sandwich: { name: "sandwich", points: 20, big: true },
  scrap: { name: "scrap", points: 5, big: false },
};
export const BIG_TYPES = ["chips", "chips", "snag", "pie", "sandwich"];

const G = {
  box: (w, h, d) => new THREE.BoxGeometry(w, h, d),
};

function buildMesh(type) {
  const g = new THREE.Group();
  switch (type) {
    case "chips": {
      const box = part(G.box(0.34, 0.24, 0.24), 0xd93a2f, { outline: 0.015 });
      box.position.y = 0.12;
      const band = part(G.box(0.35, 0.06, 0.25), 0xfafafa, { shadow: false });
      band.position.y = 0.16;
      g.add(box, band);
      for (let i = 0; i < 9; i++) {
        const c = part(G.box(0.045, 0.28, 0.045), 0xf4c542, { shadow: false });
        c.position.set((Math.random() - 0.5) * 0.24, 0.3, (Math.random() - 0.5) * 0.16);
        c.rotation.set((Math.random() - 0.5) * 0.6, 0, (Math.random() - 0.5) * 0.6);
        g.add(c);
      }
      break;
    }
    case "snag": {
      const bread = part(new THREE.CapsuleGeometry(0.1, 0.36, 4, 8), 0xf0c27a, { outline: 0.015 });
      bread.rotation.z = Math.PI / 2;
      bread.position.y = 0.1;
      const sausage = part(new THREE.CapsuleGeometry(0.065, 0.46, 4, 8), 0x9c4122, { outline: 0.012 });
      sausage.rotation.z = Math.PI / 2;
      sausage.position.y = 0.18;
      const sauce = part(G.box(0.36, 0.025, 0.03), 0xd8231f, { shadow: false });
      sauce.position.y = 0.245;
      const onion = part(G.box(0.3, 0.02, 0.05), 0xf2e3b3, { shadow: false });
      onion.position.set(0, 0.235, 0.04);
      g.add(bread, sausage, sauce, onion);
      break;
    }
    case "pie": {
      const crust = part(new THREE.CylinderGeometry(0.2, 0.16, 0.12, 14), 0xc98a3d, { outline: 0.015 });
      crust.position.y = 0.06;
      const lid = part(new THREE.CylinderGeometry(0.19, 0.2, 0.04, 14), 0xdca052, { shadow: false });
      lid.position.y = 0.14;
      const sauce = part(new THREE.SphereGeometry(0.08, 8, 6), 0xd8231f, { shadow: false });
      sauce.scale.y = 0.5;
      sauce.position.y = 0.17;
      const bag = part(G.box(0.46, 0.01, 0.46), 0xffffff, { shadow: false });
      g.add(bag, crust, lid, sauce);
      break;
    }
    case "sandwich": {
      for (const [y, c, s] of [[0.04, 0xf3dfb0, 1], [0.09, 0x7bc043, 1.08], [0.12, 0xe0544a, 1], [0.16, 0xf3dfb0, 1]]) {
        const layer = part(new THREE.CylinderGeometry(0.24 * s, 0.24 * s, y === 0.09 || y === 0.12 ? 0.03 : 0.06, 3), c, { outline: c === 0xf3dfb0 ? 0.012 : 0 });
        layer.position.y = y;
        g.add(layer);
      }
      break;
    }
    default: {
      // scrap: a stray chip, a crust or a nugget
      const pick = Math.floor(Math.random() * 3);
      const m =
        pick === 0 ? part(G.box(0.05, 0.05, 0.26), 0xf4c542, { shadow: false })
        : pick === 1 ? part(G.box(0.2, 0.06, 0.12), 0xd9a45c, { shadow: false })
        : part(new THREE.SphereGeometry(0.09, 7, 5), 0xc7863a, { shadow: false });
      m.position.y = 0.04;
      m.rotation.y = Math.random() * Math.PI;
      g.add(m);
    }
  }
  g.scale.setScalar(type === "scrap" ? 1.4 : 1.3);
  return g;
}

export class Food {
  constructor(type) {
    this.type = type;
    this.def = FOOD[type];
    this.mesh = buildMesh(type);
    this.state = "served"; // served | held | carried | ground | gone
    this.spot = null;
    this.slot = -1;
    this._v = new THREE.Vector3();
  }
  worldPos(out = this._v) {
    return this.mesh.getWorldPosition(out);
  }
  place(parent, pos, state) {
    parent.add(this.mesh);
    this.mesh.position.copy(pos);
    this.mesh.rotation.set(0, Math.random() * Math.PI * 2, 0);
    this.state = state;
  }
  dispose() {
    this.mesh.removeFromParent();
    this.state = "gone";
  }
}
