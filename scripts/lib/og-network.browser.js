(function drawOgNetwork() {
  const cfg = window.__OG_NETWORK__;
  const canvas = document.getElementById("network");
  if (!cfg || !canvas) return;

  const W = canvas.width;
  const H = canvas.height;

  function mulberry32(a) {
    return function random() {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const rng = mulberry32(0x1c0de);

  const PALETTE = [
    [0x7a, 0x17, 0x3a],
    [0xff, 0x2d, 0x6d],
    [0x5a, 0x3a, 0x45],
    [0xc4, 0x3a, 0x6a],
    [0x2f, 0x1a, 0x22],
  ];

  const rgba = (c, a) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;

  function jitter(c) {
    const k = 0.88 + rng() * 0.3;
    return [
      Math.min(255, Math.round(c[0] * k)),
      Math.min(255, Math.round(c[1] * k)),
      Math.min(255, Math.round(c[2] * k)),
    ];
  }

  const LAYERS = 5;
  const GOLDEN = (1 + Math.sqrt(5)) / 2;

  const nodes = [{ x: 0, y: 0, z: 0, level: 0, size: 2.0, color: PALETTE[0] }];
  const connections = [];
  const seen = new Set();

  function connect(a, b, strength) {
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (seen.has(key)) return;
    seen.add(key);
    const level = Math.min(Math.floor((nodes[a].level + nodes[b].level) / 2), PALETTE.length - 1);
    connections.push({ a, b, strength, color: jitter(PALETTE[level]) });
  }

  const distance = (p, q) => Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z);

  for (let layer = 1; layer <= LAYERS; layer++) {
    const radius = layer * 4;
    const count = Math.floor(layer * 12 * cfg.density);
    const first = nodes.length;

    for (let i = 0; i < count; i++) {
      const phi = Math.acos(1 - (2 * (i + 0.5)) / count);
      const theta = (2 * Math.PI * i) / GOLDEN;
      const node = {
        x: radius * Math.sin(phi) * Math.cos(theta),
        y: radius * Math.sin(phi) * Math.sin(theta),
        z: radius * Math.cos(phi),
        level: layer,
        size: rng() < 0.3 || layer === LAYERS ? 0.5 + rng() * 0.45 : 0.8 + rng() * 0.5,
        color: jitter(PALETTE[Math.min(layer, PALETTE.length - 1)]),
      };
      const index = nodes.push(node) - 1;

      if (layer === 1) {
        connect(0, index, 0.85);
        continue;
      }

      const previous = [];
      for (let j = 1; j < nodes.length - 1; j++) {
        if (nodes[j].level === layer - 1) previous.push(j);
      }
      previous.sort((p, q) => distance(node, nodes[p]) - distance(node, nodes[q]));
      for (let j = 0; j < Math.min(3, previous.length); j++) {
        const d = distance(node, nodes[previous[j]]);
        connect(index, previous[j], Math.max(0.3, 1 - d / (radius * 2)));
      }
    }

    for (let i = first; i < nodes.length; i++) {
      const near = [];
      for (let j = first; j < nodes.length; j++) if (j !== i) near.push(j);
      near.sort((p, q) => distance(nodes[i], nodes[p]) - distance(nodes[i], nodes[q]));
      for (const j of near.slice(0, 5)) {
        if (distance(nodes[i], nodes[j]) < radius * 0.8) connect(i, j, 0.55);
      }
    }
  }

  const FOV = (65 * Math.PI) / 180;
  const focal = H / 2 / Math.tan(FOV / 2);

  const { yaw, pitch, distance: camDistance } = cfg.camera;
  const eye = {
    x: camDistance * Math.cos(pitch) * Math.sin(yaw),
    y: camDistance * Math.sin(pitch),
    z: camDistance * Math.cos(pitch) * Math.cos(yaw),
  };

  const norm = (v) => {
    const l = Math.hypot(v.x, v.y, v.z) || 1;
    return { x: v.x / l, y: v.y / l, z: v.z / l };
  };
  const cross = (a, b) => ({
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  });

  const forward = norm({ x: -eye.x, y: -eye.y, z: -eye.z });
  const right = norm(cross(forward, { x: 0, y: 1, z: 0 }));
  const up = cross(right, forward);

  const centreX = W * cfg.centre[0];
  const centreY = H * cfg.centre[1];

  function project(p) {
    const dx = p.x - eye.x;
    const dy = p.y - eye.y;
    const dz = p.z - eye.z;
    const depth = dx * forward.x + dy * forward.y + dz * forward.z;
    if (depth <= 0.1) return null;

    const vx = dx * right.x + dy * right.y + dz * right.z;
    const vy = dx * up.x + dy * up.y + dz * up.z;
    return {
      x: centreX + (vx * focal) / depth,
      y: centreY - (vy * focal) / depth,
      depth,
    };
  }

  function depthFade(depth) {
    const t = Math.min(Math.max((depth - 100) / (15 - 100), 0), 1);
    return t * t * (3 - 2 * t);
  }

  const layer = document.createElement("canvas");
  layer.width = W;
  layer.height = H;
  const ctx = layer.getContext("2d");
  ctx.globalCompositeOperation = "lighter";

  const screen = nodes.map(project);

  ctx.lineCap = "round";
  for (const link of connections) {
    const a = screen[link.a];
    const b = screen[link.b];
    if (!a || !b) continue;

    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length < 1 || length > W) continue;

    const fade = depthFade((a.depth + b.depth) / 2);
    if (fade <= 0.01) continue;

    const step = length / 18;
    ctx.setLineDash([step * 0.6, step * 0.4]);
    ctx.lineWidth = 1.1;
    ctx.strokeStyle = rgba(link.color, 0.62 * link.strength * fade);

    const bow = length * 0.06;
    const mx = (a.x + b.x) / 2 + ((a.y - b.y) / length) * bow;
    const my = (a.y + b.y) / 2 + ((b.x - a.x) / length) * bow;

    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo(mx, my, b.x, b.y);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  const order = nodes
    .map((node, i) => i)
    .filter((i) => screen[i])
    .sort((i, j) => screen[j].depth - screen[i].depth);

  for (const i of order) {
    const point = screen[i];
    const fade = depthFade(point.depth);
    if (fade <= 0.01) continue;

    const radius = Math.max(1.2, (550 * nodes[i].size) / point.depth / 2);
    if (point.x < -radius || point.x > W + radius) continue;
    if (point.y < -radius || point.y > H + radius) continue;

    const colour = nodes[i].color;
    const glow = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius);
    glow.addColorStop(0, rgba([255, 255, 255], 0.5 * fade));
    glow.addColorStop(0.25, rgba(colour, 0.72 * fade));
    glow.addColorStop(1, rgba(colour, 0));

    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  const out = canvas.getContext("2d");
  out.globalCompositeOperation = "lighter";

  out.globalAlpha = cfg.opacity * 0.55;
  out.filter = "blur(14px)";
  out.drawImage(layer, 0, 0);

  out.filter = "blur(4px)";
  out.globalAlpha = cfg.opacity * 0.4;
  out.drawImage(layer, 0, 0);

  out.filter = "none";
  out.globalAlpha = cfg.opacity;
  out.drawImage(layer, 0, 0);
})();
