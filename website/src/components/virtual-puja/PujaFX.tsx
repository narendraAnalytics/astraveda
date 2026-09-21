"use client";

// GPU effects for the virtual puja: noise-shader diya flames (lamps + the aarti
// thali), rising ember sparks and incense smoke. Rendered on a transparent
// orthographic canvas laid over the DOM shrine; world units == CSS pixels with
// the origin at the stage centre (+y up).
//
// State that changes every frame (thali position, boost pulses, smoke level)
// travels through a shared mutable ref — never React state — so the scene runs
// without re-rendering.

import { useMemo, type MutableRefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { INCENSE, LAMPS, sceneUnit } from "@/lib/virtual-puja";

export type FxShared = {
  /** Aarti flame base, in world px relative to stage centre (+y up). */
  thali: { wx: number; wy: number };
  thaliTarget: number;
  thaliOn: number;
  /** 0..1 pulse that decays — set to 1 on bell/shankh for a flare. */
  boost: number;
  smokeTarget: number;
  smokeOn: number;
};

export const makeFxShared = (): FxShared => ({
  thali: { wx: 0, wy: 0 },
  thaliTarget: 0,
  thaliOn: 0,
  boost: 0,
  smokeTarget: 0,
  smokeOn: 0,
});

const FLAME_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FLAME_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform float uSeed;
  uniform float uI;

  float h21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float vn(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x),
               mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float a = 0.5;
    float s = 0.0;
    for (int i = 0; i < 4; i++) {
      s += a * vn(p);
      p *= 2.03;
      a *= 0.5;
    }
    return s;
  }

  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    float fh = (p.y + 0.45) / 1.05;          // 0 at the wick, 1 at the tip
    float t = uTime;
    float gust = sin(t * 7.0 + uSeed * 6.0) * 0.5 + sin(t * 11.3 + uSeed * 3.0) * 0.5;
    float n = fbm(vec2(p.x * 2.2 + uSeed, fh * 2.6 - t * 1.9));
    float sway = (n - 0.5) * 0.55 * fh + gust * 0.05 * fh * fh;
    float hf = clamp(fh, 0.0, 1.0);
    float halfW = 0.36 * (1.0 - pow(hf, 1.4)) * (0.55 + 0.45 * smoothstep(0.0, 0.25, hf));
    float dx = abs(p.x - sway) / max(halfW, 0.001);
    float tip = 1.0 - smoothstep(0.82, 1.0, fh + (n - 0.5) * 0.25);
    float inside = (1.0 - smoothstep(0.55, 1.0, dx)) * tip * smoothstep(-0.02, 0.06, fh);
    float core = (1.0 - smoothstep(0.0, 0.75, dx)) * (1.0 - smoothstep(0.0, 0.55, hf));

    vec3 outer = vec3(1.0, 0.30, 0.04);
    vec3 mid = vec3(1.0, 0.66, 0.14);
    vec3 hot = vec3(1.0, 0.93, 0.62);
    vec3 col = mix(outer, mid, smoothstep(0.0, 0.8, 1.0 - dx * 0.9) * (1.0 - hf * 0.5));
    col = mix(col, hot, core * 0.85);
    col = mix(col, vec3(0.25, 0.4, 1.0), (1.0 - smoothstep(0.0, 0.12, hf)) * 0.35);

    float gd = length(vec2(p.x * 0.9, (p.y + 0.1) * 0.8));
    float glow = exp(-gd * gd * 3.2);
    vec3 rgb = col * inside * 1.25 + vec3(1.0, 0.55, 0.18) * glow * 0.3;
    rgb *= uI;
    float a = clamp(max(rgb.r, max(rgb.g, rgb.b)), 0.0, 1.0);
    gl_FragColor = vec4(rgb, a);
  }
`;

const EMBER_VERT = /* glsl */ `
  attribute vec4 aRand;
  uniform float uTime;
  uniform float uBoost;
  uniform float uH;
  uniform float uPx;
  uniform vec3 uSrc[8];
  varying float vA;
  void main() {
    int idx = int(floor(aRand.x * 8.0));
    vec3 s = uSrc[idx];
    float t = fract(uTime * aRand.y * 0.12 + aRand.z);
    float rise = t * uH * (0.25 + aRand.w * 0.35);
    float sway = sin(t * 9.0 + aRand.z * 40.0) * (14.0 + aRand.w * 24.0) * t;
    vec2 pos = s.xy + vec2(sway + (aRand.z - 0.5) * 10.0, rise);
    float tw = 0.55 + 0.45 * sin(uTime * 9.0 + aRand.z * 90.0);
    vA = (1.0 - t) * (1.0 - t) * s.z * tw * (0.6 + uBoost);
    gl_PointSize = (2.2 + aRand.w * 4.0) * (1.0 - t * 0.6) * uPx;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 0.0, 1.0);
  }
`;

const EMBER_FRAG = /* glsl */ `
  precision highp float;
  varying float vA;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    vec3 col = mix(vec3(1.0, 0.5, 0.12), vec3(1.0, 0.85, 0.5), a * a);
    float k = a * vA;
    gl_FragColor = vec4(col * k, k);
  }
`;

const SMOKE_VERT = /* glsl */ `
  attribute vec4 aRand;
  uniform float uTime;
  uniform float uH;
  uniform float uPx;
  uniform float uOn;
  uniform vec2 uSrc;
  varying float vA;
  void main() {
    float t = fract(uTime * 0.07 * (0.6 + aRand.y) + aRand.z);
    float sway = sin(t * 4.0 + aRand.z * 30.0) * (10.0 + 70.0 * t) + t * t * 40.0;
    vec2 pos = uSrc + vec2(sway, t * uH * 0.55);
    vA = sin(t * 3.14159) * 0.16 * uOn;
    gl_PointSize = (26.0 + t * 120.0) * (0.6 + aRand.w * 0.8) * uPx;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 0.0, 1.0);
  }
`;

const SMOKE_FRAG = /* glsl */ `
  precision highp float;
  varying float vA;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = exp(-d * d * 14.0);
    float k = a * vA;
    gl_FragColor = vec4(vec3(0.9, 0.84, 0.76) * k, k);
  }
`;

const ADD = {
  transparent: true,
  depthTest: false,
  depthWrite: false,
  blending: THREE.CustomBlending,
  blendEquation: THREE.AddEquation,
  blendSrc: THREE.OneFactor,
  blendDst: THREE.OneFactor,
} as const;

// Deterministic pseudo-random so particle layouts are stable between renders.
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function randAttr(count: number, seed: number) {
  const r = lcg(seed);
  const arr = new Float32Array(count * 4);
  for (let i = 0; i < arr.length; i++) arr[i] = r();
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geo.setAttribute("aRand", new THREE.BufferAttribute(arr, 4));
  return geo;
}

const FLAME_COUNT = LAMPS.length + 3;

function Scene({ shared }: { shared: MutableRefObject<FxShared> }) {
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);

  const flames = useMemo(
    () =>
      Array.from({ length: FLAME_COUNT }, (_, i) => {
        const mat = new THREE.ShaderMaterial({
          vertexShader: FLAME_VERT,
          fragmentShader: FLAME_FRAG,
          uniforms: {
            uTime: { value: 0 },
            uSeed: { value: i * 1.7 + 0.3 },
            uI: { value: 1 },
          },
          ...ADD,
        });
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
        mesh.frustumCulled = false;
        mesh.renderOrder = 2;
        return mesh;
      }),
    [],
  );

  const embers = useMemo(() => {
    const geo = randAttr(260, 7);
    const mat = new THREE.ShaderMaterial({
      vertexShader: EMBER_VERT,
      fragmentShader: EMBER_FRAG,
      uniforms: {
        uTime: { value: 0 },
        uBoost: { value: 0 },
        uH: { value: 800 },
        uPx: { value: 1 },
        uSrc: { value: Array.from({ length: 8 }, () => new THREE.Vector3()) },
      },
      ...ADD,
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    pts.renderOrder = 3;
    return pts;
  }, []);

  const smoke = useMemo(() => {
    const geo = randAttr(36, 21);
    const mat = new THREE.ShaderMaterial({
      vertexShader: SMOKE_VERT,
      fragmentShader: SMOKE_FRAG,
      uniforms: {
        uTime: { value: 0 },
        uH: { value: 800 },
        uPx: { value: 1 },
        uOn: { value: 0 },
        uSrc: { value: new THREE.Vector2() },
      },
      ...ADD,
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    pts.renderOrder = 1;
    return pts;
  }, []);

  useFrame((state, dt) => {
    const S = shared.current;
    const t = state.clock.elapsedTime;
    const w = size.width;
    const h = size.height;
    const u = sceneUnit(w, h);
    const k = Math.min(1, dt * 3);
    S.boost = Math.max(0, S.boost - dt * 0.55);
    S.thaliOn += (S.thaliTarget - S.thaliOn) * k;
    S.smokeOn += (S.smokeTarget - S.smokeOn) * Math.min(1, dt * 1.2);

    const srcs = (embers.material as THREE.ShaderMaterial).uniforms.uSrc.value as THREE.Vector3[];
    for (let i = 0; i < FLAME_COUNT; i++) {
      const mesh = flames[i];
      const mat = mesh.material as THREE.ShaderMaterial;
      let x: number;
      let baseY: number;
      let intensity: number;
      let fh: number;
      if (i < LAMPS.length) {
        const lamp = LAMPS[i];
        x = lamp.k * u;
        baseY = (0.5 - lamp.y) * h;
        intensity = 1;
        fh = h * 0.062 * lamp.s;
      } else {
        const j = i - LAMPS.length - 1; // -1, 0, 1
        x = S.thali.wx + j * 26;
        baseY = S.thali.wy + (j === 0 ? 6 : 0);
        intensity = S.thaliOn;
        fh = h * 0.048;
      }
      const flick = 0.92 + 0.08 * Math.sin(t * 13 + i * 2.1);
      const q = fh * 2.3;
      mesh.visible = intensity > 0.02;
      mesh.scale.set(q, q, 1);
      mesh.position.set(x, baseY + q * 0.5 * 0.45, 0);
      mat.uniforms.uTime.value = t;
      mat.uniforms.uI.value = intensity * flick * (1 + S.boost * 0.7);
      srcs[i].set(x, baseY + fh * 0.5, intensity > 0.05 ? intensity : 0);
    }
    const em = (embers.material as THREE.ShaderMaterial).uniforms;
    em.uTime.value = t;
    em.uBoost.value = S.boost;
    em.uH.value = h;
    em.uPx.value = dpr;

    const sm = (smoke.material as THREE.ShaderMaterial).uniforms;
    sm.uTime.value = t;
    sm.uH.value = h;
    sm.uPx.value = dpr;
    sm.uOn.value = S.smokeOn;
    (sm.uSrc.value as THREE.Vector2).set(INCENSE.k * u, (0.5 - INCENSE.y) * h);
    smoke.visible = S.smokeOn > 0.01;
  });

  return (
    <>
      <primitive object={smoke} />
      {flames.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
      <primitive object={embers} />
    </>
  );
}

export default function PujaFX({
  shared,
  reduced,
}: {
  shared: MutableRefObject<FxShared>;
  reduced: boolean;
}) {
  return (
    <Canvas
      orthographic
      camera={{ zoom: 1, position: [0, 0, 10], near: 0.1, far: 100 }}
      dpr={[1, 1.75]}
      gl={{ alpha: true, antialias: false, powerPreference: "low-power" }}
      frameloop={reduced ? "demand" : "always"}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    >
      <Scene shared={shared} />
    </Canvas>
  );
}
