import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const DEFAULTS = {
  cameraZ: 22,
  orbitMin: 26,
  orbitMax: 26,
  autoRotateSpeed: 0.23,
  bloom: true,
  density: 1,
  maxPixelRatio: 1.5,
  reducedMotion: false
};

const CAMERA_HEIGHT = 2;
const BLOOM_SCALE = 0.5;
const MIN_PIXEL_RATIO = 0.75;
const FRAME_BUDGET_MS = 1000 / 50;
const SLOW_FRAMES_BEFORE_DEGRADING = 20;

// How many clicks can be rippling through the network at once. The shaders size
// their uniform arrays off this, so it has to be a compile-time literal.
const MAX_PULSES = 3;

const PALETTE = [
  new THREE.Color(0x8a1f44),
  new THREE.Color(0xb3264f),
  new THREE.Color(0x5b2a3a),
  new THREE.Color(0x9c3a5b),
  new THREE.Color(0x3f1f2a)
];

// Deeper layers get later colours, with enough jitter that no two nodes on a
// layer look stamped from the same die.
function jitteredPaletteColor(level) {
  const color = PALETTE[Math.min(level, PALETTE.length - 1)].clone();
  color.offsetHSL(
    THREE.MathUtils.randFloatSpread(0.02),
    THREE.MathUtils.randFloatSpread(0.06),
    THREE.MathUtils.randFloatSpread(0.06)
  );
  return color;
}

// Nodes and connections each need their own copy: same values, separate objects.
function createPulseUniforms() {
  const far = () => new THREE.Vector3(1e3, 1e3, 1e3);
  return {
    uTime: { value: 0.0 },
    uPulsePositions: { value: Array.from({ length: MAX_PULSES }, far) },
    uPulseTimes: { value: Array.from({ length: MAX_PULSES }, () => -1e3) },
    uPulseColors: { value: Array.from({ length: MAX_PULSES }, () => new THREE.Color(1, 1, 1)) },
    uPulseSpeed: { value: 16.0 },
    uPulseStrength: { value: 0.55 }
  };
}

/* ── shaders ─────────────────────────────────────────────────────────────── */

const NOISE_GLSL = `
      vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
      vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
      float snoise(vec3 v) {
        const vec2 C = vec2(1.0/6.0, 1.0/3.0);
        const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
        vec3 i = floor(v + dot(v, C.yyy));
        vec3 x0 = v - i + dot(i, C.xxx);
        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min(g.xyz, l.zxy);
        vec3 i2 = max(g.xyz, l.zxy);
        vec3 x1 = x0 - i1 + C.xxx;
        vec3 x2 = x0 - i2 + C.yyy;
        vec3 x3 = x0 - D.yyy;
        i = mod289(i);
        vec4 p = permute(permute(permute(
          i.z + vec4(0.0, i1.z, i2.z, 1.0))
          + i.y + vec4(0.0, i1.y, i2.y, 1.0))
          + i.x + vec4(0.0, i1.x, i2.x, 1.0));
        float n_ = 0.142857142857;
        vec3 ns = n_ * D.wyz - D.xzx;
        vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_);
        vec4 x = x_ * ns.x + ns.yyyy;
        vec4 y = y_ * ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);
        vec4 b0 = vec4(x.xy, y.xy);
        vec4 b1 = vec4(x.zw, y.zw);
        vec4 s0 = floor(b0) * 2.0 + 1.0;
        vec4 s1 = floor(b1) * 2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));
        vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
        vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
        vec3 p0 = vec3(a0.xy, h.x);
        vec3 p1 = vec3(a0.zw, h.y);
        vec3 p2 = vec3(a1.xy, h.z);
        vec3 p3 = vec3(a1.zw, h.w);
        vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
        p0 *= norm.x;
        p1 *= norm.y;
        p2 *= norm.z;
        p3 *= norm.w;
        vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
        m = m * m;
        return 42.0 * dot(m * m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
      }`;

const PULSE_UNIFORMS_GLSL = `
        uniform float uTime;
        uniform vec3 uPulsePositions[${MAX_PULSES}];
        uniform float uPulseTimes[${MAX_PULSES}];
        uniform float uPulseSpeed;
        uniform float uPulseStrength;`;

// A click sends an expanding shell outwards; a point lights up as the shell
// sweeps past it, and the whole thing fades over its 3.6s life.
const PULSE_INTENSITY_GLSL = `
      float getPulseIntensity(vec3 worldPos, vec3 pulsePos, float pulseTime) {
        if (pulseTime < 0.0) return 0.0;
        float timeSinceClick = uTime - pulseTime;
        if (timeSinceClick < 0.0 || timeSinceClick > 3.6) return 0.0;
        float pulseRadius = timeSinceClick * uPulseSpeed;
        float distToClick = distance(worldPos, pulsePos);
        float pulseThickness = 2.8;
        float waveProximity = abs(distToClick - pulseRadius);
        return smoothstep(pulseThickness, 0.0, waveProximity) * smoothstep(3.6, 0.0, timeSinceClick);
      }

      float accumulatePulses(vec3 worldPos) {
        float pulse = 0.0;
        for (int i = 0; i < ${MAX_PULSES}; i++) {
          pulse += getPulseIntensity(worldPos, uPulsePositions[i], uPulseTimes[i]);
        }
        return min(pulse, 1.0);
      }`;

const NODE_SHADER = {
  vertexShader: `${NOISE_GLSL}
        attribute float nodeSize;
        attribute float nodeType;
        attribute vec3 nodeColor;
        attribute float distanceFromRoot;
${PULSE_UNIFORMS_GLSL}

        varying vec3 vColor;
        varying float vNodeType;
        varying vec3 vPosition;
        varying float vPulseIntensity;
        varying float vDistanceFromRoot;
        varying float vGlow;

        ${PULSE_INTENSITY_GLSL}

        void main() {
          vNodeType = nodeType;
          vColor = nodeColor;
          vDistanceFromRoot = distanceFromRoot;

          vec3 worldPos = (modelMatrix * vec4(position, 1.0)).xyz;
          vPosition = worldPos;
          vPulseIntensity = accumulatePulses(worldPos);

          float breathe = sin(uTime * 0.65 + distanceFromRoot * 0.15) * 0.12 + 0.88;
          float baseSize = nodeSize * breathe;
          vGlow = 0.5 + 0.5 * sin(uTime * 0.45 + distanceFromRoot * 0.2);

          vec3 modifiedPosition = position;
          if (nodeType > 0.5) {
            float noise = snoise(position * 0.08 + uTime * 0.08);
            modifiedPosition += normal * noise * 0.15;
          }

          vec4 mvPosition = modelViewMatrix * vec4(modifiedPosition, 1.0);
          float pulseSize = 1.0 + (vPulseIntensity * uPulseStrength * 0.22);
          gl_PointSize = baseSize * 0.55 * pulseSize * (1000.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }`,
  fragmentShader: `
        uniform float uTime;
        uniform vec3 uPulseColors[${MAX_PULSES}];
        uniform float uPulseStrength;

        varying vec3 vColor;
        varying float vNodeType;
        varying vec3 vPosition;
        varying float vPulseIntensity;
        varying float vDistanceFromRoot;
        varying float vGlow;

        void main() {
          vec2 center = 2.0 * gl_PointCoord - 1.0;
          float dist = length(center);
          if (dist > 0.6) discard;

          float glow1 = 1.0 - smoothstep(0.0, 0.5, dist);
          float glow2 = 1.0 - smoothstep(0.0, 1.0, dist);
          float glowStrength = (pow(glow1, 1.55) + glow2 * 0.10) * 0.46;

          float breatheColor = 0.9 + 0.1 * sin(uTime * 0.55 + vDistanceFromRoot * 0.22);
          vec3 baseColor = vColor * breatheColor;

          vec3 finalColor = baseColor;
          float alpha = glowStrength * (0.68 - 0.26 * dist);

          if (vPulseIntensity > 0.0) {
            vec3 pulseColor = uPulseColors[0];
            float p = vPulseIntensity * uPulseStrength;
            finalColor = mix(finalColor, pulseColor, p * 0.35);
            finalColor *= (1.0 + p * 0.35);
            alpha *= (1.0 + p * 0.45);
          }

          float coreBrightness = smoothstep(0.35, 0.0, dist);
          finalColor += vec3(1.0) * coreBrightness * 0.06;

          float camDistance = length(vPosition - cameraPosition);
          float distanceFade = smoothstep(100.0, 15.0, camDistance);
          if (vNodeType > 0.5) {
            finalColor *= 1.03;
            alpha *= 0.9;
          }

          finalColor *= (1.0 + vGlow * 0.05);
          gl_FragColor = vec4(finalColor, alpha * distanceFade);
        }`
};

const CONNECTION_SHADER = {
  vertexShader: `${NOISE_GLSL}
        attribute vec3 startPoint;
        attribute vec3 endPoint;
        attribute float connectionStrength;
        attribute float pathIndex;
        attribute vec3 connectionColor;
${PULSE_UNIFORMS_GLSL}

        varying vec3 vColor;
        varying float vConnectionStrength;
        varying float vPulseIntensity;
        varying float vPathPosition;
        varying float vDistanceFromCamera;

        ${PULSE_INTENSITY_GLSL}

        void main() {
          // position.x carries how far along the connection this vertex sits;
          // the curve itself is built here rather than baked into the geometry.
          float t = position.x;
          vPathPosition = t;

          vec3 midPoint = mix(startPoint, endPoint, 0.5);
          float pathOffset = sin(t * 3.14159) * 0.15;
          vec3 perpendicular = normalize(cross(normalize(endPoint - startPoint), vec3(0.0, 1.0, 0.0)));
          if (length(perpendicular) < 0.1) perpendicular = vec3(1.0, 0.0, 0.0);
          midPoint += perpendicular * pathOffset;

          vec3 p0 = mix(startPoint, midPoint, t);
          vec3 p1 = mix(midPoint, endPoint, t);
          vec3 finalPos = mix(p0, p1, t);

          float noiseTime = uTime * 0.15;
          float noise = snoise(vec3(pathIndex * 0.08, t * 0.6, noiseTime));
          finalPos += perpendicular * noise * 0.12;

          vec3 worldPos = (modelMatrix * vec4(finalPos, 1.0)).xyz;
          vPulseIntensity = accumulatePulses(worldPos);

          vColor = connectionColor;
          vConnectionStrength = connectionStrength;
          vDistanceFromCamera = length(worldPos - cameraPosition);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(finalPos, 1.0);
        }`,
  fragmentShader: `
        uniform float uTime;
        uniform vec3 uPulseColors[${MAX_PULSES}];
        uniform float uPulseStrength;

        varying vec3 vColor;
        varying float vConnectionStrength;
        varying float vPulseIntensity;
        varying float vPathPosition;
        varying float vDistanceFromCamera;

        void main() {
          float dash = mod(vPathPosition * 18.0, 1.0);
          if (dash > 0.6) discard;

          float flowPattern1 = sin(vPathPosition * 22.0 - uTime * 3.0) * 0.5 + 0.5;
          float flowPattern2 = sin(vPathPosition * 13.0 - uTime * 2.0 + 1.57) * 0.5 + 0.5;
          float combinedFlow = (flowPattern1 + flowPattern2 * 0.5) / 1.5;

          vec3 baseColor = vColor * (0.9 + 0.1 * sin(uTime * 0.5 + vPathPosition * 10.0));
          float flowIntensity = 0.18 * combinedFlow * vConnectionStrength;
          vec3 finalColor = baseColor * (0.85 + flowIntensity + vConnectionStrength * 0.22);

          float alpha = (0.34 * vConnectionStrength) + (combinedFlow * 0.08);
          if (vPulseIntensity > 0.0) {
            float p = vPulseIntensity * uPulseStrength;
            finalColor = mix(finalColor, uPulseColors[0], p * 0.25);
            alpha *= (1.0 + p * 0.4);
          }

          float distanceFade = smoothstep(100.0, 15.0, vDistanceFromCamera);
          gl_FragColor = vec4(finalColor, alpha * distanceFade);
        }`
};

/* ── network generation ──────────────────────────────────────────────────── */

const LAYERS = 5;
const LAYER_RADIUS = 4;
const NODES_PER_LAYER = 12;
const ROOT_SIZE = 2.0;
const PARENTS_PER_NODE = 3;
const NEIGHBOURS_PER_NODE = 5;
const LONG_RANGE_LINKS = 14;
const SEGMENTS_PER_CONNECTION = 18;

const NODE_BRANCH = 0;
const NODE_LEAF = 1;

class NetworkNode {
  constructor(position, level = 0, type = NODE_BRANCH) {
    this.position = position;
    this.connections = [];
    this.level = level;
    this.type = type;
    this.size =
      type === NODE_BRANCH ? THREE.MathUtils.randFloat(0.8, 1.3) : THREE.MathUtils.randFloat(0.5, 0.95);
    this.distanceFromRoot = 0;
  }

  addConnection(node, strength = 1.0) {
    if (this.isConnectedTo(node)) return;
    this.connections.push({ node, strength });
    node.connections.push({ node: this, strength });
  }

  isConnectedTo(node) {
    return this.connections.some((connection) => connection.node === node);
  }
}

function byDistanceFrom(origin) {
  return (a, b) => origin.distanceTo(a.position) - origin.distanceTo(b.position);
}

// Concentric shells of nodes spread by the golden angle, wired to their nearest
// neighbours inwards and sideways, plus a handful of shortcuts across the whole
// thing so it reads as a network rather than a lattice.
function generateCrystallineSphere(densityFactor = 1.0) {
  const rootNode = new NetworkNode(new THREE.Vector3(0, 0, 0), 0, NODE_BRANCH);
  rootNode.size = ROOT_SIZE;
  const nodes = [rootNode];

  const goldenRatio = (1 + Math.sqrt(5)) / 2;

  for (let layer = 1; layer <= LAYERS; layer++) {
    const radius = layer * LAYER_RADIUS;
    const numPoints = Math.floor(layer * NODES_PER_LAYER * densityFactor);

    for (let i = 0; i < numPoints; i++) {
      const phi = Math.acos(1 - (2 * (i + 0.5)) / numPoints);
      const theta = (2 * Math.PI * i) / goldenRatio;
      const position = new THREE.Vector3(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.sin(phi) * Math.sin(theta),
        radius * Math.cos(phi)
      );

      const isLeaf = layer === LAYERS || Math.random() < 0.3;
      const node = new NetworkNode(position, layer, isLeaf ? NODE_LEAF : NODE_BRANCH);
      node.distanceFromRoot = radius;
      nodes.push(node);

      if (layer === 1) {
        rootNode.addConnection(node, 0.85);
        continue;
      }

      const parents = nodes
        .filter((n) => n.level === layer - 1 && n !== rootNode)
        .sort(byDistanceFrom(position))
        .slice(0, PARENTS_PER_NODE);

      for (const parent of parents) {
        const strength = 1.0 - position.distanceTo(parent.position) / (radius * 2);
        node.addConnection(parent, Math.max(0.3, strength));
      }
    }

    // Sideways links, once the layer is fully populated.
    const layerNodes = nodes.filter((n) => n.level === layer && n !== rootNode);
    for (const node of layerNodes) {
      const nearby = layerNodes
        .filter((n) => n !== node)
        .sort(byDistanceFrom(node.position))
        .slice(0, NEIGHBOURS_PER_NODE);

      for (const neighbour of nearby) {
        if (node.position.distanceTo(neighbour.position) >= radius * 0.8) continue;
        if (node.isConnectedTo(neighbour)) continue;
        node.addConnection(neighbour, 0.55);
      }
    }
  }

  const outerNodes = nodes.filter((n) => n.level >= 3);
  for (let i = 0; i < Math.min(LONG_RANGE_LINKS, outerNodes.length); i++) {
    const a = outerNodes[Math.floor(Math.random() * outerNodes.length)];
    const b = outerNodes[Math.floor(Math.random() * outerNodes.length)];
    if (a !== b && !a.isConnectedTo(b) && Math.abs(a.level - b.level) > 1) {
      a.addConnection(b, 0.35);
    }
  }

  return nodes;
}

function buildNodesGeometry(nodes) {
  const positions = [];
  const normals = [];
  const types = [];
  const sizes = [];
  const colors = [];
  const distances = [];

  for (const node of nodes) {
    const { x, y, z } = node.position;
    positions.push(x, y, z);

    // Points carry no surface, so the outward direction stands in for a normal
    // when the vertex shader displaces leaf nodes.
    const length = Math.sqrt(x * x + y * y + z * z) || 1;
    normals.push(x / length, y / length, z / length);

    types.push(node.type);
    sizes.push(node.size);
    distances.push(node.distanceFromRoot);

    const color = jitteredPaletteColor(node.level);
    colors.push(color.r, color.g, color.b);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("nodeType", new THREE.Float32BufferAttribute(types, 1));
  geometry.setAttribute("nodeSize", new THREE.Float32BufferAttribute(sizes, 1));
  geometry.setAttribute("nodeColor", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute("distanceFromRoot", new THREE.Float32BufferAttribute(distances, 1));
  return geometry;
}

// Every connection becomes a strip of vertices carrying its endpoints; the
// vertex shader bends them into a curve.
function buildConnectionsGeometry(nodes) {
  const indexOf = new Map(nodes.map((node, index) => [node, index]));
  const positions = [];
  const startPoints = [];
  const endPoints = [];
  const strengths = [];
  const colors = [];
  const pathIndices = [];
  const seen = new Set();
  let pathIndex = 0;

  nodes.forEach((node, nodeIndex) => {
    for (const connection of node.connections) {
      const otherIndex = indexOf.get(connection.node);
      if (otherIndex === undefined) continue;

      // Connections are stored on both ends, so draw each one only once.
      const key = otherIndex < nodeIndex ? `${otherIndex}-${nodeIndex}` : `${nodeIndex}-${otherIndex}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const start = node.position;
      const end = connection.node.position;
      const level = Math.floor((node.level + connection.node.level) / 2);

      for (let i = 0; i < SEGMENTS_PER_CONNECTION; i++) {
        positions.push(i / (SEGMENTS_PER_CONNECTION - 1), 0, 0);
        startPoints.push(start.x, start.y, start.z);
        endPoints.push(end.x, end.y, end.z);
        pathIndices.push(pathIndex);
        strengths.push(connection.strength);

        const color = jitteredPaletteColor(level);
        colors.push(color.r, color.g, color.b);
      }
      pathIndex++;
    }
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("startPoint", new THREE.Float32BufferAttribute(startPoints, 3));
  geometry.setAttribute("endPoint", new THREE.Float32BufferAttribute(endPoints, 3));
  geometry.setAttribute("connectionStrength", new THREE.Float32BufferAttribute(strengths, 1));
  geometry.setAttribute("connectionColor", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute("pathIndex", new THREE.Float32BufferAttribute(pathIndices, 1));
  return geometry;
}

function createGlowMaterial(shader) {
  return new THREE.ShaderMaterial({
    uniforms: createPulseUniforms(),
    vertexShader: shader.vertexShader,
    fragmentShader: shader.fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
}

/* ── helpers ─────────────────────────────────────────────────────────────── */

function easeInOutCubic(t) {
  return t <= 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function readBackgroundColor() {
  const css = getComputedStyle(document.documentElement).getPropertyValue("--color-bg").trim();
  return new THREE.Color(css || "#121212");
}

// No GPU means every pixel is drawn by the CPU: draw one frame, then stop.
function isSoftwareRenderer(renderer) {
  try {
    const gl = renderer.getContext();
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    const name = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : "";
    return /swiftshader|llvmpipe|software|basic render|paravirtual/i.test(name);
  } catch {
    return false;
  }
}

/* ── instance ────────────────────────────────────────────────────────────── */

export function initNeuralNetwork(options = {}, root = null) {
  const opts = { ...DEFAULTS, ...options };

  const rootEl = root || document;
  const canvasWrapper = rootEl.querySelector(".canvas-wrapper");
  const canvasElement = rootEl.querySelector("#neural-network-canvas");
  if (!canvasWrapper || !canvasElement) return;

  const background = readBackgroundColor();

  const scene = new THREE.Scene();
  scene.background = background;
  scene.fog = new THREE.FogExp2(background, 0.002);

  const camera = new THREE.PerspectiveCamera(65, 2, 0.1, 1000);
  camera.position.set(0, CAMERA_HEIGHT, opts.cameraZ);

  const renderer = new THREE.WebGLRenderer({
    canvas: canvasElement,
    antialias: !opts.bloom,
    powerPreference: "high-performance",
    alpha: true
  });
  renderer.setClearColor(background, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  // A static scene renders on demand — once up front, then only when the user
  // moves the camera — instead of running a loop.
  const staticScene = opts.reducedMotion || isSoftwareRenderer(renderer);

  let pixelRatio = Math.min(window.devicePixelRatio, opts.maxPixelRatio);
  renderer.setPixelRatio(pixelRatio);

  /* sizing */

  let renderWidth = 0;
  let renderHeight = 0;

  function updateRendererSize() {
    renderWidth = canvasWrapper.offsetWidth || window.innerWidth;
    renderHeight = window.innerHeight;

    // When the canvas is narrower than the window, keep the framing the window
    // would have given and show the slice the canvas actually covers.
    const frustumWidth = Math.max(window.innerWidth, renderWidth);

    renderer.setSize(renderWidth, renderHeight);
    camera.aspect = frustumWidth / renderHeight;

    if (frustumWidth > renderWidth) {
      camera.setViewOffset(frustumWidth, renderHeight, 0, 0, renderWidth, renderHeight);
    } else {
      camera.clearViewOffset();
    }
    camera.updateProjectionMatrix();
  }
  updateRendererSize();

  /* controls */

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.rotateSpeed = 0.55;
  controls.enablePan = false;
  controls.minDistance = opts.orbitMin;
  controls.maxDistance = opts.orbitMax;
  controls.autoRotate = !staticScene;
  controls.autoRotateSpeed = opts.autoRotateSpeed;

  /* post-processing */

  let composer = null;
  let bloomPass = null;
  if (opts.bloom) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bloomPass = new UnrealBloomPass(
      new THREE.Vector2(renderWidth * BLOOM_SCALE, renderHeight * BLOOM_SCALE),
      0.45,
      0.5,
      0.55
    );
    composer.addPass(bloomPass);
    composer.addPass(new OutputPass());
  }

  /* scene contents */

  const nodes = generateCrystallineSphere(opts.density);
  const nodesMesh = new THREE.Points(buildNodesGeometry(nodes), createGlowMaterial(NODE_SHADER));
  const connectionsMesh = new THREE.Line(
    buildConnectionsGeometry(nodes),
    createGlowMaterial(CONNECTION_SHADER)
  );
  const meshes = [nodesMesh, connectionsMesh];
  scene.add(nodesMesh, connectionsMesh);

  for (const mesh of meshes) {
    PALETTE.slice(0, MAX_PULSES).forEach((color, i) => {
      mesh.material.uniforms.uPulseColors.value[i].copy(color);
    });
  }

  /* pulses */

  const clock = new THREE.Clock();
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const interactionPlane = new THREE.Plane();
  const interactionPoint = new THREE.Vector3();
  let lastPulseIndex = 0;

  function triggerPulse(clientX, clientY) {
    const rect = canvasElement.getBoundingClientRect();
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return;

    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);

    // Drop the pulse onto a plane facing the camera, halfway to the centre, so
    // clicks land somewhere inside the sphere rather than on its near face.
    interactionPlane.normal.copy(camera.position).normalize();
    interactionPlane.constant =
      -interactionPlane.normal.dot(camera.position) + camera.position.length() * 0.5;

    if (!raycaster.ray.intersectPlane(interactionPlane, interactionPoint)) return;

    lastPulseIndex = (lastPulseIndex + 1) % MAX_PULSES;
    const time = clock.getElapsedTime();
    const color = PALETTE[Math.floor(Math.random() * PALETTE.length)];

    for (const mesh of meshes) {
      const { uPulsePositions, uPulseTimes, uPulseColors } = mesh.material.uniforms;
      uPulsePositions.value[lastPulseIndex].copy(interactionPoint);
      uPulseTimes.value[lastPulseIndex] = time;
      uPulseColors.value[lastPulseIndex].copy(color);
    }
  }

  const isOverlay = (target) => Boolean(target?.closest?.(".glass-panel, .nav"));

  renderer.domElement.addEventListener("click", (event) => {
    if (isOverlay(event.target)) return;
    triggerPulse(event.clientX, event.clientY);
  });

  renderer.domElement.addEventListener(
    "touchstart",
    (event) => {
      if (isOverlay(event.target)) return;
      event.preventDefault();
      if (event.touches.length > 0) triggerPulse(event.touches[0].clientX, event.touches[0].clientY);
    },
    { passive: false }
  );

  /* camera tween */

  let currentOpts = { ...opts };
  let tween = null;

  function readCameraState() {
    return {
      cameraZ: camera.position.z,
      orbitMin: controls.minDistance,
      orbitMax: controls.maxDistance,
      autoRotateSpeed: controls.autoRotateSpeed
    };
  }

  function applyCameraState(state) {
    camera.position.set(0, CAMERA_HEIGHT, state.cameraZ);
    controls.minDistance = state.orbitMin;
    controls.maxDistance = state.orbitMax;
    controls.autoRotateSpeed = state.autoRotateSpeed;
    currentOpts = { ...currentOpts, ...state };
  }

  function animateTo(targetOpts, durationMs = 1200, onComplete) {
    if (staticScene) {
      applyCameraState(targetOpts);
      draw();
      onComplete?.();
      return;
    }

    tween = {
      startTime: null,
      duration: durationMs,
      from: null,
      to: { ...targetOpts },
      onComplete: onComplete || null
    };
  }

  function advanceTween(now) {
    if (tween.startTime == null) {
      tween.startTime = now;
      tween.from = readCameraState();
    }

    const progress = Math.min(((now - tween.startTime) * 1000) / tween.duration, 1);
    const eased = easeInOutCubic(progress);
    const state = {};
    for (const key of Object.keys(tween.from)) {
      state[key] = tween.from[key] + (tween.to[key] - tween.from[key]) * eased;
    }
    applyCameraState(state);

    if (progress < 1) return;
    const onComplete = tween.onComplete;
    tween = null;
    onComplete?.();
  }

  /* render loop */

  let inViewport = true;
  let pageVisible = !document.hidden;

  const visibilityObserver = new IntersectionObserver(
    (entries) => {
      inViewport = entries[0].isIntersecting;
    },
    { threshold: 0 }
  );
  visibilityObserver.observe(canvasWrapper);

  document.addEventListener("visibilitychange", () => {
    pageVisible = !document.hidden;
  });

  function draw(time = 0, pinCameraZ = null) {
    for (const mesh of meshes) {
      mesh.material.uniforms.uTime.value = time;
      mesh.rotation.y = Math.sin(time * 0.04) * 0.05;
    }

    controls.update();

    // OrbitControls fights the tween for the camera; the tween wins.
    if (pinCameraZ != null) camera.position.set(0, CAMERA_HEIGHT, pinCameraZ);

    if (composer) composer.render();
    else renderer.render(scene, camera);
  }

  // draw() runs controls.update(), which dispatches "change" again while damping
  // settles. Going through a frame keeps that from recursing into itself.
  let frameQueued = false;
  function redraw() {
    if (frameQueued) return;
    frameQueued = true;
    requestAnimationFrame(() => {
      frameQueued = false;
      draw();
    });
  }

  let slowFrames = 0;
  let lastFrameTime = 0;
  let parked = false;

  // Shed resolution when frames run long, and if that is not enough, give up on
  // the loop and fall back to rendering only what the user asks for.
  function considerQuality(now) {
    if (lastFrameTime) {
      const delta = now - lastFrameTime;
      if (delta < 500) slowFrames = delta > FRAME_BUDGET_MS ? slowFrames + 1 : 0;
    }
    lastFrameTime = now;

    if (slowFrames < SLOW_FRAMES_BEFORE_DEGRADING) return;
    slowFrames = 0;

    if (pixelRatio > MIN_PIXEL_RATIO) {
      pixelRatio = Math.max(MIN_PIXEL_RATIO, pixelRatio - 0.25);
      renderer.setPixelRatio(pixelRatio);
      onWindowResize();
      return;
    }

    parked = true;
    controls.autoRotate = false;
    controls.addEventListener("change", redraw);
  }

  function animate(now = 0) {
    if (parked) return;
    requestAnimationFrame(animate);
    if (!inViewport || !pageVisible) return;

    considerQuality(now);

    const time = clock.getElapsedTime();
    if (tween) advanceTween(time);

    draw(time, tween ? currentOpts.cameraZ : null);
  }

  function onWindowResize() {
    updateRendererSize();
    if (composer) composer.setSize(renderWidth, renderHeight);
    if (bloomPass) bloomPass.resolution.set(renderWidth * BLOOM_SCALE, renderHeight * BLOOM_SCALE);
    if (staticScene) draw();
  }

  window.addEventListener("resize", onWindowResize);

  if (staticScene) {
    controls.addEventListener("change", redraw);
    draw();
  } else {
    animate();
  }

  return { animateTo };
}
