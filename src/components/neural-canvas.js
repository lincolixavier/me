/**
 * Neural network background canvas with lazy loading.
 * Loads Three.js only when the element enters the viewport.
 * Attributes: camera-z, orbit-min, orbit-max, auto-rotate-speed (numbers).
 * Exposes api.animateTo(targetOpts, durationMs?, onComplete?) when loaded.
 */
const DEFAULT_CAMERA_Z = 22;
const DEFAULT_ORBIT_MIN = 26;
const DEFAULT_ORBIT_MAX = 26;
const DEFAULT_AUTO_ROTATE_SPEED = 0.23;

const prefersReducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

class NeuralCanvas extends HTMLElement {
  static get observedAttributes() {
    return ["camera-z", "orbit-min", "orbit-max", "auto-rotate-speed", "bloom", "density"];
  }

  constructor() {
    super();
    this._api = null;
    this._observer = null;
    this._loaded = false;
  }

  get api() {
    return this._api;
  }

  connectedCallback() {
    this.style.display = "block";
    if (!this.querySelector(".canvas-wrapper")) {
      const wrapper = document.createElement("div");
      wrapper.className = "canvas-wrapper";
      wrapper.setAttribute("aria-hidden", "true");
      const canvas = document.createElement("canvas");
      canvas.id = "neural-network-canvas";
      wrapper.appendChild(canvas);
      this.appendChild(wrapper);
    }

    this._observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting || this._loaded) return;
        this._loaded = true;
        this._observer?.disconnect();
        this._observer = null;
        this._scheduleInit();
      },
      { rootMargin: "50px", threshold: 0 }
    );
    this._observer.observe(this);
  }

  /**
   * The canvas is decoration behind the text, so it must never compete with
   * the page for the main thread. Downloading and compiling Three, generating
   * the graph and compiling shaders all wait until the document has finished
   * loading and the browser reports itself idle.
   */
  _scheduleInit() {
    const start = () => {
      const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 200));
      idle(() => this._loadAndInit(), { timeout: 2000 });
    };

    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });
  }

  disconnectedCallback() {
    this._observer?.disconnect();
    this._observer = null;
  }

  _getOptions() {
    const num = (attr, def) => {
      const v = this.getAttribute(attr);
      if (v == null || v === "") return def;
      const n = Number(v);
      return Number.isFinite(n) ? n : def;
    };
    const bloomAttr = this.getAttribute("bloom");
    const bloom = bloomAttr == null ? true : bloomAttr !== "false";
    // On phones the network sits at 55% opacity behind the text. It is not
    // worth a full-density graph and a bloom pass there — the difference is
    // invisible and the cost is not.
    const isCompact = window.matchMedia("(max-width: 900px)").matches;

    return {
      cameraZ: num("camera-z", DEFAULT_CAMERA_Z),
      orbitMin: num("orbit-min", DEFAULT_ORBIT_MIN),
      orbitMax: num("orbit-max", DEFAULT_ORBIT_MAX),
      autoRotateSpeed: num("auto-rotate-speed", DEFAULT_AUTO_ROTATE_SPEED),
      bloom: bloom && !isCompact,
      density: num("density", 1) * (isCompact ? 0.4 : 1),
      maxPixelRatio: isCompact ? 1 : 1.5,
      reducedMotion: prefersReducedMotion(),
    };
  }

  async _loadAndInit() {
    try {
      const { initNeuralNetwork } = await import("../lib/neural-network.js");
      this._api = initNeuralNetwork(this._getOptions(), this);
    } catch (err) {
      console.error("[neural-canvas] Failed to load neural network:", err);
    }
  }
}

customElements.define("neural-canvas", NeuralCanvas);
