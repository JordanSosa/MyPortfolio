import * as THREE from "three";
import { gsap } from "gsap";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { mergeVertices, mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// ============================================================================
// scene.js — the whole 3D tract.
//
// ONE CatmullRomCurve3 runs through all six organ segments end to end. The
// camera position and lookAt are sampled from this single curve at a progress
// value driven by scroll. Each organ is a group whose visibility toggles based
// on proximity to the camera so the whole tract isn't active at once.
//
// VISUAL SYSTEM (v2 — "wet, fleshy, alive"):
//  · The tract wall is a single tube whose vertices are displaced with layered
//    noise + per-organ anatomy (esophageal rings, stomach rugae, plicae
//    circulares, colonic haustra) so nothing reads as a smooth cylinder.
//  · Every flesh material goes through _wetify(): fragment-shader bump noise
//    (fine mucosal texture, slowly drifting), fresnel rim translucency (fake
//    subsurface warmth), roughness modulated by drifting "mucus" noise so wet
//    glints crawl across surfaces. Everything respects scene fog.
//  · Bioluminescent accent lights are embedded along the tract and faded by
//    proximity (intensity, not visibility, so shader programs never recompile).
//  · Desktop gets EffectComposer + UnrealBloom for the glow; mobile/low-memory
//    renders straight and keeps reduced instance budgets.
// ============================================================================

// Linear interpolation of two hex colours into a THREE.Color (reused buffer).
const _cA = new THREE.Color();
const _cB = new THREE.Color();

// ---------------------------------------------------------------------------
// CPU-side value noise + fbm (deterministic, no texture assets — everything
// procedural). Used for one-time geometry displacement.
// ---------------------------------------------------------------------------
function hash3(x, y, z) {
  const n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return n - Math.floor(n);
}
function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const sx = xf * xf * (3 - 2 * xf), sy = yf * yf * (3 - 2 * yf), sz = zf * zf * (3 - 2 * zf);
  const c000 = hash3(xi, yi, zi), c100 = hash3(xi + 1, yi, zi);
  const c010 = hash3(xi, yi + 1, zi), c110 = hash3(xi + 1, yi + 1, zi);
  const c001 = hash3(xi, yi, zi + 1), c101 = hash3(xi + 1, yi, zi + 1);
  const c011 = hash3(xi, yi + 1, zi + 1), c111 = hash3(xi + 1, yi + 1, zi + 1);
  const x00 = c000 + (c100 - c000) * sx, x10 = c010 + (c110 - c010) * sx;
  const x01 = c001 + (c101 - c001) * sx, x11 = c011 + (c111 - c011) * sx;
  const y0 = x00 + (x10 - x00) * sy, y1 = x01 + (x11 - x01) * sy;
  return y0 + (y1 - y0) * sz; // 0..1
}
function fbm3(x, y, z) {
  let v = 0, a = 0.5, f = 1;
  for (let k = 0; k < 3; k++) {
    v += a * vnoise(x * f, y * f, z * f);
    f *= 2.07;
    a *= 0.5;
  }
  return v / 0.875; // ~0..1
}
const sstep = (a, b, x) => {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// ---------------------------------------------------------------------------
// GLSL value noise + fbm, injected into fragment shaders for living mucosa.
// ---------------------------------------------------------------------------
const NOISE_GLSL = /* glsl */ `
float swHash(vec3 p) {
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
}
float swNoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n000 = swHash(i);
  float n100 = swHash(i + vec3(1.0, 0.0, 0.0));
  float n010 = swHash(i + vec3(0.0, 1.0, 0.0));
  float n110 = swHash(i + vec3(1.0, 1.0, 0.0));
  float n001 = swHash(i + vec3(0.0, 0.0, 1.0));
  float n101 = swHash(i + vec3(1.0, 0.0, 1.0));
  float n011 = swHash(i + vec3(0.0, 1.0, 1.0));
  float n111 = swHash(i + vec3(1.0, 1.0, 1.0));
  return mix(
    mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
    mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y),
    f.z
  );
}
float swFbm(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  for (int k = 0; k < 3; k++) {
    v += a * swNoise(p);
    p *= 2.07;
    a *= 0.5;
  }
  return v * 1.142;
}
`;

export class TractScene {
  constructor(root, opts = {}) {
    this.root = root;
    this.lowPerf = !!opts.lowPerf;
    this.reduced = !!opts.reduced;
    this.progress = 0;
    this.running = false;
    this.clock = new THREE.Clock();
    this._tmpV = new THREE.Vector3();
    this._tmpV2 = new THREE.Vector3();
    this._lookTarget = new THREE.Vector3();
    this.lookYaw = 0;     // user drag look (clamped)
    this.lookPitch = 0;
    this.stageGroups = {};
    this.disposables = [];
    // single shared clock uniform for every shader injection
    this.globalUniforms = { uTime: { value: 0 } };

    this._initRenderer();
    this._initSceneCamera();
    this._buildCurve();
    this._buildTube();
    this._buildAtmosphere();
    this._buildOrgans();
    this._initComposer();
    this._bindResize();
  }

  // ----- particle / instance budgets (scaled down on low-perf) -----
  get budgets() {
    const s = this.lowPerf ? 0.4 : 1.0;
    return {
      villi: Math.round(4200 * s),
      bacteria: Math.round(1800 * s),
      bubbles: Math.round(240 * s),
      saliva: Math.round(260 * s),
      motes: Math.round(420 * s),
      ambient: Math.round(700 * s),
    };
  }

  _initRenderer() {
    const isDesktop = window.innerWidth >= 768 && !this.lowPerf;
    this.renderer = new THREE.WebGLRenderer({
      antialias: isDesktop,
      alpha: false,
      powerPreference: "high-performance",
    });
    // bloom composer pays its own fill-rate cost, so cap DPR tighter when on
    const prCap = this.lowPerf ? 1.25 : (isDesktop ? 1.5 : 2);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, prCap));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0x120d0a, 1);
    // filmic curve: deep shadows, soft highlight rolloff — sells "wet cave"
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.root.appendChild(this.renderer.domElement);
  }

  _initSceneCamera() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x1a1012, 0.035);

    this.camera = new THREE.PerspectiveCamera(
      72, window.innerWidth / window.innerHeight, 0.05, 60
    );

    // Lighting rig:
    //  · low ambient so the tract ahead falls into fog-darkness
    //  · faint directional key (just enough to model the teeth)
    //  · warm headlamp riding the camera — the wet-specular workhorse
    //  · a coloured fill floating ahead of the camera, recoloured per stage
    //  · bioluminescent accents embedded along the tract (created once,
    //    intensity faded by proximity so light COUNT never changes — that
    //    keeps three.js from recompiling every program mid-flight)
    this.ambient = new THREE.AmbientLight(0xe8868c, 0.32);
    this.scene.add(this.ambient);

    this.key = new THREE.DirectionalLight(0xffffff, 0.35);
    this.key.position.set(2, 4, 2);
    this.scene.add(this.key);

    this.headlamp = new THREE.PointLight(0xffe9b0, 7.0, 14, 1.7);
    this.scene.add(this.headlamp);

    this.fill = new THREE.PointLight(0xe8868c, 1.6, 9, 1.8);
    this.scene.add(this.fill);

    // embedded accents — placed after the curve exists (see _buildCurve)
    this.accents = [];
  }

  // helper: register an embedded bioluminescent accent light
  _accent(color, intensity, dist, u, width, opts = {}) {
    const l = new THREE.PointLight(color, 0, dist, 1.8);
    l.position.copy(this.curve.getPointAt(u, new THREE.Vector3()));
    if (opts.offset) l.position.add(opts.offset);
    this.scene.add(l);
    this.accents.push({ light: l, base: intensity, u, width, flicker: opts.flicker || 0 });
    return l;
  }

  // ----- the single curve through all six organs -----
  _buildCurve() {
    // Hand-laid control points: descend in Y, meander in X/Z so it reads like
    // a real tract. Segments are consecutive spans of this one curve.
    // mouth ~ top, then throat, stomach pocket, coiled small intestine, wider
    // colon loop, exit straight down to light.
    const P = (x, y, z) => new THREE.Vector3(x, y, z);
    const pts = [
      // bite + mouth (open cavern, slight forward travel)
      P(0, 0, 0), P(0.2, -0.6, 0.4), P(-0.1, -1.4, 0.2),
      // esophagus — straightish tube down
      P(0.1, -2.6, 0), P(-0.1, -3.8, 0.1), P(0.05, -5.0, -0.1),
      // stomach — a big curved pocket to the side
      P(0.8, -6.0, 0.3), P(1.6, -6.7, -0.2), P(1.0, -7.6, -0.6), P(0.0, -7.9, 0.0),
      // small intestine — coils (the long showpiece)
      P(-1.0, -8.6, 0.6), P(-1.4, -9.4, -0.4), P(-0.6, -10.0, -1.0),
      P(0.4, -10.5, -0.3), P(1.0, -11.1, 0.6), P(0.3, -11.8, 1.2),
      P(-0.8, -12.3, 0.6), P(-1.2, -13.0, -0.4), P(-0.4, -13.6, -1.0),
      P(0.6, -14.1, -0.4), P(0.9, -14.8, 0.5),
      // large intestine — wider sweeping loop
      P(0.0, -15.6, 1.0), P(-1.2, -16.2, 0.4), P(-1.6, -17.0, -0.6),
      P(-0.6, -17.7, -1.0), P(0.6, -18.2, -0.4),
      // rectum + exit — straight drop toward the light
      P(0.2, -19.0, 0.0), P(0.0, -20.0, 0.0), P(0.0, -21.4, 0.0),
    ];
    this.curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.5);
    this.curveLen = this.curve.getLength();

    // Bioluminescent accents along the tract (constant light count — see note
    // in _initSceneCamera). Low-perf keeps only the cheapest essentials.
    // stomach ember glow above the acid pool
    this.emberLight = this._accent(0xff7a26, 3.2, 7, 0.42, 0.12, { flicker: 0.35 });
    // bile flood at the duodenum — green wash
    this.bileLight = this._accent(0x7fc24a, 5, 6, 0.515, 0.05, { flicker: 0.2 });
    // villi cathedral — the money glow
    this.cathedralLight = this._accent(0xffe9b0, 3.2, 11, 0.62, 0.16);
    if (!this.lowPerf) {
      // capillary warmth deeper in the small intestine
      this.capillaryLight = this._accent(0xff5e4a, 4, 6, 0.7, 0.08);
      // microbe glow in the colon
      this.microbeLight = this._accent(0x9fd07a, 3.5, 7, 0.8, 0.1, { flicker: 0.25 });
      this.microbeLight2 = this._accent(0x6fae5a, 3, 6, 0.875, 0.08, { flicker: 0.25 });
    }
    // the literal light at the end of the tunnel
    this.exitLight = this._accent(0xfbfaf6, 0, 10, 1.0, 1.0);
    this.exitLight.position.add(new THREE.Vector3(0, -1.2, 0));
  }

  // -------------------------------------------------------------------------
  // _wetify(material, opts) — the shared "living mucosa" shader injection.
  //  · vertex: optional extra deformation code + world-position varying
  //  · fragment: drifting fbm bump perturbation (fine wet texture),
  //    mucus-noise roughness modulation with glossy glint patches,
  //    fresnel rim translucency (warm light bleeding through flesh edges).
  // -------------------------------------------------------------------------
  _wetify(mat, opts = {}) {
    const u = {
      uTime: this.globalUniforms.uTime,
      uRimC: { value: new THREE.Color(opts.rim !== undefined ? opts.rim : 0xe8868c) },
      uRimS: { value: opts.rimStrength !== undefined ? opts.rimStrength : 0.55 },
      uBumpScale: { value: opts.bumpScale !== undefined ? opts.bumpScale : 0.55 },
      uBumpFreq: { value: opts.bumpFreq !== undefined ? opts.bumpFreq : 13.0 },
      uGlint: { value: opts.glint !== undefined ? opts.glint : 0.6 },
    };
    mat.userData.sw = u; // so palettes can retint the rim later
    const vertexDecl = opts.vertexDecl || "";
    const extraVertex = opts.extraVertex || "";
    const extraFrag = opts.extraFrag || "";
    const extraFragDecl = opts.extraFragDecl || "";
    const vertexNoise = opts.vertexNoise ? NOISE_GLSL : "";

    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, u);
      if (opts.uniforms) Object.assign(shader.uniforms, opts.uniforms);

      shader.vertexShader =
        `uniform float uTime;\nvarying vec3 vWPos;\n${vertexDecl}\n${vertexNoise}\n` +
        shader.vertexShader
          .replace(
            "#include <begin_vertex>",
            `#include <begin_vertex>\n${extraVertex}`
          )
          .replace(
            "#include <project_vertex>",
            `vec4 swWP = vec4(transformed, 1.0);
             #ifdef USE_INSTANCING
               swWP = instanceMatrix * swWP;
             #endif
             vWPos = (modelMatrix * swWP).xyz;
             #include <project_vertex>`
          );

      shader.fragmentShader =
        `uniform float uTime;\nuniform vec3 uRimC;\nuniform float uRimS;\n` +
        `uniform float uBumpScale;\nuniform float uBumpFreq;\nuniform float uGlint;\n` +
        `varying vec3 vWPos;\n${NOISE_GLSL}\n${extraFragDecl}\n` +
        shader.fragmentShader
          .replace(
            "#include <roughnessmap_fragment>",
            `#include <roughnessmap_fragment>
             // drifting mucus film: patches go glassy-wet, others stay matte
             float swMucus = swFbm(vWPos * 5.0 + vec3(0.0, uTime * 0.05, uTime * 0.03));
             roughnessFactor = clamp(roughnessFactor - swMucus * 0.22, 0.05, 1.0);
             roughnessFactor = mix(roughnessFactor, 0.03, smoothstep(0.62, 0.8, swMucus) * uGlint);`
          )
          .replace(
            "#include <normal_fragment_maps>",
            `// procedural mucosal bump: derivative-based perturbation of an
             // fbm height field anchored in world space, drifting slowly so
             // the surface feels alive
             float swH = swFbm(vWPos * uBumpFreq + vec3(0.0, uTime * 0.035, 0.0));
             swH += swNoise(vWPos * uBumpFreq * 3.7) * 0.25;
             vec2 swDh = vec2(dFdx(swH), dFdy(swH)) * uBumpScale;
             vec3 swSP = -vViewPosition;
             vec3 swSx = dFdx(swSP);
             vec3 swSy = dFdy(swSP);
             vec3 swR1 = cross(swSy, normal);
             vec3 swR2 = cross(normal, swSx);
             float swDet = dot(swSx, swR1) * faceDirection;
             vec3 swGrad = sign(swDet) * (swDh.x * swR1 + swDh.y * swR2);
             normal = normalize(abs(swDet) * normal - swGrad);
             #include <normal_fragment_maps>`
          )
          .replace(
            "#include <emissivemap_fragment>",
            `#include <emissivemap_fragment>
             // fresnel rim translucency — warm interior light bleeding through
             // flesh edges (cheap fake subsurface scattering)
             vec3 swV = normalize(vViewPosition);
             float swFres = pow(1.0 - abs(dot(swV, normal)), 2.6);
             totalEmissiveRadiance += uRimC * (swFres * uRimS * (0.55 + 0.45 * swMucus));
             // travelling specular-ish glints in the mucus sheen
             totalEmissiveRadiance += vec3(1.0, 0.97, 0.9) * (uGlint * 0.07 *
               smoothstep(0.74, 0.86, swFbm(vWPos * 16.0 - vec3(uTime * 0.06, uTime * 0.04, 0.0))));
             ${extraFrag}`
          );
    };
    return u;
  }

  // -------------------------------------------------------------------------
  // Per-organ anatomical wall displacement. u along curve, ang around it.
  // Positive = outward bulge, negative = fold protruding into the lumen.
  // The camera flies the centreline, so inward folds stay <= ~0.3.
  // -------------------------------------------------------------------------
  _wallDelta(u, ang, p) {
    const lump = fbm3(p.x * 1.5, p.y * 1.5, p.z * 1.5);          // broad flesh
    const wob = fbm3(p.x * 0.6 + 9.0, p.y * 0.6, p.z * 0.6);     // slow warp
    let d = (lump - 0.45) * 0.24;
    // soft longitudinal folds everywhere (mucosa never lies flat)
    d += Math.sin(ang * 5.0 + wob * 8.0) * 0.04;

    const win = (a, b, f = 0.02) => sstep(a - f, a + f, u) * (1 - sstep(b - f, b + f, u));

    // mouth — a wider cavern that relaxes into the throat
    const wm = 1 - sstep(0.1, 0.16, u);
    d += wm * (0.5 + 0.25 * Math.sin(ang + 1.2) + 0.2 * lump);

    // esophagus — ribbed muscular rings + inward longitudinal folds
    const we = win(0.155, 0.335);
    d += we * (Math.pow(Math.abs(Math.sin(u * 760.0)), 0.65) - 0.55) * 0.13;
    d -= we * Math.pow(Math.sin(ang * 4.0 + 1.7) * 0.5 + 0.5, 2.0) * 0.12;

    // stomach — cavernous asymmetric swell + deep wandering rugae
    const ws = win(0.335, 0.505, 0.018);
    const swell = ws * Math.exp(-Math.pow((u - 0.42) / 0.075, 2));
    d += swell * (0.95 + 0.55 * Math.sin(ang + u * 28.0) + 0.45 * lump);
    const rug = Math.pow(Math.sin(ang * 7.0 + Math.sin(u * 52.0) * 1.7 + lump * 4.5) * 0.5 + 0.5, 1.6);
    d -= ws * rug * 0.3 * (0.45 + swell);

    // small intestine — tight circular folds (plicae circulares)
    const wsi = win(0.5, 0.745, 0.014);
    const plic = Math.pow(Math.sin(u * 1500.0 + Math.sin(ang * 2.0) * 0.9) * 0.5 + 0.5, 2.1);
    d -= wsi * plic * 0.16;

    // colon — haustra pouches cinched by three taeniae bands
    const wc = win(0.745, 0.925, 0.018);
    const pouch = Math.pow(Math.max(Math.sin(u * 330.0 + wob * 2.0), 0.0), 0.65);
    const taeniae = Math.pow(Math.abs(Math.cos(ang * 1.5 + 0.4)), 14.0);
    d += wc * (pouch * 0.52 * (1.0 - taeniae * 0.85) - 0.06 - taeniae * 0.1);

    return Math.max(d, -0.3);
  }

  // ----- continuous tube geometry for the whole tract -----
  _buildTube() {
    const segments = this.lowPerf ? 480 : 1000;
    const radialSeg = this.lowPerf ? 18 : 30;
    const geo = new THREE.TubeGeometry(this.curve, segments, 0.85, radialSeg, false);
    this._tubularSegs = segments;
    this._radialSegs = radialSeg;

    // Store base positions + per-vertex curve-u so we can do peristalsis on GPU.
    const pos = geo.attributes.position;
    const nrmAttr = geo.attributes.normal;
    const count = pos.count;
    const uArr = new Float32Array(count);
    const uv = geo.attributes.uv;
    const v = new THREE.Vector3();
    const nv = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      const tu = uv.getX(i); // tube u runs 0..1 along length
      uArr[i] = tu;
      // anatomical displacement along the (radial) tube normal
      const ang = uv.getY(i) * Math.PI * 2;
      v.fromBufferAttribute(pos, i);
      nv.fromBufferAttribute(nrmAttr, i);
      v.addScaledVector(nv, this._wallDelta(tu, ang, v));
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    geo.setAttribute("aU", new THREE.BufferAttribute(uArr, 1));
    geo.computeVertexNormals();
    this._weldTubeSeam(geo);

    // Wet, fleshy inner-wall material: peristalsis wave in the vertex stage +
    // the full _wetify mucosa treatment in the fragment stage.
    const mat = new THREE.MeshStandardMaterial({
      color: 0xc25a66,
      roughness: 0.42,
      metalness: 0.0,
      side: THREE.BackSide, // we fly *inside* the tube
      flatShading: false,
    });
    this.tubeUniforms = {
      uTime: this.globalUniforms.uTime,
      uProgress: { value: 0 },
    };
    this.tubeWet = this._wetify(mat, {
      rim: 0xe8868c,
      rimStrength: 0.5,
      bumpScale: 0.7,
      bumpFreq: 11.0,
      glint: 0.7,
      uniforms: { uProgress: this.tubeUniforms.uProgress },
      vertexDecl: "attribute float aU;\nuniform float uProgress;",
      extraVertex: `
        // travelling sine constriction = peristalsis wave behind the camera
        float wavePhase = (aU - uProgress) * 38.0 - uTime * 2.2;
        float pinch = sin(wavePhase) * 0.5 + 0.5;
        pinch = pow(pinch, 3.0) * 0.14;
        // breathe: the whole wall slowly swells and relaxes
        pinch += sin(uTime * 0.7 + aU * 60.0) * 0.018;
        transformed -= normal * pinch;
      `,
    });

    this.tube = new THREE.Mesh(geo, mat);
    this.tube.frustumCulled = false;
    this.scene.add(this.tube);
    this.tubeMat = mat;
    this.disposables.push(geo, mat);
  }

  // TubeGeometry duplicates the first/last radial vertex per ring; after
  // displacement + computeVertexNormals that shows as a lighting seam. Weld it.
  _weldTubeSeam(geo) {
    const n = geo.attributes.normal;
    const stride = this._radialSegs + 1;
    const rows = this._tubularSegs + 1;
    for (let i = 0; i < rows; i++) {
      const a = i * stride;
      const b = a + this._radialSegs;
      const nx = (n.getX(a) + n.getX(b)) * 0.5;
      const ny = (n.getY(a) + n.getY(b)) * 0.5;
      const nz = (n.getZ(a) + n.getZ(b)) * 0.5;
      n.setXYZ(a, nx, ny, nz);
      n.setXYZ(b, nx, ny, nz);
    }
    n.needsUpdate = true;
  }

  // Soft round particle sprite, drawn procedurally (no asset files).
  _spriteTexture() {
    if (this._sprite) return this._sprite;
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const ctx = c.getContext("2d");
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.35, "rgba(255,255,255,0.55)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    this._sprite = new THREE.CanvasTexture(c);
    this.disposables.push(this._sprite);
    return this._sprite;
  }

  // Floating particulate haze through the WHOLE tract — parallax depth in the
  // fog. Static buffer; all drift happens in the vertex shader (zero CPU/frame).
  _buildAtmosphere() {
    const n = this.budgets.ambient;
    const posArr = new Float32Array(n * 3);
    const seedArr = new Float32Array(n);
    const tmp = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      const u = Math.random();
      const ang = Math.random() * Math.PI * 2;
      const r = Math.random() * 0.62;
      const f = this._onWall(u, ang, r / 0.85);
      posArr[i * 3] = f.pt.x; posArr[i * 3 + 1] = f.pt.y; posArr[i * 3 + 2] = f.pt.z;
      seedArr[i] = Math.random() * 100;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(posArr, 3));
    geo.setAttribute("aSeed", new THREE.BufferAttribute(seedArr, 1));
    const mat = new THREE.PointsMaterial({
      size: 0.024,
      map: this._spriteTexture(),
      color: 0xffd9c2,
      transparent: true,
      opacity: 0.13,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.globalUniforms.uTime;
      shader.vertexShader =
        "uniform float uTime;\nattribute float aSeed;\nvarying float vFade;\n" +
        shader.vertexShader
          .replace(
            "#include <begin_vertex>",
            `#include <begin_vertex>
             transformed.x += sin(uTime * 0.32 + aSeed) * 0.07;
             transformed.y += sin(uTime * 0.21 + aSeed * 1.7) * 0.09;
             transformed.z += cos(uTime * 0.27 + aSeed * 0.9) * 0.07;`
          )
          .replace(
            "#include <project_vertex>",
            `#include <project_vertex>
             // fade motes that drift too close to the lens (screen-filling
             // washes) AND far ones (additive pile-up down the tube)
             vFade = smoothstep(0.18, 1.1, -mvPosition.z) * (1.0 - smoothstep(3.0, 6.5, -mvPosition.z));`
          );
      shader.fragmentShader =
        "varying float vFade;\n" +
        shader.fragmentShader.replace(
          "#include <map_particle_fragment>",
          `#include <map_particle_fragment>
           diffuseColor.a *= vFade;`
        );
    };
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    this.scene.add(pts);
    this.haze = pts;
    this.disposables.push(geo, mat);
  }

  // Position helper: place an object on the tube wall at curve-u with offset.
  _onWall(u, radial, depth, inward = 0.0) {
    const t = THREE.MathUtils.clamp(u, 0, 1);
    const pt = this.curve.getPointAt(t, this._tmpV.clone());
    const tan = this.curve.getTangentAt(t, this._tmpV2.clone()).normalize();
    // build a frame
    const up = Math.abs(tan.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const nx = new THREE.Vector3().crossVectors(tan, up).normalize();
    const ny = new THREE.Vector3().crossVectors(tan, nx).normalize();
    const r = 0.85 - inward;
    pt.addScaledVector(nx, Math.cos(radial) * r * depth);
    pt.addScaledVector(ny, Math.sin(radial) * r * depth);
    return { pt: pt.clone(), nx, ny, tan };
  }

  // ============================ ORGANS ============================
  _buildOrgans() {
    this._buildMouth();
    this._buildStomach();
    this._buildSmallIntestine(); // the peak
    this._buildLargeIntestine();
    this._buildExit();
  }

  _group(id, uStart, uEnd) {
    const g = new THREE.Group();
    g.userData = { uStart, uEnd };
    this.scene.add(g);
    this.stageGroups[id] = g;
    return g;
  }

  // Molar-ish tooth: a rounded box crown with cusps, welded + smoothed.
  _makeMolarGeo() {
    let g = new THREE.BoxGeometry(1, 1, 1, 5, 6, 5);
    g = mergeVertices(g, 1e-4);
    const p = g.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      // round the box toward a sphere (more at the crown)
      const sph = v.clone().normalize().multiplyScalar(0.74);
      v.lerp(sph, 0.5 + 0.22 * THREE.MathUtils.clamp(v.y + 0.5, 0, 1));
      // crown cusps: gentle bumps on the occlusal surface
      if (v.y > 0.1) {
        const k = (v.y - 0.1) / 0.45;
        v.y += 0.14 * Math.cos(v.x * 5.4) * Math.cos(v.z * 5.4) * k;
      }
      // slight waist at the neck (gum line)
      const waist = 1.0 - 0.16 * Math.exp(-Math.pow((v.y + 0.34) / 0.16, 2));
      p.setXYZ(i, v.x * waist, v.y, v.z * waist);
    }
    g.computeVertexNormals();
    g.scale(0.19, 0.34, 0.19);
    g.translate(0, 0.17, 0);
    return g;
  }

  // 1 · Mouth — molar monoliths, glistening tongue, saliva strands + droplets.
  _buildMouth() {
    const g = this._group("mouth", 0.0, 0.18);

    // Teeth: rounded molar crowns with enamel sheen + edge translucency.
    const toothGeo = this._makeMolarGeo();
    const enamel = new THREE.MeshStandardMaterial({
      color: 0xddd5bf, roughness: 0.24, metalness: 0.0,
    });
    // enamel gets a cool, glassy rim (translucent edges) instead of flesh warmth
    this._wetify(enamel, {
      rim: 0xb9d4e2, rimStrength: 0.35, bumpScale: 0.18, bumpFreq: 24.0, glint: 0.2,
    });
    const teethCount = 26;
    const teeth = new THREE.InstancedMesh(toothGeo, enamel, teethCount);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    this.toothPhase = [];
    for (let i = 0; i < teethCount; i++) {
      const top = i % 2 === 0;
      const idx = Math.floor(i / 2);
      const ang = (idx / 13) * Math.PI * 2;
      const u = 0.02 + (idx / 13) * 0.05;
      const frame = this._onWall(u, ang, 0.78);
      p.copy(frame.pt);
      const dir = top ? -1 : 1;
      q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, dir, 0));
      const h = 0.7 + Math.random() * 0.6;
      s.set(0.85 + Math.random() * 0.3, h, 0.85 + Math.random() * 0.3);
      m.compose(p, q, s);
      teeth.setMatrixAt(i, m);
      this.toothPhase.push({ base: p.clone(), dir, idx, w: s.x, d: s.z });
    }
    teeth.instanceMatrix.needsUpdate = true;
    teeth.frustumCulled = false;
    g.add(teeth);
    this.teeth = teeth;
    this.disposables.push(toothGeo, enamel);

    // Tongue: a flattened, papillae-bumped ellipsoid hugging the wall,
    // undulating slowly. Wet rosy material with strong bump detail.
    const tonGeo = new THREE.SphereGeometry(1, 40, 28);
    {
      const tp = tonGeo.attributes.position;
      const tn = tonGeo.attributes.normal;
      const tv = new THREE.Vector3(), tnv = new THREE.Vector3();
      for (let i = 0; i < tp.count; i++) {
        tv.fromBufferAttribute(tp, i);
        tnv.fromBufferAttribute(tn, i);
        // papillae: dense small noise bumps
        const b = fbm3(tv.x * 9.0, tv.y * 9.0, tv.z * 9.0) * 0.06
          + vnoise(tv.x * 26.0, tv.y * 26.0, tv.z * 26.0) * 0.02;
        tv.addScaledVector(tnv, b);
        tp.setXYZ(i, tv.x, tv.y, tv.z);
      }
      tonGeo.scale(0.55, 0.26, 1.1);
      tonGeo.computeVertexNormals();
    }
    const tonMat = new THREE.MeshStandardMaterial({
      color: 0xc9636b, roughness: 0.45, metalness: 0.0,
    });
    this._wetify(tonMat, {
      rim: 0xe8868c, rimStrength: 0.7, bumpScale: 0.85, bumpFreq: 18.0, glint: 0.85,
      extraVertex: `
        // slow muscular undulation along the tongue's length
        transformed.y += sin(uTime * 1.1 + transformed.z * 3.2) * 0.05 *
          smoothstep(0.0, 0.4, abs(transformed.z));
      `,
    });
    const tongue = new THREE.Mesh(tonGeo, tonMat);
    {
      const f = this._onWall(0.085, Math.PI * 0.5, 0.92);
      const basis = new THREE.Matrix4().makeBasis(
        f.nx,
        new THREE.Vector3().subVectors(this.curve.getPointAt(0.085, new THREE.Vector3()), f.pt).normalize(),
        f.tan
      );
      tongue.quaternion.setFromRotationMatrix(basis);
      tongue.position.copy(f.pt);
    }
    g.add(tongue);
    this.tongue = tongue;
    this.disposables.push(tonGeo, tonMat);

    // Saliva strands: thin sagging filaments spanning the cavity, catching light.
    const strandGeos = [];
    for (let i = 0; i < (this.lowPerf ? 4 : 9); i++) {
      // short filaments between NEARBY wall points (think strands bridging
      // teeth), sagging under their own weight — never chords across the lumen
      const u0 = 0.02 + Math.random() * 0.08;
      const a0 = Math.random() * Math.PI * 2;
      const f0 = this._onWall(u0, a0, 0.74);
      const f1 = this._onWall(u0 + 0.002 + Math.random() * 0.004, a0 + 0.3 + Math.random() * 0.4, 0.74);
      const mid = f0.pt.clone().lerp(f1.pt, 0.5);
      mid.y -= 0.05 + Math.random() * 0.09; // sag
      const c = new THREE.CatmullRomCurve3([f0.pt, mid, f1.pt]);
      strandGeos.push(new THREE.TubeGeometry(c, 8, 0.0035 + Math.random() * 0.003, 5, false));
    }
    const strandGeo = mergeGeometries(strandGeos);
    strandGeos.forEach((sg) => sg.dispose());
    const strandMat = new THREE.MeshStandardMaterial({
      color: 0xe8c8c4, roughness: 0.08, metalness: 0.0,
      transparent: true, opacity: 0.3, depthWrite: false,
    });
    const strands = new THREE.Mesh(strandGeo, strandMat);
    strands.frustumCulled = false;
    g.add(strands);
    this.disposables.push(strandGeo, strandMat);

    // Saliva droplets — stretched glinting beads that fall and glisten.
    const dropGeo = new THREE.SphereGeometry(0.013, 8, 8);
    const dropMat = new THREE.MeshStandardMaterial({
      color: 0xfff6f3, roughness: 0.12, metalness: 0.0,
      transparent: true, opacity: 0.45, depthWrite: false,
      emissive: 0xffeadf, emissiveIntensity: 0.03,
    });
    const n = this.budgets.saliva;
    const drops = new THREE.InstancedMesh(dropGeo, dropMat, n);
    this.salivaData = [];
    for (let i = 0; i < n; i++) {
      const u = 0.02 + Math.random() * 0.12;
      const ang = Math.random() * Math.PI * 2;
      const frame = this._onWall(u, ang, 0.2 + Math.random() * 0.55);
      this.salivaData.push({
        base: frame.pt.clone(),
        spd: 0.4 + Math.random() * 0.8,
        ph: Math.random() * 10,
        w: 0.55 + Math.random() * 0.5,
      });
      m.compose(frame.pt, new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
      drops.setMatrixAt(i, m);
    }
    drops.instanceMatrix.needsUpdate = true;
    drops.frustumCulled = false;
    g.add(drops);
    this.saliva = drops;
    this.disposables.push(dropGeo, dropMat);
  }

  // 3 · Stomach — rugae are carved into the tube wall itself; here we add the
  // churning acid pool, ember glow and wobbling bubbles.
  _buildStomach() {
    const g = this._group("stomach", 0.32, 0.52);

    // Acid pool: a turbulent emissive surface low in the chamber.
    const poolGeo = new THREE.RingGeometry(0.02, 1.7, 48, 18);
    poolGeo.rotateX(-Math.PI / 2);
    const poolMat = new THREE.MeshStandardMaterial({
      color: 0xd98a3d, roughness: 0.32, metalness: 0.0,
      transparent: true, opacity: 0.9, side: THREE.DoubleSide,
      emissive: 0x8a3a08, emissiveIntensity: 0.32,
    });
    this._wetify(poolMat, {
      rim: 0xffa244, rimStrength: 0.5, bumpScale: 0.9, bumpFreq: 8.0, glint: 0.25,
      extraVertex: `
        // turbulent churning surface
        float rr = length(transformed.xz);
        transformed.y += sin(rr * 14.0 - uTime * 2.6) * 0.025
          + sin(transformed.x * 8.0 + uTime * 1.6) * sin(transformed.z * 7.0 - uTime * 2.1) * 0.04;
      `,
    });
    const pool = new THREE.Mesh(poolGeo, poolMat);
    const pc = this.curve.getPointAt(0.42, new THREE.Vector3());
    pool.position.set(pc.x, pc.y - 0.62, pc.z);
    g.add(pool);
    this.acidPool = pool;
    this.disposables.push(poolGeo, poolMat);

    // Acid bubbles: glassy amber spheres that wobble as they rise off the pool.
    const bubGeo = new THREE.SphereGeometry(0.04, 10, 10);
    const bubMat = new THREE.MeshStandardMaterial({
      color: 0xffb35e, roughness: 0.05, metalness: 0.0,
      transparent: true, opacity: 0.34, depthWrite: false,
      emissive: 0xb4520f, emissiveIntensity: 0.22,
    });
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1);
    const n = this.budgets.bubbles;
    const bub = new THREE.InstancedMesh(bubGeo, bubMat, n);
    this.bubbleData = [];
    for (let i = 0; i < n; i++) {
      const u = 0.36 + Math.random() * 0.12;
      const ang = Math.random() * Math.PI * 2;
      const frame = this._onWall(u, ang, 0.2 + Math.random() * 0.6);
      const sc = 0.4 + Math.random() * 0.9;
      this.bubbleData.push({
        base: frame.pt.clone(), spd: 0.3 + Math.random() * 0.7,
        ph: Math.random() * 10, sc, wob: 0.04 + Math.random() * 0.08,
      });
      m.compose(frame.pt, q, s.set(sc, sc, sc));
      bub.setMatrixAt(i, m);
    }
    bub.instanceMatrix.needsUpdate = true;
    bub.frustumCulled = false;
    g.add(bub);
    this.bubbles = bub;
    this.disposables.push(bubGeo, bubMat);
  }

  // 4 · Small intestine — THE CATHEDRAL. Thousands of tapered, curved villi
  // with rose→gold per-instance tint, fresnel tip glow and microvilli sparkle;
  // nutrient motes accelerate into the wall and flare on absorption; a green
  // bile wash floods the duodenum.
  _buildSmallIntestine() {
    const g = this._group("small", 0.48, 0.76);

    // A villus: capsule re-sculpted into a tapered finger with a soft club tip.
    const villGeo = new THREE.CapsuleGeometry(0.02, 0.18, 4, 8);
    villGeo.translate(0, 0.11, 0); // root at origin, tip ~0.3
    {
      const vp = villGeo.attributes.position;
      for (let i = 0; i < vp.count; i++) {
        const y = vp.getY(i);
        const h = THREE.MathUtils.clamp(y / 0.3, 0, 1);
        const taper = 1.0
          - 0.42 * Math.pow(h, 1.3)                                    // narrow toward tip
          + 0.34 * Math.exp(-Math.pow((h - 0.9) / 0.12, 2));           // soft clubbed end
        vp.setXYZ(i, vp.getX(i) * taper, y, vp.getZ(i) * taper);
      }
      villGeo.computeVertexNormals();
    }

    const villMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, // per-instance colour carries the hue
      roughness: 0.5, metalness: 0.0,
      emissive: 0xffe9b0, emissiveIntensity: 0.06,
    });

    // sway + per-instance static curl in the vertex shader; rose→gold gradient,
    // fresnel tip glow and microvilli glitter in the fragment shader.
    this.villiUniforms = { uTime: this.globalUniforms.uTime };
    villMat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.villiUniforms.uTime;
      shader.vertexShader =
        "uniform float uTime;\nvarying float vVy;\nvarying vec3 vWPosV;\n" +
        shader.vertexShader
          .replace(
            "#include <begin_vertex>",
            `#include <begin_vertex>
             vVy = clamp(position.y / 0.3, 0.0, 1.0);
             // phase from instance matrix translation (column 3)
             float ph = instanceMatrix[3].x * 7.3 + instanceMatrix[3].z * 5.1 + instanceMatrix[3].y * 3.7;
             // static per-instance curl: villi lean, they don't stand at attention
             float curlA = fract(ph * 0.173) * 6.2831;
             float curl = (0.04 + fract(ph * 0.531) * 0.07) * vVy * vVy;
             transformed.x += cos(curlA) * curl;
             transformed.z += sin(curlA) * curl;
             // living sway, stronger toward the tip
             float sway = sin(uTime * 1.6 + ph) * 0.05 + sin(uTime * 0.9 + ph * 1.7) * 0.025;
             float bend = vVy * vVy;
             transformed.x += sway * bend;
             transformed.z += cos(uTime * 1.3 + ph) * 0.035 * bend;`
          )
          .replace(
            "#include <project_vertex>",
            `vec4 swWP = vec4(transformed, 1.0);
             #ifdef USE_INSTANCING
               swWP = instanceMatrix * swWP;
             #endif
             vWPosV = (modelMatrix * swWP).xyz;
             #include <project_vertex>`
          );
      shader.fragmentShader =
        "uniform float uTime;\nvarying float vVy;\nvarying vec3 vWPosV;\n" + NOISE_GLSL +
        shader.fragmentShader
          .replace(
            "#include <color_fragment>",
            `#include <color_fragment>
             // rose at the root warming to gold at the tip
             diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.82, 0.5), smoothstep(0.3, 1.0, vVy) * 0.6);
             // subsurface root warmth: deeper crimson where villi crowd together
             diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.55, 0.16, 0.18), (1.0 - smoothstep(0.0, 0.45, vVy)) * 0.5);`
          )
          .replace(
            "#include <emissivemap_fragment>",
            `#include <emissivemap_fragment>
             vec3 swV = normalize(vViewPosition);
             float swFres = pow(1.0 - abs(dot(swV, normal)), 2.0);
             // translucent glowing tips — light pouring through the velvet
             totalEmissiveRadiance += vec3(1.0, 0.85, 0.52) * swFres * (0.05 + 0.22 * smoothstep(0.55, 1.0, vVy));
             // microvilli fuzz: fine twinkling sparkle near the tips
             float swTw = swNoise(vWPosV * 60.0 + vec3(0.0, uTime * 0.6, 0.0));
             totalEmissiveRadiance += vec3(1.0, 0.9, 0.65) * smoothstep(0.78, 0.92, swTw) * 0.15 * smoothstep(0.4, 1.0, vVy);`
          );
    };

    const n = this.budgets.villi;
    const villi = new THREE.InstancedMesh(villGeo, villMat, n);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    const upV = new THREE.Vector3(0, 1, 0);
    const col = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const u = 0.5 + Math.random() * 0.24;
      const ang = Math.random() * Math.PI * 2;
      const frame = this._onWall(u, ang, 1.0);
      // orient villus pointing inward (from wall toward centerline)
      const inward = new THREE.Vector3()
        .subVectors(this.curve.getPointAt(u, new THREE.Vector3()), frame.pt)
        .normalize();
      q.setFromUnitVectors(upV, inward);
      const h = 0.6 + Math.random() * 0.75;
      s.set(0.8 + Math.random() * 0.5, h, 0.8 + Math.random() * 0.5);
      m.compose(frame.pt, q, s);
      villi.setMatrixAt(i, m);
      // per-instance hue: rose → dusty gold, with the occasional flushed crimson
      const t = Math.random();
      col.setHSL(0.015 + t * 0.07, 0.58 - t * 0.08, 0.38 + Math.random() * 0.13);
      villi.setColorAt(i, col);
    }
    villi.instanceMatrix.needsUpdate = true;
    if (villi.instanceColor) villi.instanceColor.needsUpdate = true;
    villi.frustumCulled = false;
    g.add(villi);
    this.villi = villi;
    this.disposables.push(villGeo, villMat);

    // Glowing nutrient motes: drift off the centreline (you, dissolving) and
    // ACCELERATE into the villi tips, flaring as they're absorbed.
    const moteGeo = new THREE.SphereGeometry(0.022, 6, 6);
    const moteMat = new THREE.MeshBasicMaterial({
      color: 0xffe9b0, transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const mn = this.budgets.motes;
    const motes = new THREE.InstancedMesh(moteGeo, moteMat, mn);
    this.moteData = [];
    for (let i = 0; i < mn; i++) {
      const u = 0.5 + Math.random() * 0.24;
      const ang = Math.random() * Math.PI * 2;
      const target = this._onWall(u, ang, 0.92);
      // start near centerline, race outward into the wall
      const start = this.curve.getPointAt(u, new THREE.Vector3());
      start.x += (Math.random() - 0.5) * 0.3;
      start.z += (Math.random() - 0.5) * 0.3;
      this.moteData.push({
        u, start: start.clone(), target: target.pt.clone(),
        t: Math.random(), spd: 0.15 + Math.random() * 0.35,
      });
      m.compose(start, new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
      motes.setMatrixAt(i, m);
    }
    motes.instanceMatrix.needsUpdate = true;
    motes.frustumCulled = false;
    g.add(motes);
    this.motes = motes;
    this.disposables.push(moteGeo, moteMat);

    // Bile flood: layered translucent green cones washing down the duodenum —
    // a volumetric-ish wash rather than a literal liquid.
    const bileMat = new THREE.MeshBasicMaterial({
      color: 0x69a93c, transparent: true, opacity: 0.14,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      fog: true,
    });
    const bileGroup = new THREE.Group();
    const coneGeo = new THREE.ConeGeometry(0.55, 1.7, 20, 1, true);
    for (let i = 0; i < 3; i++) {
      const uPos = 0.505 + i * 0.012;
      const pt = this.curve.getPointAt(uPos, new THREE.Vector3());
      const tan = this.curve.getTangentAt(uPos, new THREE.Vector3()).normalize();
      const cone = new THREE.Mesh(coneGeo, bileMat);
      cone.position.copy(pt);
      cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), tan);
      cone.scale.setScalar(0.8 + i * 0.35);
      bileGroup.add(cone);
    }
    g.add(bileGroup);
    this.bileGroup = bileGroup;
    this.bileMat = bileMat;
    this.disposables.push(coneGeo, bileMat);
  }

  // 5 · Large intestine — microbiome swarm aglow in the haustral caverns.
  _buildLargeIntestine() {
    const g = this._group("large", 0.72, 0.92);

    // Microbes: tiny glowing instanced icosahedra swarming, varied green hues.
    const microGeo = new THREE.IcosahedronGeometry(0.014, 0);
    const microMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, emissive: 0x9fd07a, emissiveIntensity: 0.9,
      roughness: 0.5, metalness: 0.0,
    });
    const n = this.budgets.bacteria;
    const micro = new THREE.InstancedMesh(microGeo, microMat, n);
    this.microData = [];
    const m = new THREE.Matrix4();
    const sv = new THREE.Vector3();
    const col = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const u = 0.74 + Math.random() * 0.16;
      const ang = Math.random() * Math.PI * 2;
      // hug the haustral walls — never drift into the camera's face
      const frame = this._onWall(u, ang, 0.5 + Math.random() * 0.42);
      const sc = 0.4 + Math.random() * 1.0;
      this.microData.push({
        base: frame.pt.clone(),
        amp: 0.04 + Math.random() * 0.09,
        spd: 0.5 + Math.random() * 1.5,
        ph: Math.random() * 10,
        sc,
      });
      m.compose(frame.pt, new THREE.Quaternion(), sv.set(sc, sc, sc));
      micro.setMatrixAt(i, m);
      col.setHSL(0.24 + Math.random() * 0.1, 0.45 + Math.random() * 0.3, 0.3 + Math.random() * 0.18);
      micro.setColorAt(i, col);
    }
    micro.instanceMatrix.needsUpdate = true;
    if (micro.instanceColor) micro.instanceColor.needsUpdate = true;
    micro.frustumCulled = false;
    g.add(micro);
    this.microbes = micro;
    this.disposables.push(microGeo, microMat);
  }

  // 6 · Exit — a final dark chamber and a literal light at the end of the tunnel.
  _buildExit() {
    const g = this._group("exit", 0.88, 1.0);
    // A bright disc placed at the very end of the curve = the light. With
    // bloom on, this blows out into a proper halo as you approach.
    const discGeo = new THREE.CircleGeometry(1.4, 32);
    const discMat = new THREE.MeshBasicMaterial({
      color: 0xfbfaf6, transparent: true, opacity: 0.0, side: THREE.DoubleSide,
      fog: false,
    });
    const disc = new THREE.Mesh(discGeo, discMat);
    const end = this.curve.getPointAt(1.0, new THREE.Vector3());
    const tan = this.curve.getTangentAt(1.0, new THREE.Vector3()).normalize();
    disc.position.copy(end).addScaledVector(tan, 1.6);
    disc.lookAt(this.camera.position);
    g.add(disc);
    this.exitDisc = disc;
    this.exitMat = discMat;
    this.disposables.push(discGeo, discMat);

    // a soft halo sprite behind the disc for the long approach
    const haloMat = new THREE.SpriteMaterial({
      map: this._spriteTexture(), color: 0xfff8ea, transparent: true,
      opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const halo = new THREE.Sprite(haloMat);
    halo.position.copy(disc.position);
    halo.scale.setScalar(2.4);
    g.add(halo);
    this.exitHalo = haloMat;
    this.disposables.push(haloMat);
  }

  // ============================ POST ============================
  // Bloom sells the bioluminescence. Desktop only — low-perf devices render
  // straight to the canvas with no composer at all.
  _initComposer() {
    if (this.lowPerf) return;
    const w = window.innerWidth, h = window.innerHeight;
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    // tuned as a glow, not a smear: highish threshold, modest radius
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 0.32, 0.3, 0.85);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());
  }

  // ============================ RUNTIME ============================

  setProgress(p) {
    this.progress = THREE.MathUtils.clamp(p, 0, 1);
    if (this.tubeUniforms) this.tubeUniforms.uProgress.value = this.progress;
  }

  setLook(yaw, pitch) {
    // clamped nudge — they gawk, they don't steer
    this.lookYaw = THREE.MathUtils.clamp(yaw, -0.55, 0.55);
    this.lookPitch = THREE.MathUtils.clamp(pitch, -0.4, 0.4);
  }

  // Crossfade fog + lights toward a stage palette (called by main on stage change).
  applyPalette(colors, fogDensity, dur = 1.4) {
    const fog = this.scene.fog;
    gsap.to(fog.color, {
      r: new THREE.Color(colors.fog).r,
      g: new THREE.Color(colors.fog).g,
      b: new THREE.Color(colors.fog).b,
      duration: dur, ease: "sine.inOut",
    });
    gsap.to(fog, { density: fogDensity, duration: dur, ease: "sine.inOut" });
    const c = new THREE.Color(colors.fog);
    gsap.to({ t: 0 }, {
      t: 1, duration: dur, ease: "sine.inOut",
      onUpdate: () => this.renderer.setClearColor(c, 1),
    });
    gsap.to(this.ambient.color, {
      r: new THREE.Color(colors.key).r, g: new THREE.Color(colors.key).g, b: new THREE.Color(colors.key).b,
      duration: dur, ease: "sine.inOut",
    });
    gsap.to(this.headlamp.color, {
      r: new THREE.Color(colors.accent).r, g: new THREE.Color(colors.accent).g, b: new THREE.Color(colors.accent).b,
      duration: dur, ease: "sine.inOut",
    });
    gsap.to(this.fill.color, {
      r: new THREE.Color(colors.key).r, g: new THREE.Color(colors.key).g, b: new THREE.Color(colors.key).b,
      duration: dur, ease: "sine.inOut",
    });
    gsap.to(this.tubeMat.color, {
      r: new THREE.Color(colors.fill).r, g: new THREE.Color(colors.fill).g, b: new THREE.Color(colors.fill).b,
      duration: dur, ease: "sine.inOut",
    });
    // rim translucency tint follows the stage key (the "light inside the flesh")
    if (this.tubeWet) {
      gsap.to(this.tubeWet.uRimC.value, {
        r: new THREE.Color(colors.key).r, g: new THREE.Color(colors.key).g, b: new THREE.Color(colors.key).b,
        duration: dur, ease: "sine.inOut",
      });
    }
  }

  // Show only the organ group(s) near current progress.
  _cullGroups() {
    for (const id in this.stageGroups) {
      const g = this.stageGroups[id];
      const { uStart, uEnd } = g.userData;
      const pad = 0.06;
      g.visible = this.progress >= uStart - pad && this.progress <= uEnd + pad;
    }
  }

  // Sample camera position/orientation from the single curve.
  _updateCamera() {
    const p = this.progress;
    const pt = this.curve.getPointAt(p, this._tmpV);
    this.camera.position.copy(pt);

    // lookAt a point slightly ahead on the curve
    const ahead = Math.min(p + 0.012, 1);
    const la = this.curve.getPointAt(ahead, this._tmpV2);
    this._lookTarget.copy(la);
    this.camera.lookAt(this._lookTarget);

    // apply clamped user look nudge on top
    this.camera.rotateY(this.lookYaw);
    this.camera.rotateX(this.lookPitch);

    // headlamp rides with camera; coloured fill floats ahead so the next
    // stretch of flesh is rimmed in stage colour before fog swallows it.
    // Near the exit the palette turns the walls bone-white, so the headlamp
    // dims and lets the literal light at the end of the tunnel take over.
    this.headlamp.position.copy(this.camera.position);
    // gentler in the mouth (enamel at point-blank range), dimmed near the exit
    this.headlamp.intensity = 7.0
      * (0.5 + 0.5 * THREE.MathUtils.smoothstep(p, 0.05, 0.16))
      * (1 - 0.7 * THREE.MathUtils.smoothstep(p, 0.88, 0.97));
    const fillAt = Math.min(p + 0.03, 1);
    this.fill.position.copy(this.curve.getPointAt(fillAt, this._tmpV2));
  }

  // Embedded accent lights fade in/out by camera proximity (NOT visibility —
  // light count must stay constant or three.js recompiles every shader).
  _updateAccents(t) {
    for (let i = 0; i < this.accents.length; i++) {
      const a = this.accents[i];
      const prox = Math.max(0, 1 - Math.abs(this.progress - a.u) / (a.width + 0.06));
      let k = prox * prox;
      if (a.flicker) {
        k *= 1 - a.flicker * 0.5 + a.flicker * (0.5 * Math.sin(t * 9.0 + i * 2.7) * Math.sin(t * 3.7 + i));
      }
      a.light.intensity = a.base * k;
    }
    // the exit light ramps with approach instead of a symmetric window
    const near = THREE.MathUtils.smoothstep(this.progress, 0.88, 1.0);
    this.exitLight.intensity = 10 * near;
  }

  render() {
    const t = this.clock.getElapsedTime();
    this.globalUniforms.uTime.value = t;

    this._cullGroups();
    this._updateCamera();
    this._updateAccents(t);
    this._animateInstances(t);

    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  _animateInstances(t) {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const sc = new THREE.Vector3(1, 1, 1);
    const pos = new THREE.Vector3();

    // saliva: stretched droplets bob & fall, elongating as they speed up
    if (this.saliva && this.stageGroups.mouth.visible) {
      const d = this.salivaData;
      for (let i = 0; i < d.length; i++) {
        const o = d[i];
        const cyc = ((t * o.spd + o.ph) % 2) - 1;
        pos.copy(o.base);
        pos.y -= cyc * 0.4;
        const stretch = 1.1 + Math.abs(cyc) * 1.3; // faster fall = longer drip
        sc.set(o.w, stretch, o.w);
        m.compose(pos, q, sc);
        this.saliva.setMatrixAt(i, m);
      }
      sc.set(1, 1, 1);
      this.saliva.instanceMatrix.needsUpdate = true;
    }

    // teeth crush
    if (this.teeth && this.stageGroups.mouth.visible) {
      const crush = Math.max(0, Math.sin(t * 1.6)) * 0.18;
      for (let i = 0; i < this.toothPhase.length; i++) {
        const tp = this.toothPhase[i];
        pos.copy(tp.base);
        pos.y += tp.dir * crush * -1; // move toward centerline on crush
        q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, tp.dir, 0));
        m.compose(pos, q, sc.set(tp.w, 0.7 + (tp.idx % 3) * 0.2, tp.d));
        this.teeth.setMatrixAt(i, m);
      }
      sc.set(1, 1, 1);
      this.teeth.instanceMatrix.needsUpdate = true;
    }

    // stomach bubbles rise with a side-to-side wobble
    if (this.bubbles && this.stageGroups.stomach.visible) {
      const d = this.bubbleData;
      for (let i = 0; i < d.length; i++) {
        const o = d[i];
        const rise = ((t * o.spd + o.ph) % 2);
        pos.copy(o.base);
        pos.y += rise * 0.5;
        pos.x += Math.sin(t * 2.4 + o.ph * 3.1) * o.wob * rise;
        pos.z += Math.cos(t * 2.1 + o.ph * 2.3) * o.wob * rise;
        const squish = 1 + Math.sin(t * 6.0 + o.ph) * 0.12; // breathing wobble
        sc.set(o.sc * squish, o.sc / squish, o.sc * squish);
        m.compose(pos, q, sc);
        this.bubbles.setMatrixAt(i, m);
      }
      sc.set(1, 1, 1);
      this.bubbles.instanceMatrix.needsUpdate = true;
    }

    // nutrient motes: accelerate from the centreline into villi tips, flaring
    // as they're absorbed (eased t² = visible acceleration)
    if (this.motes && this.stageGroups.small.visible) {
      const d = this.moteData;
      for (let i = 0; i < d.length; i++) {
        const o = d[i];
        o.t += o.spd * 0.016;
        if (o.t > 1) o.t = 0;
        const e = o.t * o.t * (0.4 + 0.6 * o.t); // ease-in: slow drift → rush
        pos.lerpVectors(o.start, o.target, e);
        let f = 0.5 + 0.5 * Math.sin(o.t * Math.PI);
        // absorption flare just before the wall
        f *= 1 + 1.8 * Math.exp(-Math.pow((o.t - 0.94) / 0.045, 2));
        sc.set(f, f, f);
        m.compose(pos, q, sc);
        this.motes.setMatrixAt(i, m);
      }
      sc.set(1, 1, 1);
      this.motes.instanceMatrix.needsUpdate = true;
    }

    // bile wash pulse (only meaningful around the duodenum window)
    if (this.bileMat && this.stageGroups.small.visible) {
      const prox = Math.max(0, 1 - Math.abs(this.progress - 0.52) / 0.09);
      this.bileMat.opacity = prox * (0.1 + 0.06 * Math.sin(t * 2.6));
      this.bileGroup.rotation.y = t * 0.15;
    }

    // microbes swarm
    if (this.microbes && this.stageGroups.large.visible) {
      const d = this.microData;
      for (let i = 0; i < d.length; i++) {
        const o = d[i];
        pos.copy(o.base);
        pos.x += Math.sin(t * o.spd + o.ph) * o.amp;
        pos.y += Math.cos(t * o.spd * 0.8 + o.ph) * o.amp;
        pos.z += Math.sin(t * o.spd * 1.2 + o.ph * 1.4) * o.amp;
        m.compose(pos, q, sc.set(o.sc, o.sc, o.sc));
        this.microbes.setMatrixAt(i, m);
      }
      sc.set(1, 1, 1);
      this.microbes.instanceMatrix.needsUpdate = true;
      // gentle communal pulse
      this.microbes.material.emissiveIntensity = 0.35 + 0.15 * Math.sin(t * 1.8);
    }

    // exit light brightens as we approach the end
    if (this.exitMat) {
      const near = THREE.MathUtils.smoothstep(this.progress, 0.9, 1.0);
      this.exitMat.opacity = near;
      if (this.exitHalo) this.exitHalo.opacity = THREE.MathUtils.smoothstep(this.progress, 0.84, 0.99) * 0.4;
      if (this.exitDisc) this.exitDisc.lookAt(this.camera.position);
    }
  }

  _bindResize() {
    this._onResize = () => {
      const w = window.innerWidth, h = window.innerHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
      if (this.composer) this.composer.setSize(w, h);
    };
    window.addEventListener("resize", this._onResize);
  }

  dispose() {
    window.removeEventListener("resize", this._onResize);
    this.disposables.forEach((d) => d.dispose && d.dispose());
    if (this.composer) this.composer.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
