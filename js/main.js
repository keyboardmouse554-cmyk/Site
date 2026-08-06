/* ============================================================
   thecrypto.support — WebGL scene + page interactions
   Scene: iridescent gem core, orbiting textured coins, and a
   particle field that gathers into a shield at the safety
   pledge. PMREM environment, ACES tone mapping, bloom.
   All motion runs through eased targets — nothing snaps.
   ============================================================ */

import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { MeshSurfaceSampler } from "three/addons/math/MeshSurfaceSampler.js";

// signals "module booted" so the CSS dead-man switch stands down
document.documentElement.classList.add("booted");

// low-power heuristic: few cores or a phone → lighter scene from the start
const LOW_POWER =
  (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) ||
  /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
const MAX_DPR = LOW_POWER ? 1.25 : 1.5;

const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const reduceMotion = () => motionQuery.matches;
const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");

/* ------------------------------------------------------------
   3D background
   ------------------------------------------------------------ */
function init3D() {
  const canvas = document.getElementById("bg3d");
  const testGL = document.createElement("canvas");
  if (!(testGL.getContext("webgl2") || testGL.getContext("webgl"))) {
    canvas.style.display = "none";
    return Promise.resolve();
  }

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_DPR));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x05070f, 0.05);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(
    55, window.innerWidth / window.innerHeight, 0.1, 100
  );
  camera.position.set(0, 0, 12.5);

  /* ---- lights (env map carries the metals; these add color) ---- */
  scene.add(new THREE.AmbientLight(0x333344, 0.8));
  const keyLight = new THREE.PointLight(0x29e0ff, 28, 40);
  keyLight.position.set(6, 4, 6);
  scene.add(keyLight);
  const rimLight = new THREE.PointLight(0x8b5cf6, 30, 40);
  rimLight.position.set(-6, -3, 4);
  scene.add(rimLight);
  const keyA = new THREE.Color(0x29e0ff);
  const keyB = new THREE.Color(0x8b5cf6);

  const world = new THREE.Group();
  scene.add(world);

  /* ---- gem core: faceted, transmissive, iridescent ---- */
  const core = new THREE.Group();
  const gem = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.55, 1),
    new THREE.MeshPhysicalMaterial({
      color: 0x1a2c58,
      metalness: 0.15,
      roughness: 0.22,
      clearcoat: 0.5,
      clearcoatRoughness: 0.35,
      iridescence: 1.0,
      iridescenceIOR: 1.3,
      iridescenceThicknessRange: [100, 400],
      transparent: true,
      opacity: 0.96,
      emissive: 0x0c2148,
      emissiveIntensity: 0.6,
      envMapIntensity: 1.15,
      flatShading: true,
    })
  );
  core.add(gem);

  const wire = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.585, 1),
    new THREE.MeshBasicMaterial({
      color: 0x29e0ff, wireframe: true, transparent: true,
      opacity: window.innerWidth <= 900 ? 0.16 : 0.3,
    })
  );
  core.add(wire);
  world.add(core);

  /* ---- coin face texture: symbol embossed on a brushed disc ---- */
  function coinTexture(symbol, hex, faceA, faceB) {
    const c = document.createElement("canvas");
    c.width = c.height = 512;
    const ctx = c.getContext("2d");
    const g = ctx.createRadialGradient(256, 256, 40, 256, 256, 256);
    g.addColorStop(0, faceA);
    g.addColorStop(1, faceB);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = hex;
    ctx.globalAlpha = 0.95;
    ctx.lineWidth = 20;
    ctx.beginPath();
    ctx.arc(256, 256, 216, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = hex;
    ctx.font = "600 260px 'JetBrains Mono', 'Segoe UI Symbol', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(symbol, 256, 276);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }

  const coinDefs = [
    { symbol: "₿", color: "#ffd97a", tint: 0xf7b32b, faceA: "#8a6420", faceB: "#3a2a08" },
    { symbol: "Ξ", color: "#dfe8ff", tint: 0xc0c8d8, faceA: "#5a6480", faceB: "#23283b" },
    { symbol: "◎", color: "#9df2dd", tint: 0x63e6c8, faceA: "#1d5f52", faceB: "#0a2822" },
    { symbol: "₮", color: "#a8f0ff", tint: 0x29e0ff, faceA: "#186478", faceB: "#082832" },
  ];
  const coinGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.07, 48);
  const coinMats = coinDefs.map((d) => {
    const face = new THREE.MeshStandardMaterial({
      map: coinTexture(d.symbol, d.color, d.faceA, d.faceB),
      metalness: 0.85, roughness: 0.28, envMapIntensity: 0.8,
    });
    const edge = new THREE.MeshStandardMaterial({
      color: d.tint, metalness: 0.95, roughness: 0.2, envMapIntensity: 0.9,
    });
    return [edge, face, face]; // cylinder: [side, top, bottom]
  });

  function makeRing(radius, count, tiltX, tiltZ, ringOpacity) {
    const ring = new THREE.Group();
    ring.rotation.x = tiltX;
    ring.rotation.z = tiltZ;

    const track = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.007, 8, 160),
      new THREE.MeshBasicMaterial({ color: 0x4a5b8c, transparent: true, opacity: ringOpacity })
    );
    track.rotation.x = Math.PI / 2;
    ring.add(track);

    const coins = [];
    for (let i = 0; i < count; i++) {
      const coin = new THREE.Mesh(coinGeo, coinMats[i % coinMats.length]);
      coin.userData = {
        angle: (i / count) * Math.PI * 2,
        radius,
        spin: 0.5 + Math.random() * 1.1,
      };
      coins.push(coin);
      ring.add(coin);
    }
    ring.userData = { coins, speed: 0.14 / Math.sqrt(radius) };
    world.add(ring);
    return ring;
  }

  const rings = [
    makeRing(3.1, 3, 0.45, 0.15, 0.45),
    makeRing(4.3, 4, -0.32, -0.25, 0.32),
    makeRing(5.6, 5, 0.18, 0.55, 0.2),
  ];

  /* ---- residual starfield (constant depth behind everything) ---- */
  const P = 500;
  const pos = new Float32Array(P * 3);
  const col = new Float32Array(P * 3);
  const size = new Float32Array(P);
  const palette = [new THREE.Color(0x29e0ff), new THREE.Color(0x8b5cf6), new THREE.Color(0xbfd4ff)];
  for (let i = 0; i < P; i++) {
    const r = 10 + Math.random() * 20;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.6;
    pos[i * 3 + 2] = r * Math.cos(phi) - 8;
    const c = palette[(Math.random() * palette.length) | 0];
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    size[i] = 3 + Math.random() * 7;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  pGeo.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
  pGeo.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
  const pMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uOpacity: { value: 0.45 }, uPixelRatio: { value: renderer.getPixelRatio() } },
    vertexShader: /* glsl */ `
      attribute vec3 aColor;
      attribute float aSize;
      varying vec3 vColor;
      uniform float uPixelRatio;
      void main() {
        vColor = aColor;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * uPixelRatio * (10.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      uniform float uOpacity;
      void main() {
        float d = distance(gl_PointCoord, vec2(0.5));
        float a = smoothstep(0.5, 0.08, d);
        gl_FragColor = vec4(vColor, a * uOpacity);
      }`,
  });
  const particles = new THREE.Points(pGeo, pMat);
  scene.add(particles);

  /* ============================================================
     PARTICLE FIELD — one meaningful moment. Quiet scattered dust
     ("crypto is complicated") gathers into a shield beside the
     safety-pledge headline, then dissolves before the stats so it
     never sits on text. Edge-weighted sampling keeps the shield
     silhouette crisp through the point-sprite glow. One draw
     call; morph math lives in the vertex shader.
     ============================================================ */
  const mobileScene = window.innerWidth <= 900;
  const N = LOW_POWER ? 3000 : (mobileScene ? 4000 : 7000);

  // resting state: loose, quiet dust — "crypto is complicated"
  const scatter = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const r = 6 + Math.random() * 20;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    scatter[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    scatter[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.55;
    scatter[i * 3 + 2] = r * Math.cos(phi) - 7;
  }

  // formed state: the shield, parked in the open space beside the
  // pledge headline. Most particles land on the rim (outer + inner
  // outline) so the silhouette reads; the rest thinly fill the face.
  const shieldShape = new THREE.Shape();
  shieldShape.moveTo(0, 1.35);
  shieldShape.quadraticCurveTo(1.25, 1.2, 1.25, 0.45);
  shieldShape.quadraticCurveTo(1.25, -0.75, 0, -1.45);
  shieldShape.quadraticCurveTo(-1.25, -0.75, -1.25, 0.45);
  shieldShape.quadraticCurveTo(-1.25, 1.2, 0, 1.35);

  const shieldScale = (mobileScene ? 1.05 : 1.35) * 1.45;
  const shieldAt = mobileScene ? [0, 0.4, -3.2] : [3.4, 0.3, -2.0];
  const shieldPos = new Float32Array(N * 3);
  const cEdge = new Float32Array(N);
  {
    const rim = shieldShape.getSpacedPoints(320);
    const sampler = new MeshSurfaceSampler(
      new THREE.Mesh(new THREE.ShapeGeometry(shieldShape), new THREE.MeshBasicMaterial())
    ).build();
    const v = new THREE.Vector3();
    for (let i = 0; i < N; i++) {
      const roll = Math.random();
      let x, y, z, edge;
      if (roll < 0.44) { // outer rim — the silhouette
        const p = rim[(Math.random() * rim.length) | 0];
        x = p.x; y = p.y; z = (Math.random() - 0.5) * 0.2; edge = 1;
      } else if (roll < 0.62) { // inner rim — reads as thickness
        const p = rim[(Math.random() * rim.length) | 0];
        x = p.x * 0.82; y = p.y * 0.82; z = (Math.random() - 0.5) * 0.2; edge = 1;
      } else { // sparse face fill
        sampler.sample(v);
        x = v.x; y = v.y; z = (Math.random() - 0.5) * 0.3; edge = 0;
      }
      const j = edge ? 0.035 : 0.07;
      shieldPos[i * 3] = x * shieldScale + shieldAt[0] + (Math.random() - 0.5) * j;
      shieldPos[i * 3 + 1] = y * shieldScale + shieldAt[1] + (Math.random() - 0.5) * j;
      shieldPos[i * 3 + 2] = z * shieldScale + shieldAt[2] + (Math.random() - 0.5) * j;
      cEdge[i] = edge;
    }
  }

  const cRand = new Float32Array(N);
  const cSize = new Float32Array(N);
  const cCol = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    cRand[i] = Math.random();
    cSize[i] = 2.2 + Math.random() * 5.5;
    const c = palette[(Math.random() * palette.length) | 0];
    cCol[i * 3] = c.r; cCol[i * 3 + 1] = c.g; cCol[i * 3 + 2] = c.b;
  }

  const cloudGeo = new THREE.BufferGeometry();
  cloudGeo.setAttribute("position", new THREE.BufferAttribute(scatter, 3));
  cloudGeo.setAttribute("aB", new THREE.BufferAttribute(shieldPos, 3));
  cloudGeo.setAttribute("aEdge", new THREE.BufferAttribute(cEdge, 1));
  cloudGeo.setAttribute("aRand", new THREE.BufferAttribute(cRand, 1));
  cloudGeo.setAttribute("aSize", new THREE.BufferAttribute(cSize, 1));
  cloudGeo.setAttribute("aColor", new THREE.BufferAttribute(cCol, 3));

  const cloudMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uForm: { value: 0 },
      uTime: { value: 0 },
      uDrift: { value: 0 },
      uPixelRatio: { value: renderer.getPixelRatio() },
      uMouse: { value: new THREE.Vector2(999, 999) },
      uTint: { value: new THREE.Color(0x29e0ff) },
      uTintAmt: { value: 0.25 },
      uOpacity: { value: 0.4 },
    },
    vertexShader: /* glsl */ `
      attribute vec3 aB;
      attribute float aEdge;
      attribute float aRand;
      attribute float aSize;
      attribute vec3 aColor;
      uniform float uForm;
      uniform float uTime;
      uniform float uDrift;
      uniform float uPixelRatio;
      uniform vec2 uMouse;
      varying vec3 vColor;
      varying float vGlow;
      varying float vForm;

      void main() {
        vColor = aColor;
        // staggered journeys: dust gathers into the shield as the
        // pledge scrolls in, and every particle has arrived by uForm=1
        float fs = clamp((uForm - aRand * 0.45) / 0.55, 0.0, 1.0);
        fs = fs * fs * (3.0 - 2.0 * fs);
        vForm = fs;
        // slow drift applies to the dust only — the baked shield
        // must land exactly where it was aimed, never rotated
        float cd = cos(uDrift), sd = sin(uDrift);
        vec3 sp = vec3(
          position.x * cd + position.z * sd,
          position.y,
          -position.x * sd + position.z * cd
        );
        vec3 p = mix(sp, aB, fs);
        // arc outward mid-flight so morphs read as flocking, not lerping
        vGlow = sin(fs * 3.14159);
        p += normalize(p + vec3(0.0001, 0.0002, 0.0003)) * vGlow * (0.3 + aRand * 0.5);
        // idle breathing — settles down once the shield is formed
        p += (0.05 + 0.05 * aRand) * (1.0 - fs * 0.7) * vec3(
          sin(uTime * 0.7 + aRand * 43.0),
          cos(uTime * 0.9 + aRand * 71.0),
          sin(uTime * 0.8 + aRand * 97.0)
        );
        // cursor repulsion, damped while formed so the shield holds
        vec2 d = p.xy - uMouse;
        float dist = length(d);
        float force = smoothstep(2.6, 0.0, dist) * (1.0 - fs * 0.7);
        p.xy += (d / max(dist, 0.001)) * force * 1.6;

        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        // formed particles tighten up — face fill more than the rim —
        // so the silhouette isn't smeared by big soft sprites
        float tighten = mix(1.0, mix(0.5, 0.85, aEdge), fs);
        gl_PointSize = aSize * tighten * uPixelRatio * (10.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vGlow;
      varying float vForm;
      uniform vec3 uTint;
      uniform float uTintAmt;
      uniform float uOpacity;
      void main() {
        float d = distance(gl_PointCoord, vec2(0.5));
        // sprites harden as they form so the shield edge stays crisp
        float a = smoothstep(0.5, mix(0.1, 0.34, vForm), d);
        vec3 col = mix(vColor, uTint, uTintAmt + vForm * 0.5);
        col += vGlow * 0.3; // particles brighten while traveling
        gl_FragColor = vec4(col, a * uOpacity);
      }`,
  });
  const cloud = new THREE.Points(cloudGeo, cloudMat);
  scene.add(cloud);

  // the shield completes while the pledge headline is on screen and
  // is fully dissolved before the stats arrive — it never sits on text
  function formOf(s) {
    return THREE.MathUtils.smoothstep(s, 0.28, 0.37) *
           (1 - THREE.MathUtils.smoothstep(s, 0.42, 0.52));
  }
  // the gem bows out for the pledge → stats → case-notes stretch
  // (its left-gutter parking spot there sits under full-width text)
  function gemFadeOf(s) {
    return THREE.MathUtils.smoothstep(s, 0.3, 0.38) *
           (1 - THREE.MathUtils.smoothstep(s, 0.6, 0.72));
  }
  let gemScale = 1;
  let cloudDrift = 0;

  /* ---- post-processing: bloom (desktop, with FPS watchdog) ---- */
  let composer = null;
  let useComposer = false;
  function buildComposer() {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2), 0.24, 0.7, 0.92
    );
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    useComposer = true;
  }
  if (window.innerWidth >= 768 && !LOW_POWER && !reduceMotion()) buildComposer();

  /* ---- eased interaction state ---- */
  const mouse = { x: 0, y: 0 };
  let scrollTarget = 0;
  let scrollSmooth = 0;
  let maxScroll = 1;
  let worldXTarget = 0;
  let worldYBase = 0;
  let camZBase = 12.5; // dollies in to 9 after the loader
  let fadeIn = 0;

  const isDesktopScene = () => window.innerWidth > 900;

  function computeStatic() {
    maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    worldYBase = isDesktopScene() ? 0 : -1.9;
    if (!isDesktopScene()) worldXTarget = 0;
  }
  computeStatic();
  worldXTarget = isDesktopScene() ? 2.35 : 0;

  // scene choreography: the gem swings to the empty gutter of each section
  const SECTION_X = {
    top: 2.35, services: 3.2, how: 3.2, safety: -3.0, stats: -3.0,
    stories: -3.0, pricing: 3.2, faq: 3.0, contact: 2.5,
  };
  const secIO = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      worldXTarget = isDesktopScene() ? (SECTION_X[e.target.id] ?? 2.35) : 0;
      if (!running) staticRender();
    }
  }, { rootMargin: "-45% 0px -45% 0px", threshold: 0 });
  document.querySelectorAll("section[id]").forEach((s) => secIO.observe(s));

  window.addEventListener("pointermove", (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  let staticScrollRaf = 0;
  window.addEventListener("scroll", () => {
    scrollTarget = Math.min(1, window.scrollY / maxScroll);
    if (!running && !staticScrollRaf) {
      staticScrollRaf = requestAnimationFrame(() => {
        staticScrollRaf = 0;
        staticRender();
      });
    }
  }, { passive: true });

  let lastW = window.innerWidth;
  let lastH = window.innerHeight;
  let resizeTimer = 0;
  window.addEventListener("resize", () => {
    // ignore mobile URL-bar collapse (height-only wiggles < 120px)
    if (window.innerWidth === lastW && Math.abs(window.innerHeight - lastH) < 120) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      lastW = window.innerWidth;
      lastH = window.innerHeight;
      camera.aspect = lastW / lastH;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_DPR));
      renderer.setSize(lastW, lastH);
      pMat.uniforms.uPixelRatio.value = renderer.getPixelRatio();
      cloudMat.uniforms.uPixelRatio.value = renderer.getPixelRatio();
      if (composer) composer.setSize(lastW, lastH);
      computeStatic();
      wire.material.opacity = isDesktopScene() ? 0.3 : 0.16;
      if (!running) staticRender(); // keep static mode visible
    }, 150);
  });

  /* ---- context loss ---- */
  let contextLost = false;
  canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    contextLost = true;
  });
  canvas.addEventListener("webglcontextrestored", () => {
    contextLost = false;
    if (!running) renderFrame(0.016);
  });

  /* ---- render ---- */
  const clock = new THREE.Clock();
  let running = false;
  let rafId = 0;
  let firstFrame = null;

  // FPS watchdog: if frames stay slow, drop bloom then resolution
  let slowFrames = 0;
  function watchdog(dt) {
    if (dt > 0.022) slowFrames++; else slowFrames = Math.max(0, slowFrames - 2);
    if (slowFrames > 45) {
      slowFrames = -600; // long cool-down before next demotion
      if (useComposer) useComposer = false;
      else {
        renderer.setPixelRatio(Math.max(1, renderer.getPixelRatio() - 0.5));
        pMat.uniforms.uPixelRatio.value = renderer.getPixelRatio();
        cloudMat.uniforms.uPixelRatio.value = renderer.getPixelRatio();
      }
    }
  }

  // static pose for reduced-motion: snap all eased values, render once
  function staticRender() {
    scrollSmooth = scrollTarget;
    world.position.x = worldXTarget;
    fadeIn = 1;
    camZBase = 9;
    const f = formOf(scrollSmooth);
    cloudMat.uniforms.uForm.value = f;
    cloudMat.uniforms.uOpacity.value = 0.4 + f * (mobileScene ? 0.25 : 0.45);
    gemScale = 1 - gemFadeOf(scrollSmooth) * 0.97;
    renderFrame(0.016);
  }

  function renderFrame(dt) {
    if (contextLost) return;
    const t = clock.elapsedTime;
    const k = 1 - Math.exp(-4.2 * dt);

    core.rotation.y = t * 0.16;
    core.rotation.x = Math.sin(t * 0.2) * 0.22;
    const pulse = 1 + Math.sin(t * 1.3) * 0.02;

    // dust gathers into the shield at the pledge, then lets go
    const form = formOf(scrollSmooth);
    cloudMat.uniforms.uForm.value = form;
    cloudMat.uniforms.uTime.value = t;
    cloudMat.uniforms.uOpacity.value +=
      ((0.4 + form * (mobileScene ? 0.25 : 0.45)) - cloudMat.uniforms.uOpacity.value) * k;
    // cursor in world space at the cloud's depth
    const halfH = Math.tan(0.48) * camera.position.z;
    cloudMat.uniforms.uMouse.value.set(
      mouse.x * halfH * camera.aspect + camera.position.x,
      -mouse.y * halfH + camera.position.y
    );
    // the gem bows out while the shield (then full-width text) has the stage
    const gemTarget = 1 - gemFadeOf(scrollSmooth) * 0.97;
    gemScale += (gemTarget - gemScale) * k * 0.7;
    core.scale.setScalar(pulse * gemScale);

    for (const ring of rings) {
      ring.rotation.y += ring.userData.speed * dt;
      for (const coin of ring.userData.coins) {
        const a = coin.userData.angle + t * ring.userData.speed;
        coin.position.set(
          Math.cos(a) * coin.userData.radius, 0, Math.sin(a) * coin.userData.radius
        );
        coin.rotation.x = t * coin.userData.spin;
        coin.rotation.z = t * coin.userData.spin * 0.6;
      }
    }

    particles.rotation.y = t * 0.014;
    cloudDrift += dt * 0.01 * (1 - form);
    cloudMat.uniforms.uDrift.value = cloudDrift;

    scrollSmooth += (scrollTarget - scrollSmooth) * k;
    world.rotation.y = scrollSmooth * Math.PI * 1.5;
    world.rotation.x = scrollSmooth * 0.45;
    world.position.y = worldYBase + scrollSmooth * 2.0;
    world.position.x += (worldXTarget - world.position.x) * k * 0.6;

    // lighting takes a cyan→violet journey down the page
    keyLight.color.lerpColors(keyA, keyB, scrollSmooth);
    rimLight.color.lerpColors(keyB, keyA, scrollSmooth);

    camZBase += (9 - camZBase) * (1 - Math.exp(-1.6 * dt));
    camera.position.z = camZBase + scrollSmooth * 4;
    camera.position.x += (mouse.x * 0.85 - camera.position.x) * k;
    camera.position.y += (-mouse.y * 0.55 - camera.position.y) * k;
    camera.lookAt(world.position.x * 0.55, 0, 0);

    // fade in on boot; duck near the footer so it never fights the form
    fadeIn += (1 - fadeIn) * (1 - Math.exp(-2.5 * dt));
    const endFade = 1 - Math.max(0, (scrollSmooth - 0.86) / 0.14) * 0.6;
    canvas.style.opacity = (fadeIn * endFade).toFixed(3);

    if (useComposer && composer) composer.render();
    else renderer.render(scene, camera);
  }

  function loop() {
    const dt = Math.min(clock.getDelta(), 0.05) || 0.016;
    renderFrame(dt);
    watchdog(dt);
    if (firstFrame) { firstFrame(); firstFrame = null; }
    rafId = requestAnimationFrame(loop);
  }

  function start() {
    if (running || reduceMotion()) return;
    running = true;
    clock.getDelta();
    rafId = requestAnimationFrame(loop);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(rafId);
  }

  document.addEventListener("visibilitychange", () => {
    document.hidden ? stop() : start();
  });

  motionQuery.addEventListener("change", () => {
    if (reduceMotion()) {
      stop();
      staticRender();
    } else {
      start();
    }
  });

  return new Promise((resolve) => {
    if (reduceMotion()) {
      camera.position.z = 9;
      useComposer = false;
      staticRender();
      canvas.style.opacity = "1";
      resolve();
    } else {
      firstFrame = resolve;
      start();
    }
  });
}

/* ------------------------------------------------------------
   Preloader → entrance choreography.
   Gated on fonts only — the canvas fades in whenever it's ready.
   ------------------------------------------------------------ */
function initLoader() {
  const loader = document.getElementById("loader");
  const pct = document.getElementById("loaderPct");
  const minTime = reduceMotion() ? 0 : 450;
  const t0 = performance.now();
  let displayed = 0;
  let target = 30;
  let done = false;

  document.fonts.ready.then(() => { target = 100; });

  function finish() {
    if (done) return;
    done = true;
    loader.classList.add("is-done");
    document.querySelector(".hero").classList.add("is-loaded");
    document.dispatchEvent(new Event("site:loaded"));
  }

  if (reduceMotion()) {
    document.fonts.ready.then(finish);
    setTimeout(finish, 1500);
    return;
  }

  (function tick(now) {
    if (done) return;
    target = Math.max(target, Math.min(95, (now - t0) / 12));
    displayed += (target - displayed) * 0.16;
    pct.textContent = String(Math.round(displayed)).padStart(2, "0");
    if (displayed > 99 && now - t0 > minTime) {
      pct.textContent = "100";
      finish();
      return;
    }
    requestAnimationFrame(tick);
  })(t0);

  setTimeout(finish, 2500);
}

/* ------------------------------------------------------------
   Reveal-on-scroll (staggered, leads the scroll)
   ------------------------------------------------------------ */
function initReveals() {
  const els = document.querySelectorAll(".reveal");
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target;
        el.classList.add("is-visible");
        el.addEventListener("transitionend", () => {
          el.style.removeProperty("--reveal-delay");
        }, { once: true });
        if (el.dataset.scramble !== undefined) scramble(el);
        io.unobserve(el);
      }
    },
    { threshold: 0.05, rootMargin: "0px 0px 12% 0px" }
  );

  const groups = new Map();
  for (const el of els) {
    const parent = el.parentElement;
    const n = groups.get(parent) || 0;
    el.style.setProperty("--reveal-delay", `${Math.min(n * 80, 240)}ms`);
    groups.set(parent, n + 1);
  }
  const begin = () => els.forEach((el) => {
    // anything already scrolled past (deep links) shows instantly
    if (el.getBoundingClientRect().bottom < 0) el.classList.add("is-visible");
    else io.observe(el);
  });
  if (document.querySelector(".loader.is-done")) begin();
  else document.addEventListener("site:loaded", begin, { once: true });
}

/* ------------------------------------------------------------
   Text scramble (crypto flavor, used sparingly on eyebrows)
   ------------------------------------------------------------ */
const GLYPHS = "!<>-_\\/[]{}—=+*^?#";
function scramble(el) {
  if (reduceMotion()) return;
  const finalText = el.textContent;
  el.setAttribute("aria-label", finalText);
  const chars = [...finalText].map((ch, i) => ({
    ch,
    lock: 4 + i * 1.4 + Math.random() * 7,
  }));
  let frame = 0;
  (function tick() {
    frame++;
    let out = "";
    let settled = true;
    for (const c of chars) {
      if (c.ch === " " || frame >= c.lock) out += c.ch;
      else {
        out += GLYPHS[(Math.random() * GLYPHS.length) | 0];
        settled = false;
      }
    }
    el.textContent = out;
    if (!settled) requestAnimationFrame(tick);
    else el.removeAttribute("aria-label");
  })();
}

/* ------------------------------------------------------------
   Card tilt + cursor glow (fine pointers only)
   ------------------------------------------------------------ */
function initTilt() {
  if (reduceMotion() || !finePointer.matches) return;
  for (const card of document.querySelectorAll(".tilt")) {
    let rect = null;
    let raf = 0;
    let ev = null;
    const apply = () => {
      raf = 0;
      if (!ev || !rect) return;
      const px = (ev.clientX - rect.left) / rect.width;
      const py = (ev.clientY - rect.top) / rect.height;
      card.style.transform = `rotateY(${(px - 0.5) * 8}deg) rotateX(${(0.5 - py) * 8}deg)`;
      card.style.setProperty("--mx", `${px * 100}%`);
      card.style.setProperty("--my", `${py * 100}%`);
    };
    card.addEventListener("pointerenter", () => { rect = card.getBoundingClientRect(); });
    card.addEventListener("pointermove", (e) => {
      ev = e;
      if (!raf) raf = requestAnimationFrame(apply);
    });
    card.addEventListener("pointerleave", () => {
      rect = null;
      card.style.transform = "rotateY(0deg) rotateX(0deg)";
    });
  }
}

/* ------------------------------------------------------------
   Magnetic buttons (fine pointers only)
   ------------------------------------------------------------ */
function initMagnetic() {
  if (reduceMotion() || !finePointer.matches) return;
  for (const el of document.querySelectorAll("[data-magnetic]")) {
    let raf = 0;
    let tx = 0, ty = 0, cx = 0, cy = 0;
    const tick = () => {
      cx += (tx - cx) * 0.18;
      cy += (ty - cy) * 0.18;
      el.style.transform = `translate(${cx.toFixed(2)}px, ${cy.toFixed(2)}px)`;
      if (Math.abs(tx - cx) > 0.1 || Math.abs(ty - cy) > 0.1) raf = requestAnimationFrame(tick);
      else raf = 0;
    };
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      tx = (e.clientX - r.left - r.width / 2) * 0.22;
      ty = (e.clientY - r.top - r.height / 2) * 0.32;
      if (!raf) raf = requestAnimationFrame(tick);
    });
    el.addEventListener("pointerleave", () => {
      tx = 0; ty = 0;
      if (!raf) raf = requestAnimationFrame(tick);
    });
  }
}

/* ------------------------------------------------------------
   Stat counters (markup holds final values; animate if allowed)
   ------------------------------------------------------------ */
function initCounters() {
  if (reduceMotion()) return;
  const stats = document.querySelectorAll(".stat__value[data-count]");
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const el = entry.target;
      io.unobserve(el);
      const target = parseInt(el.dataset.count, 10);
      if (!Number.isFinite(target)) continue;
      const dur = 1500;
      const start = performance.now();
      (function tick(now) {
        const p = Math.min((now - start) / dur, 1);
        const eased = 1 - Math.pow(2, -10 * p);
        el.textContent = Math.round(target * eased).toLocaleString("en-US");
        if (p < 1) requestAnimationFrame(tick);
        else el.textContent = target.toLocaleString("en-US");
      })(start);
    }
  }, { threshold: 0.5 });
  stats.forEach((el) => io.observe(el));
}

/* ------------------------------------------------------------
   Nav: solid background on scroll, mobile menu
   ------------------------------------------------------------ */
function initNav() {
  const nav = document.getElementById("nav");
  let raf = 0;
  const onScroll = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      nav.classList.toggle("nav--solid", window.scrollY > 40);
    });
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  const toggle = document.getElementById("navToggle");
  const menu = document.getElementById("mobileMenu");
  const setOpen = (open) => {
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    if (open) menu.hidden = false;
    requestAnimationFrame(() => menu.classList.toggle("is-open", open));
    document.body.style.overflow = open ? "hidden" : "";
    if (!open) setTimeout(() => { if (toggle.getAttribute("aria-expanded") === "false") menu.hidden = true; }, 380);
  };
  toggle.addEventListener("click", () =>
    setOpen(toggle.getAttribute("aria-expanded") !== "true"));
  menu.addEventListener("click", (e) => {
    if (e.target.closest("a")) setOpen(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
      setOpen(false);
      toggle.focus();
    }
  });
}

/* ------------------------------------------------------------
   Contact: copy email + intake form with visible fallback
   (static site: composes an email; never fails silently)
   ------------------------------------------------------------ */
function initContact() {
  const EMAIL = "help@thecrypto.support";
  const btn = document.getElementById("copyEmail");
  const label = btn.childNodes[0];
  btn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(EMAIL);
      label.textContent = "Copied to clipboard ";
    } catch {
      label.textContent = EMAIL + " ";
    }
    btn.classList.add("is-copied");
    setTimeout(() => {
      label.textContent = EMAIL + " ";
      btn.classList.remove("is-copied");
    }, 1800);
  });

  const form = document.getElementById("helpForm");
  const channel = form.elements.channel;
  const handleField = document.getElementById("handleField");
  const handleLabel = handleField.querySelector(".mono");
  channel.addEventListener("change", () => {
    const v = channel.value;
    handleField.hidden = v === "Email";
    handleLabel.textContent = v === "Telegram" ? "Your Telegram handle" : "Your phone number";
    handleField.querySelector("input").placeholder = v === "Telegram" ? "@yourhandle" : "+1 555 000 1234";
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const platform = (data.get("platform") || "").toString().trim();
    const handle = (data.get("handle") || "").toString().trim();
    const subject = `Support request${platform ? ` — ${platform}` : ""}`;
    const body =
      `Issue:\n${data.get("issue")}\n\n` +
      `Wallet / exchange: ${platform || "-"}\n` +
      `Preferred channel: ${data.get("channel")}${handle ? ` (${handle})` : ""}\n`;
    // show the copyable fallback BEFORE the mailto attempt, so a missing
    // mail client never swallows the lead
    const fb = document.getElementById("contactFallback");
    document.getElementById("fallbackText").value =
      `To: ${EMAIL}\nSubject: ${subject}\n\n${body}`;
    fb.hidden = false;
    window.location.href =
      `mailto:${EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });

  document.getElementById("copyMessage").addEventListener("click", async (e) => {
    const text = document.getElementById("fallbackText").value;
    try {
      await navigator.clipboard.writeText(text);
      e.target.textContent = "Copied — paste it into any email";
    } catch {
      document.getElementById("fallbackText").select();
    }
  });
}

/* ------------------------------------------------------------
   Boot — interactions first, WebGL last (and isolated)
   ------------------------------------------------------------ */
initReveals();
initTilt();
initMagnetic();
initCounters();
initNav();
initContact();
initLoader();

try {
  init3D();
} catch (err) {
  document.getElementById("bg3d").style.display = "none";
}
