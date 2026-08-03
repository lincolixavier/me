import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

/**
 * Initializes the neural network visualization inside a given root element.
 * Designed for lazy loading: use with <neural-canvas> which loads this module
 * only when the canvas enters the viewport (Intersection Observer).
 *
 * @param {Object} options - cameraZ, orbitMin, orbitMax, autoRotateSpeed
 * @param {Document|Element} [root=document] - Root to resolve .canvas-wrapper and canvas (e.g. the <neural-canvas> element)
 * @returns {{ animateTo: Function }|undefined} API with animateTo(); undefined if canvas not found
 */
export function initNeuralNetwork(options = {}, root = null) {
  const opts = {
    cameraZ: 22,
    orbitMin: 26,
    orbitMax: 26,
    autoRotateSpeed: 0.23,
    bloom: true,
    density: 1,
    // When true the scene is drawn but never animates on its own: no auto
    // rotation, no pulses, no render loop. It redraws only on user interaction.
    reducedMotion: false,
    ...options
  };

  const rootEl = root || document;
  const canvasWrapper = rootEl.querySelector(".canvas-wrapper");
  const canvasElement = rootEl.querySelector("#neural-network-canvas");
  if (!canvasWrapper || !canvasElement) return;

  const config = {
      densityFactor: opts.density,
      activePaletteIndex: 0
    };

    const colorPalettes = [
  // Base rosé discreta (harmonizada com #ff2d6d)
  [
    new THREE.Color(0x8a1f44), // vinho rosé
    new THREE.Color(0xb3264f), // framboesa
    new THREE.Color(0x5b2a3a), // malva escuro
    new THREE.Color(0x9c3a5b), // pink queimado
    new THREE.Color(0x3f1f2a)  // ameixa
  ],

  // Contraste moderado (picos sutis mais vivos)
  [
    new THREE.Color(0x7a173a), // vinho profundo
    new THREE.Color(0xff2d6d), // rosé vivo (âncora)
    new THREE.Color(0x5a3a45), // cinza rosado
    new THREE.Color(0xc43a6a), // pink destacado
    new THREE.Color(0x2f1a22)  // quase preto quente
  ],

  // Mais contraste, ainda controlado
  [
    new THREE.Color(0x61122f), // vinho fechado
    new THREE.Color(0xd7265e), // magenta vivo contido
    new THREE.Color(0x8a4a5f), // rosé dessaturado
    new THREE.Color(0xff4d7f), // highlight suave
    new THREE.Color(0x24131a)  // base escura
  ]
];

    const pulseUniforms = {
      uTime: { value: 0.0 },
      uPulsePositions: {
        value: [
          new THREE.Vector3(1e3, 1e3, 1e3),
          new THREE.Vector3(1e3, 1e3, 1e3),
          new THREE.Vector3(1e3, 1e3, 1e3)
        ]
      },
      uPulseTimes: { value: [-1e3, -1e3, -1e3] },
      uPulseColors: { value: [new THREE.Color(1, 1, 1), new THREE.Color(1, 1, 1), new THREE.Color(1, 1, 1)] },
      uPulseSpeed: { value: 16.0 },
      uPulseStrength: { value: 0.55 }
    };

    // The page background is the scene background. Read from --color-bg so the
    // design token stays the single source of truth: change it once and the
    // canvas, the fog and the page all follow.
    const cssBackground = getComputedStyle(document.documentElement)
      .getPropertyValue("--color-bg")
      .trim();
    const background = new THREE.Color(cssBackground || "#121212");

    const scene = new THREE.Scene();
    scene.background = background;
    // Same colour as the background, so distant nodes fade into the page.
    scene.fog = new THREE.FogExp2(background, 0.002);

  const camera = new THREE.PerspectiveCamera(65, 2, 0.1, 1000);
  camera.position.set(0, 2, opts.cameraZ);

    const renderer = new THREE.WebGLRenderer({
      canvas: canvasElement,
      // MSAA only applies to the default framebuffer. With bloom on, the
      // composer renders into its own target and antialias here would cost a
      // multisampled backbuffer for nothing.
      antialias: !opts.bloom,
      powerPreference: "high-performance",
      alpha: true
    });

    renderer.setClearColor(background, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const MAX_PIXEL_RATIO = 1.5;
    let pixelRatio = Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO);
    renderer.setPixelRatio(pixelRatio);

    let renderWidth = 0;
    let renderHeight = 0;

    /**
     * The layout deliberately pushes the network off the right edge, so part
     * of the frustum is never on screen. Rather than render those pixels and
     * throw them away, the canvas covers only the visible strip and
     * setViewOffset renders exactly that sub-rectangle of the original, wider
     * frustum — same framing, fewer pixels.
     *
     * --canvas-overscan is how many times wider the full frustum is than the
     * visible strip, and lives in CSS next to the layout it describes.
     */
    const updateRendererSize = () => {
      const overscan =
        parseFloat(getComputedStyle(canvasWrapper).getPropertyValue("--canvas-overscan")) || 1;

      renderWidth = canvasWrapper.offsetWidth;
      renderHeight = window.innerHeight;
      const frustumWidth = renderWidth * overscan;

      renderer.setSize(renderWidth, renderHeight);
      camera.aspect = frustumWidth / renderHeight;

      if (overscan > 1) {
        camera.setViewOffset(frustumWidth, renderHeight, 0, 0, renderWidth, renderHeight);
      } else {
        camera.clearViewOffset();
      }
      camera.updateProjectionMatrix();
    };
    updateRendererSize();

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.rotateSpeed = 0.55;
  controls.minDistance = opts.orbitMin;
  controls.maxDistance = opts.orbitMax;
  controls.autoRotate = !opts.reducedMotion;
  controls.autoRotateSpeed = opts.autoRotateSpeed;
    controls.enablePan = false;

  let currentOpts = { ...opts };
  let tween = null;
  function easeInOutCubic(t) {
    return t <= 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
  function animateTo(targetOpts, durationMs = 1200, onComplete) {
    // Reduced motion: jump straight to the target framing, no camera flight.
    if (opts.reducedMotion) {
      camera.position.set(0, 2, targetOpts.cameraZ);
      controls.minDistance = targetOpts.orbitMin;
      controls.maxDistance = targetOpts.orbitMax;
      currentOpts = { ...currentOpts, ...targetOpts };
      draw();
      onComplete?.();
      return;
    }
    tween = {
      startTime: null,
      duration: durationMs,
      from: null,
      to: {
        cameraZ: targetOpts.cameraZ,
        orbitMin: targetOpts.orbitMin,
        orbitMax: targetOpts.orbitMax,
        autoRotateSpeed: targetOpts.autoRotateSpeed
      },
      onComplete: onComplete || null
    };
  }
  function applyTween(progress) {
    const T = tween;
    const t = easeInOutCubic(progress);
    const cz = T.from.cameraZ + (T.to.cameraZ - T.from.cameraZ) * t;
    const omin = T.from.orbitMin + (T.to.orbitMin - T.from.orbitMin) * t;
    const omax = T.from.orbitMax + (T.to.orbitMax - T.from.orbitMax) * t;
    const ars = T.from.autoRotateSpeed + (T.to.autoRotateSpeed - T.from.autoRotateSpeed) * t;
    camera.position.set(0, 2, cz);
    controls.minDistance = omin;
    controls.maxDistance = omax;
    controls.autoRotateSpeed = ars;
    currentOpts = { cameraZ: cz, orbitMin: omin, orbitMax: omax, autoRotateSpeed: ars };
  }

    const BLOOM_SCALE = 0.5;

    let composer = null;
    let bloomPass = null;
    if (opts.bloom) {
      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      // Bloom is a low-frequency effect, so it is blurry by definition.
      // Running its mip chain at half resolution is visually indistinguishable
      // and costs roughly a quarter of the fill rate.
      bloomPass = new UnrealBloomPass(
        new THREE.Vector2(renderWidth * BLOOM_SCALE, renderHeight * BLOOM_SCALE),
        0.45,
        0.5,
        0.55
      );
      composer.addPass(bloomPass);
      composer.addPass(new OutputPass());
    }

    const noiseFunctions = `
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

    const nodeShader = {
      vertexShader: `${noiseFunctions}
        attribute float nodeSize;
        attribute float nodeType;
        attribute vec3 nodeColor;
        attribute float distanceFromRoot;

        uniform float uTime;
        uniform vec3 uPulsePositions[3];
        uniform float uPulseTimes[3];
        uniform float uPulseSpeed;
        uniform float uPulseStrength;

        varying vec3 vColor;
        varying float vNodeType;
        varying vec3 vPosition;
        varying float vPulseIntensity;
        varying float vDistanceFromRoot;
        varying float vGlow;

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

        void main() {
          vNodeType = nodeType;
          vColor = nodeColor;
          vDistanceFromRoot = distanceFromRoot;

          vec3 worldPos = (modelMatrix * vec4(position, 1.0)).xyz;
          vPosition = worldPos;

          float pulse = 0.0;
          for (int i = 0; i < 3; i++) {
            pulse += getPulseIntensity(worldPos, uPulsePositions[i], uPulseTimes[i]);
          }
          vPulseIntensity = min(pulse, 1.0);

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
        uniform vec3 uPulseColors[3];
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

    const connectionShader = {
      vertexShader: `${noiseFunctions}
        attribute vec3 startPoint;
        attribute vec3 endPoint;
        attribute float connectionStrength;
        attribute float pathIndex;
        attribute vec3 connectionColor;

        uniform float uTime;
        uniform vec3 uPulsePositions[3];
        uniform float uPulseTimes[3];
        uniform float uPulseSpeed;
        uniform float uPulseStrength;

        varying vec3 vColor;
        varying float vConnectionStrength;
        varying float vPulseIntensity;
        varying float vPathPosition;
        varying float vDistanceFromCamera;

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

        void main() {
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
          float pulse = 0.0;
          for (int i = 0; i < 3; i++) {
            pulse += getPulseIntensity(worldPos, uPulsePositions[i], uPulseTimes[i]);
          }
          vPulseIntensity = min(pulse, 1.0);

          vColor = connectionColor;
          vConnectionStrength = connectionStrength;
          vDistanceFromCamera = length(worldPos - cameraPosition);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(finalPos, 1.0);
        }`,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uPulseColors[3];
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

    class Node {
      constructor(position, level = 0, type = 0) {
        this.position = position;
        this.connections = [];
        this.level = level;
        this.type = type;
        this.size = type === 0 ? THREE.MathUtils.randFloat(0.8, 1.3) : THREE.MathUtils.randFloat(0.5, 0.95);
        this.distanceFromRoot = 0;
      }
      addConnection(node, strength = 1.0) {
        if (!this.isConnectedTo(node)) {
          this.connections.push({ node, strength });
          node.connections.push({ node: this, strength });
        }
      }
      isConnectedTo(node) {
        return this.connections.some((conn) => conn.node === node);
      }
    }

    function generateCrystallineSphere(densityFactor = 1.0) {
      const nodes = [];
      const rootNode = new Node(new THREE.Vector3(0, 0, 0), 0, 0);
      rootNode.size = 2.0;
      nodes.push(rootNode);

      const layers = 5;
      const goldenRatio = (1 + Math.sqrt(5)) / 2;
      for (let layer = 1; layer <= layers; layer++) {
        const radius = layer * 4;
        const numPoints = Math.floor(layer * 12 * densityFactor);
        for (let i = 0; i < numPoints; i++) {
          const phi = Math.acos(1 - (2 * (i + 0.5)) / numPoints);
          const theta = (2 * Math.PI * i) / goldenRatio;
          const pos = new THREE.Vector3(
            radius * Math.sin(phi) * Math.cos(theta),
            radius * Math.sin(phi) * Math.sin(theta),
            radius * Math.cos(phi)
          );
          const isLeaf = layer === layers || Math.random() < 0.3;
          const node = new Node(pos, layer, isLeaf ? 1 : 0);
          node.distanceFromRoot = radius;
          nodes.push(node);
          if (layer > 1) {
            const prevLayerNodes = nodes.filter((n) => n.level === layer - 1 && n !== rootNode);
            prevLayerNodes.sort((a, b) => pos.distanceTo(a.position) - pos.distanceTo(b.position));
            for (let j = 0; j < Math.min(3, prevLayerNodes.length); j++) {
              const dist = pos.distanceTo(prevLayerNodes[j].position);
              const strength = 1.0 - dist / (radius * 2);
              node.addConnection(prevLayerNodes[j], Math.max(0.3, strength));
            }
          } else {
            rootNode.addConnection(node, 0.85);
          }
        }

        const layerNodes = nodes.filter((n) => n.level === layer && n !== rootNode);
        for (let i = 0; i < layerNodes.length; i++) {
          const node = layerNodes[i];
          const nearby = layerNodes
            .filter((n) => n !== node)
            .sort((a, b) => node.position.distanceTo(a.position) - node.position.distanceTo(b.position))
            .slice(0, 5);
          for (const nearNode of nearby) {
            const dist = node.position.distanceTo(nearNode.position);
            if (dist < radius * 0.8 && !node.isConnectedTo(nearNode)) {
              node.addConnection(nearNode, 0.55);
            }
          }
        }
      }

      const outerNodes = nodes.filter((n) => n.level >= 3);
      for (let i = 0; i < Math.min(14, outerNodes.length); i++) {
        const n1 = outerNodes[Math.floor(Math.random() * outerNodes.length)];
        const n2 = outerNodes[Math.floor(Math.random() * outerNodes.length)];
        if (n1 !== n2 && !n1.isConnectedTo(n2) && Math.abs(n1.level - n2.level) > 1) {
          n1.addConnection(n2, 0.35);
        }
      }

      return { nodes, rootNode };
    }

    let neuralNetwork = null;
    let nodesMesh = null;
    let connectionsMesh = null;

    function createNetworkVisualization() {
      if (nodesMesh) {
        scene.remove(nodesMesh);
        nodesMesh.geometry.dispose();
        nodesMesh.material.dispose();
      }
      if (connectionsMesh) {
        scene.remove(connectionsMesh);
        connectionsMesh.geometry.dispose();
        connectionsMesh.material.dispose();
      }

      neuralNetwork = generateCrystallineSphere(config.densityFactor);
      if (!neuralNetwork || neuralNetwork.nodes.length === 0) return;

      const nodesGeometry = new THREE.BufferGeometry();
      const nodePositions = [];
      const nodeNormals = [];
      const nodeTypes = [];
      const nodeSizes = [];
      const nodeColors = [];
      const distancesFromRoot = [];
      const palette = colorPalettes[config.activePaletteIndex];

      neuralNetwork.nodes.forEach((node) => {
        nodePositions.push(node.position.x, node.position.y, node.position.z);
        const p = node.position;
        const len = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z) || 1;
        nodeNormals.push(p.x / len, p.y / len, p.z / len);
        nodeTypes.push(node.type);
        nodeSizes.push(node.size);
        distancesFromRoot.push(node.distanceFromRoot);
        const colorIndex = Math.min(node.level, palette.length - 1);
        const baseColor = palette[colorIndex % palette.length].clone();
        baseColor.offsetHSL(
          THREE.MathUtils.randFloatSpread(0.02),
          THREE.MathUtils.randFloatSpread(0.06),
          THREE.MathUtils.randFloatSpread(0.06)
        );
        nodeColors.push(baseColor.r, baseColor.g, baseColor.b);
      });

      nodesGeometry.setAttribute("position", new THREE.Float32BufferAttribute(nodePositions, 3));
      nodesGeometry.setAttribute("normal", new THREE.Float32BufferAttribute(nodeNormals, 3));
      nodesGeometry.setAttribute("nodeType", new THREE.Float32BufferAttribute(nodeTypes, 1));
      nodesGeometry.setAttribute("nodeSize", new THREE.Float32BufferAttribute(nodeSizes, 1));
      nodesGeometry.setAttribute("nodeColor", new THREE.Float32BufferAttribute(nodeColors, 3));
      nodesGeometry.setAttribute("distanceFromRoot", new THREE.Float32BufferAttribute(distancesFromRoot, 1));

      const nodesMaterial = new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.clone(pulseUniforms),
        vertexShader: nodeShader.vertexShader,
        fragmentShader: nodeShader.fragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      nodesMesh = new THREE.Points(nodesGeometry, nodesMaterial);
      scene.add(nodesMesh);

      const connectionsGeometry = new THREE.BufferGeometry();
      const connectionColors = [];
      const connectionStrengths = [];
      const connectionPositions = [];
      const startPoints = [];
      const endPoints = [];
      const pathIndices = [];
      const processedConnections = new Set();
      let pathIndex = 0;

      neuralNetwork.nodes.forEach((node, nodeIndex) => {
        node.connections.forEach((connection) => {
          const connectedNode = connection.node;
          const connectedIndex = neuralNetwork.nodes.indexOf(connectedNode);
          if (connectedIndex === -1) return;
          const key = [Math.min(nodeIndex, connectedIndex), Math.max(nodeIndex, connectedIndex)].join("-");
          if (processedConnections.has(key)) return;
          processedConnections.add(key);

          const startPoint = node.position;
          const endPoint = connectedNode.position;
          const numSegments = 18;
          for (let i = 0; i < numSegments; i++) {
            const t = i / (numSegments - 1);
            connectionPositions.push(t, 0, 0);
            startPoints.push(startPoint.x, startPoint.y, startPoint.z);
            endPoints.push(endPoint.x, endPoint.y, endPoint.z);
            pathIndices.push(pathIndex);
            connectionStrengths.push(connection.strength);
            const avgLevel = Math.min(Math.floor((node.level + connectedNode.level) / 2), palette.length - 1);
            const baseColor = palette[avgLevel % palette.length].clone();
            baseColor.offsetHSL(
              THREE.MathUtils.randFloatSpread(0.02),
              THREE.MathUtils.randFloatSpread(0.06),
              THREE.MathUtils.randFloatSpread(0.06)
            );
            connectionColors.push(baseColor.r, baseColor.g, baseColor.b);
          }
          pathIndex++;
        });
      });

      connectionsGeometry.setAttribute("position", new THREE.Float32BufferAttribute(connectionPositions, 3));
      connectionsGeometry.setAttribute("startPoint", new THREE.Float32BufferAttribute(startPoints, 3));
      connectionsGeometry.setAttribute("endPoint", new THREE.Float32BufferAttribute(endPoints, 3));
      connectionsGeometry.setAttribute("connectionStrength", new THREE.Float32BufferAttribute(connectionStrengths, 1));
      connectionsGeometry.setAttribute("connectionColor", new THREE.Float32BufferAttribute(connectionColors, 3));
      connectionsGeometry.setAttribute("pathIndex", new THREE.Float32BufferAttribute(pathIndices, 1));

      const connectionsMaterial = new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.clone(pulseUniforms),
        vertexShader: connectionShader.vertexShader,
        fragmentShader: connectionShader.fragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      connectionsMesh = new THREE.Line(connectionsGeometry, connectionsMaterial);
      scene.add(connectionsMesh);

      palette.forEach((color, i) => {
        if (i < 3) {
          nodesMesh.material.uniforms.uPulseColors.value[i].copy(color);
          connectionsMesh.material.uniforms.uPulseColors.value[i].copy(color);
        }
      });
    }

    const clock = new THREE.Clock();

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const interactionPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const interactionPoint = new THREE.Vector3();
    let lastPulseIndex = 0;

    function triggerPulse(clientX, clientY) {
      const rect = canvasElement.getBoundingClientRect();
      if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return;

      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);

      interactionPlane.normal.copy(camera.position).normalize();
      interactionPlane.constant = -interactionPlane.normal.dot(camera.position) + camera.position.length() * 0.5;

      if (!raycaster.ray.intersectPlane(interactionPlane, interactionPoint)) return;

      const t = clock.getElapsedTime();
      if (!nodesMesh || !connectionsMesh) return;

      lastPulseIndex = (lastPulseIndex + 1) % 3;
      nodesMesh.material.uniforms.uPulsePositions.value[lastPulseIndex].copy(interactionPoint);
      nodesMesh.material.uniforms.uPulseTimes.value[lastPulseIndex] = t;
      connectionsMesh.material.uniforms.uPulsePositions.value[lastPulseIndex].copy(interactionPoint);
      connectionsMesh.material.uniforms.uPulseTimes.value[lastPulseIndex] = t;

      const palette = colorPalettes[config.activePaletteIndex];
      const randomColor = palette[Math.floor(Math.random() * palette.length)];
      nodesMesh.material.uniforms.uPulseColors.value[lastPulseIndex].copy(randomColor);
      connectionsMesh.material.uniforms.uPulseColors.value[lastPulseIndex].copy(randomColor);
    }

    renderer.domElement.addEventListener("click", (e) => {
      if (e.target.closest(".glass-panel, .nav")) return;
      triggerPulse(e.clientX, e.clientY);
    });

    renderer.domElement.addEventListener(
      "touchstart",
      (e) => {
        if (e.target.closest(".glass-panel, .nav")) return;
        e.preventDefault();
        if (e.touches.length > 0) triggerPulse(e.touches[0].clientX, e.touches[0].clientY);
      },
      { passive: false }
    );

    function updateTheme(paletteIndex) {
      config.activePaletteIndex = paletteIndex;
      if (!nodesMesh || !connectionsMesh || !neuralNetwork) return;

      const palette = colorPalettes[paletteIndex];

      const nodeColorsAttr = nodesMesh.geometry.attributes.nodeColor;
      for (let i = 0; i < nodeColorsAttr.count; i++) {
        const node = neuralNetwork.nodes[i];
        if (!node) continue;
        const colorIndex = Math.min(node.level, palette.length - 1);
        const baseColor = palette[colorIndex % palette.length].clone();
        baseColor.offsetHSL(
          THREE.MathUtils.randFloatSpread(0.02),
          THREE.MathUtils.randFloatSpread(0.06),
          THREE.MathUtils.randFloatSpread(0.06)
        );
        nodeColorsAttr.setXYZ(i, baseColor.r, baseColor.g, baseColor.b);
      }
      nodeColorsAttr.needsUpdate = true;

      const connectionColors = [];
      const processedConnections = new Set();
      neuralNetwork.nodes.forEach((node, nodeIndex) => {
        node.connections.forEach((connection) => {
          const connectedNode = connection.node;
          const connectedIndex = neuralNetwork.nodes.indexOf(connectedNode);
          if (connectedIndex === -1) return;
          const key = [Math.min(nodeIndex, connectedIndex), Math.max(nodeIndex, connectedIndex)].join("-");
          if (processedConnections.has(key)) return;
          processedConnections.add(key);

          const numSegments = 18;
          for (let i = 0; i < numSegments; i++) {
            const avgLevel = Math.min(Math.floor((node.level + connectedNode.level) / 2), palette.length - 1);
            const baseColor = palette[avgLevel % palette.length].clone();
            baseColor.offsetHSL(
              THREE.MathUtils.randFloatSpread(0.02),
              THREE.MathUtils.randFloatSpread(0.06),
              THREE.MathUtils.randFloatSpread(0.06)
            );
            connectionColors.push(baseColor.r, baseColor.g, baseColor.b);
          }
        });
      });

      connectionsMesh.geometry.setAttribute("connectionColor", new THREE.Float32BufferAttribute(connectionColors, 3));
      connectionsMesh.geometry.attributes.connectionColor.needsUpdate = true;

      document.querySelectorAll(".theme-button").forEach((b) => b.classList.remove("active"));
      const activeBtn = document.querySelector(`.theme-button[data-theme="${paletteIndex}"]`);
      if (activeBtn) activeBtn.classList.add("active");
    }

    document.querySelectorAll(".theme-button").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const idx = Number(btn.dataset.theme);
        if (Number.isFinite(idx)) updateTheme(idx);
      });
    });

    let inViewport = true;
    let pageVisible = !document.hidden;

    const visibilityObserver = new IntersectionObserver(
      (entries) => { inViewport = entries[0].isIntersecting; },
      { threshold: 0 }
    );
    visibilityObserver.observe(canvasWrapper);

    const onVisibilityChange = () => { pageVisible = !document.hidden; };
    document.addEventListener("visibilitychange", onVisibilityChange);

    /**
     * Draws a single frame at time `t`. `pinCameraZ` holds the camera at a
     * given distance while a tween is in flight, after controls.update() has
     * had its say.
     */
    function draw(t = 0, pinCameraZ = null) {
      if (nodesMesh) {
        nodesMesh.material.uniforms.uTime.value = t;
        nodesMesh.rotation.y = Math.sin(t * 0.04) * 0.05;
      }
      if (connectionsMesh) {
        connectionsMesh.material.uniforms.uTime.value = t;
        connectionsMesh.rotation.y = Math.sin(t * 0.04) * 0.05;
      }

      controls.update();
      if (pinCameraZ != null) camera.position.set(0, 2, pinCameraZ);

      if (composer) composer.render();
      else renderer.render(scene, camera);
    }

    /**
     * Adaptive resolution. Rather than guess what a device can handle, watch
     * the frames: if enough of them miss the budget, step the pixel ratio down
     * once. Machines that hold 60fps never lose any quality.
     */
    const FRAME_BUDGET_MS = 1000 / 50;
    const MIN_PIXEL_RATIO = 0.75;
    let slowFrames = 0;
    let lastFrameTime = 0;

    function considerQuality(now) {
      if (lastFrameTime) {
        const delta = now - lastFrameTime;
        // Ignore the huge deltas that follow a tab coming back into focus.
        if (delta < 500) slowFrames = delta > FRAME_BUDGET_MS ? slowFrames + 1 : 0;
      }
      lastFrameTime = now;

      if (slowFrames < 45 || pixelRatio <= MIN_PIXEL_RATIO) return;

      slowFrames = 0;
      pixelRatio = Math.max(MIN_PIXEL_RATIO, pixelRatio - 0.25);
      renderer.setPixelRatio(pixelRatio);
      onWindowResize();
    }

    function animate(now = 0) {
      requestAnimationFrame(animate);
      if (!inViewport || !pageVisible) return;

      considerQuality(now);

      const t = clock.getElapsedTime();

      if (tween) {
        if (tween.startTime == null) {
          tween.startTime = t;
          tween.from = {
            cameraZ: camera.position.z,
            orbitMin: controls.minDistance,
            orbitMax: controls.maxDistance,
            autoRotateSpeed: controls.autoRotateSpeed
          };
        }
        const elapsed = (t - tween.startTime) * 1000;
        const progress = Math.min(elapsed / tween.duration, 1);
        applyTween(progress);
        if (progress >= 1) {
          const cb = tween.onComplete;
          tween = null;
          if (cb) cb();
        }
      }

      draw(t, tween ? currentOpts.cameraZ : null);
    }

    function onWindowResize() {
      updateRendererSize();
      if (composer) composer.setSize(renderWidth, renderHeight);
      if (bloomPass) {
        bloomPass.resolution.set(renderWidth * BLOOM_SCALE, renderHeight * BLOOM_SCALE);
      }
      if (opts.reducedMotion) draw();
    }

    window.addEventListener("resize", onWindowResize);

  createNetworkVisualization();

  if (opts.reducedMotion) {
    // No render loop: one frame now, then only when the user moves the camera.
    controls.addEventListener("change", () => draw());
    draw();
  } else {
    animate();
  }

  return { animateTo };
}
