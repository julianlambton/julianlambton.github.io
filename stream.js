/* ============================================================
   V5 PORTFOLIO — STREAM.JS  (WebGL1, no libraries)
   A glowing bundle of hair-thin filaments pinching to a hot
   point on the left, fanning right, blurring as you scroll.
   ============================================================ */

'use strict';

/* ── CONFIG (easy to tune) ──────────────────────────────── */
const CONFIG = {
  filaments:   { desktop: 40, mobile: 16 },
  renderScale: { desktop: 0.55, mobile: 0.5 },
  coreWidth:   0.0012,
  glowWidth:   0.02,
  blurMul:     4.0,
  sizeMul:     2.0,
  dim:         0.5,
  exposure:    0.95,
  dust:        0.015,
};

/* ── GLSL source ─────────────────────────────────────────── */
const VERT_SRC = `
attribute vec2 aPos;
void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG_SRC = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
  precision highp float;
#else
  precision mediump float;
#endif

uniform vec2  uRes;
uniform float uTime;
uniform float uScroll;   /* 0-1 smoothed */
uniform int   uCount;

uniform float uCoreWidth;
uniform float uGlowWidth;
uniform float uBlurMul;
uniform float uSizeMul;
uniform float uDim;
uniform float uExposure;
uniform float uDust;

const int MAX_FIL = 48;

/* ---------- helpers ---------- */
float hash11(float n){ return fract(sin(n) * 43758.5453); }
float hash21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float smstep(float e0, float e1, float x){
  float t = clamp((x - e0) / (e1 - e0), 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

/* ---------- main ---------- */
void main(){
  float aspect = uRes.x / uRes.y;

  float focus  = smstep(0.05, 0.35, uScroll);
  float zoom   = 1.0 + focus * (uSizeMul - 1.0);
  vec2  p      = (gl_FragCoord.xy / uRes.y - vec2(0.5 * aspect, 0.5)) / zoom;

  float uFade  = 1.0 - smstep(0.82, 0.97, uScroll);
  float ph     = uTime * 0.12 + uScroll * 6.0;

  /* centerline */
  float cx = p.x;
  float cy = 0.22 * sin(cx * 1.6 + ph) + 0.06 * sin(cx * 3.1 + ph * 1.7);

  /* pinch point slides left and off-screen as scroll increases */
  float px_ = mix(-0.30 * aspect, -2.2 * aspect, uScroll);

  /* fan width increases from pinch point rightward */
  float w  = 0.01 + 0.30 * smstep(0.0, 1.2, cx - px_);

  float s1 = uCoreWidth * (1.0 + focus * (uBlurMul - 1.0));
  float s2 = uGlowWidth * (1.0 + focus * (uBlurMul - 1.0));

  vec3 col = vec3(0.0);

  for (int i = 0; i < MAX_FIL; i++) {
    if (i >= uCount) break;
    float fi = float(i);
    float t  = fi / (float(uCount) - 1.0) * 1.6596 - 1.0;  /* same spread for any filament count */

    float wiggle = 0.015 * sin(cx * (2.0 + fi * 0.31) + fi * 1.9 + uTime * 0.2)
                 * smstep(0.0, 1.0, cx - px_);
    float offset = t * w + wiggle;

    float dy = p.y - (cy + offset);
    float d  = abs(dy);

    float intensity = exp(-d * d / (2.0 * s1 * s1))
                    + 0.25 * exp(-d * d / (2.0 * s2 * s2));

    /* tail attenuation before the pinch point */
    if (cx < px_) intensity *= exp((cx - px_) * 3.0);

    /* color by radial position |t| */
    float at = abs(t);
    vec3 lineCol;
    if (at < 0.3) {
      lineCol = mix(vec3(0.72, 0.96, 0.24), vec3(0.35, 0.85, 0.45), at / 0.3);
    } else if (at < 0.65) {
      lineCol = mix(vec3(0.35, 0.85, 0.45), vec3(0.15, 0.75, 0.75), (at - 0.3) / 0.35);
    } else {
      lineCol = mix(vec3(0.15, 0.75, 0.75),
                    vec3(0.15, 0.75, 0.75) + vec3(0.2, 0.45, 1.0) * smstep(0.8, 1.0, at),
                    (at - 0.65) / 0.35);
    }

    col += lineCol * intensity;
  }

  /* tone-map */
  col = 1.0 - exp(-col * uExposure);

  /* dim as scroll increases */
  col *= mix(1.0, uDim, focus);

  /* hot spot at pinch point */
  vec2 hotP = vec2(px_, cy);
  col += vec3(0.9, 1.0, 0.6) * exp(-length(p - hotP) * 14.0) * (1.0 - focus);

  /* dust / twinkling specks */
  vec2 cell  = floor(p * 180.0);
  float h    = hash21(cell);
  if (h < uDust) {
    float twinkle = 0.5 + 0.5 * sin(uTime * 1.3 + h * 40.0);
    col += vec3(0.6, 0.85, 0.4) * twinkle * 0.18;
  }

  /* vignette */
  vec2 uv   = gl_FragCoord.xy / uRes;
  float vig = smstep(0.0, 0.55, 1.0 - length((uv - 0.5) * vec2(1.0, 1.4)));
  col      *= vig;

  /* base colour + fade at contact section */
  col = mix(vec3(0.02, 0.031, 0.02), col, uFade);

  gl_FragColor = vec4(col, 1.0);
}
`;

/* ── bootstrap ───────────────────────────────────────────── */
(function initGLStream() {
  /* Insert canvas as very first child of body */
  const canvas = document.createElement('canvas');
  canvas.id = 'stream-gl';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText =
    'position:fixed;inset:0;z-index:-1;pointer-events:none;display:block;' +
    'width:100%;height:100%;';
  document.body.insertBefore(canvas, document.body.firstChild);

  /* Try WebGL */
  let gl = null;
  try {
    gl = canvas.getContext('webgl', {
      antialias: false, alpha: false, powerPreference: 'low-power'
    }) || canvas.getContext('experimental-webgl', {
      antialias: false, alpha: false, powerPreference: 'low-power'
    });
  } catch (e) { gl = null; }

  if (!gl) {
    console.error('[stream] WebGL unavailable, keeping 2D canvas fallback.');
    canvas.remove();
    return;
  }

  /* Compile shaders */
  function compile(type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(sh);
      console.error('[stream] failed:', log);
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  const vs = compile(gl.VERTEX_SHADER,   VERT_SRC);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG_SRC);
  if (!vs || !fs) { canvas.remove(); return; }

  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(prog);
    console.error('[stream] failed:', log);
    canvas.remove();
    return;
  }
  gl.useProgram(prog);

  /* Fullscreen triangle */
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER,
    new Float32Array([-1, -1,  3, -1,  -1,  3]),
    gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  /* Uniforms */
  const uRes      = gl.getUniformLocation(prog, 'uRes');
  const uTime     = gl.getUniformLocation(prog, 'uTime');
  const uScroll   = gl.getUniformLocation(prog, 'uScroll');
  const uCount    = gl.getUniformLocation(prog, 'uCount');
  const uCoreW    = gl.getUniformLocation(prog, 'uCoreWidth');
  const uGlowW    = gl.getUniformLocation(prog, 'uGlowWidth');
  const uBlurM    = gl.getUniformLocation(prog, 'uBlurMul');
  const uSizeM    = gl.getUniformLocation(prog, 'uSizeMul');
  const uDimU     = gl.getUniformLocation(prog, 'uDim');
  const uExpU     = gl.getUniformLocation(prog, 'uExposure');
  const uDustU    = gl.getUniformLocation(prog, 'uDust');

  /* Upload static config uniforms */
  gl.uniform1f(uCoreW, CONFIG.coreWidth);
  gl.uniform1f(uGlowW, CONFIG.glowWidth);
  gl.uniform1f(uBlurM, CONFIG.blurMul);
  gl.uniform1f(uSizeM, CONFIG.sizeMul);
  gl.uniform1f(uDimU,  CONFIG.dim);
  gl.uniform1f(uExpU,  CONFIG.exposure);
  gl.uniform1f(uDustU, CONFIG.dust);

  /* Context lost recovery */
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    console.error('[stream] context lost');
  });
  canvas.addEventListener('webglcontextrestored', () => {
    gl.useProgram(prog);
  });

  /* Resize */
  const MOBILE = () => window.innerWidth <= 700;
  let W = 0, H = 0;
  function resize() {
    const scale = MOBILE() ? CONFIG.renderScale.mobile : CONFIG.renderScale.desktop;
    W = Math.round(window.innerWidth  * scale);
    H = Math.round(window.innerHeight * scale);
    canvas.width  = W;
    canvas.height = H;
    gl.viewport(0, 0, W, H);
    gl.uniform2f(uRes, W, H);
    gl.uniform1i(uCount, MOBILE() ? CONFIG.filaments.mobile : CONFIG.filaments.desktop);
  }
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 150);
  });
  resize();

  /* Scroll smoothing */
  let scrollRaw = 0, scrollSmooth = 0;
  window.addEventListener('scroll', () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    scrollRaw = max > 0 ? window.scrollY / max : 0;
  }, { passive: true });

  /* Reduced motion: single static frame */
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function render(ts) {
    if (document.hidden) { requestAnimationFrame(render); return; }
    scrollSmooth += (scrollRaw - scrollSmooth) * 0.06;
    gl.uniform1f(uTime,   ts * 0.001);
    gl.uniform1f(uScroll, scrollSmooth);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (!reduced) requestAnimationFrame(render);
  }

  if (reduced) {
    gl.uniform1f(uTime, 0.0);
    gl.uniform1f(uScroll, 0.0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  } else {
    requestAnimationFrame(render);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) requestAnimationFrame(render);
    });
  }

  window.__glStream = true;
  console.info('[stream] WebGL ok');
})();
