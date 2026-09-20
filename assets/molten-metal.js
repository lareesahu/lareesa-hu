/* Minimal WebGL harness for fullscreen-shader backgrounds.
 *
 * Written for these static comparison pages: no framework, no external
 * library, no CDN. The shader pair and the uniform values come from the
 * open-source React Bits background the page names in its own header.
 *
 * Loaded as a classic script so the pages also work straight off the disk
 * (file://), which ES modules do not.
 */
window.createBackground = function (canvas, opts) {
  /* GLSL ES 3.00 shaders need a WebGL2 context; the older components ship
     GLSL ES 1.00 shaders, which only compile on a WebGL1 context. */
  const es3 = /#version\s+300\s+es/.test(opts.frag) || /#version\s+300\s+es/.test(opts.vert);
  const ctxOpts = {
    antialias: false,
    alpha: true,
    premultipliedAlpha: false,
    powerPreference: 'low-power'
  };
  const gl = (es3 ? canvas.getContext('webgl2', ctxOpts) : null) || canvas.getContext('webgl', ctxOpts)
          || canvas.getContext('experimental-webgl', ctxOpts);
  if (!gl) {
    canvas.dataset.bgState = 'no-webgl';
    canvas.style.display = 'none';
    return null;
  }
  /* these components draw into a transparent canvas over the page */
  gl.clearColor(0, 0, 0, 0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      canvas.dataset.bgState = 'shader-error';
      canvas.style.display = 'none';
      return null;
    }
    return s;
  }

  const vs = compile(gl.VERTEX_SHADER, opts.vert);
  const fs = compile(gl.FRAGMENT_SHADER, opts.frag);
  if (!vs || !fs) return null;

  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.bindAttribLocation(prog, 0, 'position');
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    canvas.dataset.bgState = 'link-error';
    canvas.style.display = 'none';
    return null;
  }
  gl.useProgram(prog);
  if (es3 && gl.bindFragDataLocation) gl.bindFragDataLocation(prog, 0, 'fragColor');

  /* fullscreen triangle */
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  /* some components (three.js-style) sample a `uv` varying; give it 0..1 over the canvas */
  gl.bindAttribLocation(prog, 1, 'uv');
  const uvBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 2, 0, 0, 2]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);

  /* uniform discovery: name -> {loc, kind, size} */
  const uniforms = {};
  const re = /uniform\s+(?:lowp\s+|mediump\s+|highp\s+)?(float|int|bool|vec2|vec3|vec4)\s+([A-Za-z_]\w*)\s*(?:\[\s*(\d+)\s*\])?\s*;/g;
  let m;
  while ((m = re.exec(opts.frag)) !== null) {
    const kind = m[1];
    const name = m[2];
    const size = m[3] ? parseInt(m[3], 10) : 0;
    uniforms[name] = { loc: gl.getUniformLocation(prog, name), kind, size };
  }

  const mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
  if (opts.mouse !== false) {
    canvas.parentElement.addEventListener('pointermove', function (e) {
      const r = canvas.getBoundingClientRect();
      mouse.tx = (e.clientX - r.left) / r.width;
      mouse.ty = 1 - (e.clientY - r.top) / r.height;
    }, { passive: true });
  }

  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dpr = Math.min(window.devicePixelRatio || 1, 1) * (opts.scale || 0.75);

  function resize() {
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width * dpr));
    const h = Math.max(1, Math.round(r.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
    return { w: w, h: h, aspect: w / h };
  }

  function set(name, value, dims, t) {
    const u = uniforms[name];
    if (!u || u.loc === null) return;
    if (u.kind === 'float') {
      gl.uniform1f(u.loc, typeof value === 'function' ? value(t) : value);
      return;
    }
    if (u.kind === 'int' || u.kind === 'bool') {
      gl.uniform1i(u.loc, value ? 1 : 0);
      return;
    }
    const vals = typeof value === 'function' ? value(dims, t) : value;
    const arr = Array.isArray(vals) ? vals : [vals, vals, vals, vals];
    if (u.size) { gl.uniform3fv(u.loc, new Float32Array(arr)); return; }
    if (u.kind === 'vec2') gl.uniform2f(u.loc, arr[0], arr[1]);
    else if (u.kind === 'vec3') gl.uniform3f(u.loc, arr[0], arr[1], arr[2]);
    else gl.uniform4f(u.loc, arr[0], arr[1], arr[2], arr[3]);
  }

  const values = opts.uniforms || {};
  const start = performance.now();
  /* visible for debugging: what was discovered, and what is being fed to it */
  canvas.bgDebug = { uniforms: uniforms, values: values };

  function frame(now) {
    try {
      const dims = resize();
      const t = reduced ? 8 : (now - start) / 1000;
      for (const name in uniforms) {
        if (name === 'uTime' || name === 'iTime') { set(name, t, dims, t); continue; }
        if (name === 'uResolution') { set(name, [dims.w, dims.h, dims.aspect], dims, t); continue; }
        if (name === 'iResolution') { set(name, [dims.w, dims.h, dims.aspect], dims, t); continue; }
        /* only the mouse POSITION uniforms are vec2; float uniforms whose name merely
           contains "mouse" (uMouseStrength, uEnableMouse) must keep their own value,
           otherwise they get handed a vector and the whole field turns to NaN. */
        if ((name === 'uMouse' || name === 'iMouse') && uniforms[name].kind === 'vec2') {
          mouse.x += (mouse.tx - mouse.x) * 0.08;
          mouse.y += (mouse.ty - mouse.y) * 0.08;
          /* most of these components store y in top-down uv space */
          set(name, [mouse.x, 1 - mouse.y], dims, t);
          continue;
        }
        if (name in values) { set(name, values[name], dims, t); continue; }
        if (uniforms[name].kind === 'vec2') set(name, [0.5, 0.5], dims, t);
        else if (uniforms[name].kind === 'float') set(name, 0, dims, t);
        else if (uniforms[name].kind === 'int' || uniforms[name].kind === 'bool') set(name, 0, dims, t);
        else set(name, [0.5, 0.5, 0.5, 0.5], dims, t);
      }
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!canvas.dataset.bgState || canvas.dataset.bgState === 'booting') {
        const err = gl.getError();
        canvas.dataset.bgState = err === gl.NO_ERROR ? 'running' : ('gl-error-' + err);
      }
    } catch (e) {
      canvas.dataset.bgState = 'error: ' + (e && e.message ? e.message : e);
      return;
    }
    if (!reduced) requestAnimationFrame(frame);
  }

  canvas.dataset.bgState = 'booting';
  requestAnimationFrame(frame);
  return gl;
}

/* Full-page background: React Bits MoltenMetal (free library, MIT + Commons Clause) —
   shader pair and uniform names taken from the free component source. */
var VERT = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}`;
var FRAG = `#version 300 es
precision highp float;
uniform vec2 iResolution;
uniform float iTime;
uniform float uSpeed;
uniform float uScale;
uniform float uDetail;
uniform float uGlow;
uniform float uCoreSize;
uniform float uSwirl;
uniform float uFold;
uniform float uBlackPoint;
uniform float uBrightness;
uniform float uColorMode;
uniform float uGrain;
uniform float uGrainIntensity;
uniform float uOpacity;
uniform vec2 uMouse;
uniform float uMouseStrength;
uniform bool uEnableMouse;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec3 uBackgroundColor;
uniform bool uLightMode;
out vec4 fragColor;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  float time = iTime * uSpeed;
  vec2 p = uScale * ((gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y) - 0.5;

  vec2 drift = vec2(0.0);
  if (uEnableMouse) {
    drift = (uMouse - 0.5) * uMouseStrength * 2.0;
  }
  p += drift;

  vec2 i = p;
  float c = 0.0;
  float r = length(p + vec2(sin(time), sin(time * 0.3 + 5.0)) * 0.5);
  float d = length(p);
  float rot = d + time + p.x * uSwirl;

  float cosRot = cos(rot);
  mat2 warp = mat2(cos(rot - sin(time / 5.0)), sin(rot), -sin(cosRot - time), cosRot) * uFold;
  float glowCore = uGlow * uCoreSize;

  for (float n = 0.0; n < 8.0; n++) {
    if (n >= uDetail) break;
    p *= warp;
    float t = r - time / (n + 3.0);
    i -= p + vec2(cos(t - i.x - r) + sin(t + i.y), sin(t - i.y) + cos(t + i.x) + r);
    c += glowCore / length(vec2(sin(i.x + t), cos(i.y + t)));
  }

  c /= 6.0;

  float intensity = max(c - uBlackPoint, 0.0) * uBrightness;

  float g = clamp(intensity, 0.0, 1.0);

  float mid = 0.5;
  if (uColorMode > 1.5) {
    mid = 0.65;
  } else if (uColorMode > 0.5) {
    mid = 0.35;
  }

  vec3 col = mix(uColor1, uColor2, smoothstep(0.0, mid, g));
  col = mix(col, uColor3, smoothstep(mid, 1.0, g));

  float a = g;
  if (uGrain > 0.5) {
    float gr = hash(gl_FragCoord.xy + iTime);
    a += (gr - 0.5) * uGrainIntensity;
  }
  a = clamp(a, 0.0, 1.0) * uOpacity;
  if (uLightMode) {
    float signal = 1.0 - exp(-max(c, 0.0) * 6.5);
    float body = smoothstep(0.075, 0.68, signal);
    float ridge = smoothstep(0.42, 0.92, signal);

    vec3 lightCol = mix(uColor1, uColor2, smoothstep(0.08, 0.52, signal));
    lightCol = mix(lightCol, uColor3, smoothstep(0.52, 0.96, signal));
    lightCol = mix(lightCol, lightCol * 0.72, ridge * 0.24);

    float coverage = body * mix(0.2, 0.86, signal) * uOpacity;
    if (uGrain > 0.5) {
      float gr = hash(gl_FragCoord.xy + iTime);
      coverage += (gr - 0.5) * uGrainIntensity * body * 0.16;
    }
    fragColor = vec4(mix(uBackgroundColor, lightCol, clamp(coverage, 0.0, 0.92)), 1.0);
  } else {
    fragColor = vec4(col * a, a);
  }
}`;
createBackground(document.getElementById('bg'), {
  vert: VERT,
  frag: FRAG,
  uniforms: {
      iTime: 0.0,
      iResolution: [1.0, 1.0],
      uSpeed: 0.26,
      uScale: 3.0,
      uDetail: 3.0,
      uGlow: 1.5,
      uCoreSize: 0.14,
      uSwirl: 1.1,
      uFold: -0.2,
      uBlackPoint: 0.0,
      uBrightness: 1.5,
      uColorMode: 0.0,
      uGrain: 1.0,
      uGrainIntensity: 0.03,
      uOpacity: 0.72,
      uMouse: [0.5, 0.5],
      uMouseStrength: 0.25,
      uColor1: [0.8431, 0.6039, 0.7137],
      uColor2: [0.5765, 0.702, 0.8706],
      uColor3: [1.0, 1.0, 1.0],
      uBackgroundColor: [0.9725, 0.9451, 0.9373],
      uLightMode: 1
  },
  scale: 0.75
});
