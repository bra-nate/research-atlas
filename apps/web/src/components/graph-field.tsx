import { useEffect, useRef } from "react";
import * as THREE from "three";
import { buildGraph } from "./graph-data";

const BG = 0x0a2e29; // brand-deep — matches the hero band for seamless fog

export default function GraphField() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(BG, 7, 16);

    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.set(0, 0, 9);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      return; // no WebGL — outer Suspense/fallback handles the empty case
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    host.appendChild(renderer.domElement);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";

    const data = buildGraph();
    const group = new THREE.Group();
    scene.add(group);

    // nodes as individual glowing sprites (cheap, always camera-facing)
    const sprite = makeGlowTexture();
    const phases: number[] = [];
    const bases: THREE.Vector3[] = [];
    data.nodes.forEach((n) => {
      const mat = new THREE.SpriteMaterial({
        map: sprite,
        color: n.color,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const s = new THREE.Sprite(mat);
      s.position.set(n.x, n.y, n.z);
      const scale = (n.isHub ? 1.6 : 1.0) * n.size * 1.8;
      s.scale.set(scale, scale, 1);
      group.add(s);
      bases.push(s.position.clone());
      phases.push(Math.random()); // visual phase only — not layout
    });

    // edges
    const positions: number[] = [];
    data.edges.forEach(([a, b]) => {
      const na = data.nodes[a];
      const nb = data.nodes[b];
      positions.push(na.x, na.y, na.z, nb.x, nb.y, nb.z);
    });
    const edgeGeom = new THREE.BufferGeometry();
    edgeGeom.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    const edgeMat = new THREE.LineBasicMaterial({
      color: 0x15a06b,
      transparent: true,
      opacity: 0.28,
    });
    const lines = new THREE.LineSegments(edgeGeom, edgeMat);
    group.add(lines);

    // pointer parallax (eased toward target)
    const target = { x: 0, y: 0 };
    const current = { x: 0, y: 0 };
    function onPointer(e: PointerEvent) {
      const r = host!.getBoundingClientRect();
      target.x = ((e.clientX - r.left) / r.width - 0.5) * 2;
      target.y = ((e.clientY - r.top) / r.height - 0.5) * 2;
    }
    window.addEventListener("pointermove", onPointer);

    // sizing
    function resize() {
      const w = host!.clientWidth || 1;
      const h = host!.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    // render loop with offscreen + hidden-tab pause
    let raf = 0;
    let visible = true;
    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible && !reduced) loop();
      },
      { threshold: 0 },
    );
    io.observe(host);

    let t = 0;
    function loop() {
      cancelAnimationFrame(raf);
      if (!visible || document.hidden) return;
      t += 0.016;
      group.rotation.y += 0.0016;
      // bob each node sprite
      for (let i = 0; i < bases.length; i++) {
        const s = group.children[i] as THREE.Sprite;
        s.position.y = bases[i].y + Math.sin(t + phases[i] * 6.28) * 0.06;
      }
      current.x += (target.x - current.x) * 0.04;
      current.y += (target.y - current.y) * 0.04;
      group.rotation.x = current.y * 0.25;
      group.position.x = current.x * 0.4;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    }

    if (reduced) {
      renderer.render(scene, camera); // single static frame
    } else {
      loop();
    }

    function onVisibility() {
      if (!document.hidden && visible && !reduced) loop();
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onPointer);
      document.removeEventListener("visibilitychange", onVisibility);
      ro.disconnect();
      io.disconnect();
      sprite.dispose();
      edgeGeom.dispose();
      edgeMat.dispose();
      group.children.forEach((c) => {
        if (c instanceof THREE.Sprite) c.material.dispose();
      });
      renderer.dispose();
      if (renderer.domElement.parentNode === host) {
        host.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={hostRef} aria-hidden className="h-full w-full" />;
}

/** Small radial-gradient glow used for every node sprite. */
function makeGlowTexture(): THREE.Texture {
  const size = 64;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  );
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.4, "rgba(255,255,255,0.6)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  return tex;
}
