/* ============================================================
   thecrypto.support — 3D scene + page interactions
   Three.js scene: crystal core, orbiting coin rings, particle
   field. Camera reacts to mouse and scroll.
   ============================================================ */

import * as THREE from "../vendor/three.module.min.js";

const prefersReducedMotion =
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ------------------------------------------------------------
   3D background
   ------------------------------------------------------------ */
function init3D() {
  const canvas = document.getElementById("bg3d");
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x060811, 0.055);

  const camera = new THREE.PerspectiveCamera(
    55, window.innerWidth / window.innerHeight, 0.1, 100
  );
  camera.position.set(0, 0, 9);

  /* ---- lights ---- */
  scene.add(new THREE.AmbientLight(0x334, 1.2));
  const keyLight = new THREE.PointLight(0x29e0ff, 90, 40);
  keyLight.position.set(6, 4, 6);
  scene.add(keyLight);
  const rimLight = new THREE.PointLight(0x8b5cf6, 70, 40);
  rimLight.position.set(-6, -3, 4);
  scene.add(rimLight);
  const backLight = new THREE.PointLight(0xf472b6, 40, 40);
  backLight.position.set(0, 5, -6);
  scene.add(backLight);

  /* ---- group that everything lives in (scroll-rotated) ---- */
  const world = new THREE.Group();
  scene.add(world);

  /* ---- crystal core: faceted icosahedron + glowing wireframe ---- */
  const core = new THREE.Group();
  const coreGeo = new THREE.IcosahedronGeometry(1.6, 1);
  const coreMat = new THREE.MeshPhysicalMaterial({
    color: 0x0b1430,
    metalness: 0.55,
    roughness: 0.18,
    transmission: 0.35,
    thickness: 1.5,
    emissive: 0x0a1a3a,
    flatShading: true,
  });
  core.add(new THREE.Mesh(coreGeo, coreMat));

  const wireMat = new THREE.MeshBasicMaterial({
    color: 0x29e0ff,
    wireframe: true,
    transparent: true,
    opacity: 0.35,
  });
  const wire = new THREE.Mesh(new THREE.IcosahedronGeometry(1.62, 1), wireMat);
  core.add(wire);

  const glowMat = new THREE.MeshBasicMaterial({
    color: 0x29e0ff,
    transparent: true,
    opacity: 0.05,
    side: THREE.BackSide,
  });
  core.add(new THREE.Mesh(new THREE.IcosahedronGeometry(2.0, 1), glowMat));
  world.add(core);

  /* ---- orbiting "coins" on two tilted rings ---- */
  const coinGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.06, 24);
  const coinMats = [
    new THREE.MeshStandardMaterial({ color: 0xf7b32b, metalness: 0.9, roughness: 0.25, emissive: 0x3a2600 }),
    new THREE.MeshStandardMaterial({ color: 0x29e0ff, metalness: 0.85, roughness: 0.2, emissive: 0x00303a }),
    new THREE.MeshStandardMaterial({ color: 0x8b5cf6, metalness: 0.85, roughness: 0.2, emissive: 0x1d0d3a }),
    new THREE.MeshStandardMaterial({ color: 0xc0c8d8, metalness: 0.95, roughness: 0.15, emissive: 0x14181f }),
  ];

  function makeRing(radius, count, tiltX, tiltZ, ringOpacity) {
    const ring = new THREE.Group();
    ring.rotation.x = tiltX;
    ring.rotation.z = tiltZ;

    const track = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.008, 8, 128),
      new THREE.MeshBasicMaterial({ color: 0x4a5b8c, transparent: true, opacity: ringOpacity })
    );
    track.rotation.x = Math.PI / 2;
    ring.add(track);

    const coins = [];
    for (let i = 0; i < count; i++) {
      const coin = new THREE.Mesh(coinGeo, coinMats[i % coinMats.length]);
      const angle = (i / count) * Math.PI * 2;
      coin.userData = { angle, radius, spin: 0.5 + Math.random() * 1.2 };
      coins.push(coin);
      ring.add(coin);
    }
    ring.userData = { coins, speed: 0.14 / Math.sqrt(radius) };
    world.add(ring);
    return ring;
  }

  const rings = [
    makeRing(3.1, 5, 0.45, 0.15, 0.35),
    makeRing(4.3, 7, -0.32, -0.25, 0.25),
    makeRing(5.6, 9, 0.18, 0.55, 0.15),
  ];

  /* ---- particle field ---- */
  const P_COUNT = 1600;
  const positions = new Float32Array(P_COUNT * 3);
  const speeds = new Float32Array(P_COUNT);
  for (let i = 0; i < P_COUNT; i++) {
    const r = 6 + Math.random() * 22;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.6;
    positions[i * 3 + 2] = r * Math.cos(phi) - 6;
    speeds[i] = 0.2 + Math.random() * 0.8;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const pMat = new THREE.PointsMaterial({
    color: 0x7fb8ff,
    size: 0.045,
    transparent: true,
    opacity: 0.7,
    sizeAttenuation: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const particles = new THREE.Points(pGeo, pMat);
  scene.add(particles);

  /* ---- interaction state ---- */
  const mouse = { x: 0, y: 0 };
  let scrollProgress = 0;

  window.addEventListener("pointermove", (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  function updateScroll() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    scrollProgress = max > 0 ? window.scrollY / max : 0;
  }
  window.addEventListener("scroll", updateScroll, { passive: true });
  updateScroll();

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  /* ---- animation loop ---- */
  const clock = new THREE.Clock();

  function frame() {
    const t = clock.getElapsedTime();
    const dt = Math.min(clock.getDelta(), 0.05) || 0.016;

    // core breathes and tumbles
    core.rotation.y = t * 0.18;
    core.rotation.x = Math.sin(t * 0.22) * 0.25;
    const pulse = 1 + Math.sin(t * 1.4) * 0.025;
    core.scale.setScalar(pulse);
    wire.rotation.y = -t * 0.1;

    // rings orbit; coins spin in place
    for (const ring of rings) {
      ring.rotation.y += ring.userData.speed * 0.016;
      for (const coin of ring.userData.coins) {
        const a = coin.userData.angle + t * ring.userData.speed;
        coin.position.set(
          Math.cos(a) * coin.userData.radius,
          0,
          Math.sin(a) * coin.userData.radius
        );
        coin.rotation.x = t * coin.userData.spin;
        coin.rotation.z = t * coin.userData.spin * 0.6;
      }
    }

    // particle drift
    particles.rotation.y = t * 0.015;

    // scroll drives the whole world: rotate + sink + pull back
    world.rotation.y = scrollProgress * Math.PI * 1.5;
    world.rotation.x = scrollProgress * 0.5;
    world.position.y = scrollProgress * 2.2;
    camera.position.z = 9 + scrollProgress * 4;

    // mouse parallax (eased)
    camera.position.x += (mouse.x * 0.9 - camera.position.x) * 2.2 * dt;
    camera.position.y += (-mouse.y * 0.6 - camera.position.y) * 2.2 * dt;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  if (prefersReducedMotion) {
    // single static render, no loop
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
  } else {
    frame();
  }
}

/* ------------------------------------------------------------
   Reveal-on-scroll (staggered)
   ------------------------------------------------------------ */
function initReveals() {
  const els = document.querySelectorAll(".reveal");
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-visible");
        io.unobserve(entry.target);
      }
    },
    { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
  );

  // stagger siblings that reveal together
  const groups = new Map();
  for (const el of els) {
    const parent = el.parentElement;
    if (!groups.has(parent)) groups.set(parent, 0);
    const n = groups.get(parent);
    el.style.setProperty("--reveal-delay", `${Math.min(n * 90, 450)}ms`);
    groups.set(parent, n + 1);
    io.observe(el);
  }
}

/* ------------------------------------------------------------
   Card tilt + cursor glow
   ------------------------------------------------------------ */
function initTilt() {
  if (prefersReducedMotion) return;
  for (const card of document.querySelectorAll(".tilt")) {
    card.addEventListener("pointermove", (e) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      card.style.transform =
        `rotateY(${(px - 0.5) * 10}deg) rotateX(${(0.5 - py) * 10}deg)`;
      card.style.setProperty("--mx", `${px * 100}%`);
      card.style.setProperty("--my", `${py * 100}%`);
    });
    card.addEventListener("pointerleave", () => {
      card.style.transform = "rotateY(0deg) rotateX(0deg)";
    });
  }
}

/* ------------------------------------------------------------
   Animated stat counters
   ------------------------------------------------------------ */
function initCounters() {
  const stats = document.querySelectorAll(".stat__value[data-count]");
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const el = entry.target;
      io.unobserve(el);
      const target = parseInt(el.dataset.count, 10);
      if (prefersReducedMotion) {
        el.textContent = target.toLocaleString();
        continue;
      }
      const dur = 1600;
      const start = performance.now();
      (function tick(now) {
        const p = Math.min((now - start) / dur, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * eased).toLocaleString();
        if (p < 1) requestAnimationFrame(tick);
      })(start);
    }
  }, { threshold: 0.4 });
  stats.forEach((el) => io.observe(el));
}

/* ------------------------------------------------------------
   Nav background on scroll
   ------------------------------------------------------------ */
function initNav() {
  const nav = document.getElementById("nav");
  const onScroll = () =>
    nav.classList.toggle("nav--solid", window.scrollY > 40);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}

init3D();
initReveals();
initTilt();
initCounters();
initNav();
