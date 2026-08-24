import { useEffect, useRef, useState } from "react";
import {
  normalizeVisualPilotProps,
  shouldUseStaticVisual,
  type VisualPilotProps,
} from "./visualPilotPolicy";

const VERTEX_SHADER = `
attribute vec2 aPosition;
void main(){gl_Position=vec4(aPosition,0.0,1.0);}
`;

const FRAGMENT_SHADER = `
precision mediump float;
uniform vec2 uResolution;
uniform float uTime;
uniform float uDensity;
uniform float uIntensity;
void main(){
  vec2 uv=gl_FragCoord.xy/max(uResolution.xy,vec2(1.0));
  vec2 centered=(uv-0.5)*vec2(uResolution.x/uResolution.y,1.0);
  vec2 cell=fract(centered*uDensity)-0.5;
  float dotShape=smoothstep(0.105,0.018,length(cell));
  float wave=0.55+0.45*sin((centered.x*3.2-centered.y*2.1)+uTime*6.28318);
  float halo=exp(-2.4*length(centered));
  vec3 violet=vec3(0.45,0.22,0.98);
  vec3 cyan=vec3(0.12,0.78,0.95);
  vec3 color=mix(violet,cyan,clamp(uv.x+wave*0.18,0.0,1.0));
  float alpha=dotShape*(0.12+wave*0.34+halo*0.5)*uIntensity;
  gl_FragColor=vec4(color*alpha,alpha);
}
`;

type RuntimeState = "static" | "starting" | "running" | "failed";

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("VISUAL_SHADER_UNAVAILABLE");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    throw new Error("VISUAL_SHADER_COMPILE_FAILED");
  }
  return shader;
}

function StaticDotFallback({ state }: { state: RuntimeState }) {
  return <div className="absolute inset-0 overflow-hidden bg-[#070512]" data-visual-fallback={state} aria-hidden="true">
    <div className="absolute inset-0 opacity-80 [background-image:radial-gradient(circle_at_center,rgba(139,92,246,.5)_0_1px,transparent_1.6px)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_72%)]" />
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(34,211,238,.14),transparent_34%),radial-gradient(circle_at_72%_68%,rgba(124,58,237,.2),transparent_42%)]" />
  </div>;
}

export default function LoadderDotMatrixPilot(props: VisualPilotProps) {
  const options = normalizeVisualPilotProps(props);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const [environment, setEnvironment] = useState({ reducedMotion: true, mobile: true, lowPower: true, measured: false });
  const [state, setState] = useState<RuntimeState>("static");

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mobile = window.matchMedia("(max-width: 767px)");
    const update = () => setEnvironment({
      reducedMotion: motion.matches,
      mobile: mobile.matches,
      lowPower: typeof navigator.hardwareConcurrency === "number" && navigator.hardwareConcurrency <= 4,
      measured: true,
    });
    update();
    motion.addEventListener("change", update);
    mobile.addEventListener("change", update);
    return () => {
      motion.removeEventListener("change", update);
      mobile.removeEventListener("change", update);
    };
  }, []);

  const staticMode = !environment.measured || shouldUseStaticVisual({ ...environment, motionEnabled: options.motionEnabled, qualityTier: options.qualityTier });

  useEffect(() => {
    if (staticMode) {
      return undefined;
    }
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return undefined;
    setState("starting");
    let gl: WebGLRenderingContext | null = null;
    let program: WebGLProgram | null = null;
    let buffer: WebGLBuffer | null = null;
    let vertex: WebGLShader | null = null;
    let fragment: WebGLShader | null = null;
    let frame = 0;
    let visible = true;
    let disposed = false;
    let startedAt = performance.now();
    let intersection: IntersectionObserver | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let removeListeners = () => undefined;

    const stop = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    };
    const fail = () => {
      stop();
      if (!disposed) setState("failed");
    };
    const teardown = () => {
      if (disposed) return;
      disposed = true;
      stop();
      resizeObserver?.disconnect();
      intersection?.disconnect();
      removeListeners();
      if (gl) {
        if (buffer) gl.deleteBuffer(buffer);
        if (program) gl.deleteProgram(program);
        if (vertex) gl.deleteShader(vertex);
        if (fragment) gl.deleteShader(fragment);
        if (!gl.isContextLost()) gl.getExtension("WEBGL_lose_context")?.loseContext();
      }
    };
    try {
      gl = canvas.getContext("webgl", { alpha: true, antialias: false, depth: false, powerPreference: "low-power" });
      if (!gl) throw new Error("VISUAL_WEBGL_UNAVAILABLE");
      vertex = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
      fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
      program = gl.createProgram();
      buffer = gl.createBuffer();
      if (!program || !buffer) throw new Error("VISUAL_RUNTIME_UNAVAILABLE");
      gl.attachShader(program, vertex);
      gl.attachShader(program, fragment);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error("VISUAL_PROGRAM_LINK_FAILED");
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const position = gl.getAttribLocation(program, "aPosition");
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      const resolution = gl.getUniformLocation(program, "uResolution");
      const time = gl.getUniformLocation(program, "uTime");
      const density = gl.getUniformLocation(program, "uDensity");
      const intensity = gl.getUniformLocation(program, "uIntensity");
      gl.uniform1f(density, options.density);
      gl.uniform1f(intensity, options.intensity);
      gl.deleteShader(vertex); vertex = null;
      gl.deleteShader(fragment); fragment = null;

      const resize = () => {
        if (!gl || disposed) return;
        const bounds = host.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        const width = Math.max(1, Math.round(bounds.width * dpr));
        const height = Math.max(1, Math.round(bounds.height * dpr));
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
          gl.viewport(0, 0, width, height);
          gl.uniform2f(resolution, width, height);
        }
      };
      const render = (now: number) => {
        frame = 0;
        if (!gl || disposed || !visible || document.hidden) return;
        gl.uniform1f(time, ((now - startedAt) / 1000) * options.speed);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        frame = requestAnimationFrame(render);
      };
      const start = () => {
        if (!disposed && visible && !document.hidden && !frame) frame = requestAnimationFrame(render);
      };
      const onVisibility = () => document.hidden ? stop() : start();
      const onContextLost = (event: Event) => {
        event.preventDefault();
        fail();
        teardown();
      };
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(host);
      if (typeof IntersectionObserver !== "undefined") {
        intersection = new IntersectionObserver(([entry]) => {
          visible = entry?.isIntersecting ?? true;
          if (visible) start(); else stop();
        }, { rootMargin: "80px" });
        intersection.observe(host);
      }
      document.addEventListener("visibilitychange", onVisibility);
      canvas.addEventListener("webglcontextlost", onContextLost);
      removeListeners = () => {
        document.removeEventListener("visibilitychange", onVisibility);
        canvas.removeEventListener("webglcontextlost", onContextLost);
      };
      resize();
      startedAt = performance.now();
      queueMicrotask(() => { if (!disposed) setState("running"); });
      start();
      return teardown;
    } catch {
      fail();
      teardown();
      return teardown;
    }
  }, [options.density, options.intensity, options.qualityTier, options.speed, staticMode]);

  return <div ref={hostRef} className="absolute inset-0 overflow-hidden" data-visual-runtime={staticMode ? "static" : state} aria-hidden="true">
    {staticMode || state === "failed" ? <StaticDotFallback state={staticMode ? "static" : state} /> : <canvas ref={canvasRef} className="absolute inset-0 h-full w-full pointer-events-none" aria-hidden="true" />}
  </div>;
}
