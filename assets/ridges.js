/* Glowing-ridges background, written from scratch for this page.
 *
 * Same visual language as the ridge shader used on the Pulse hero — layered
 * flowing ridges over a drifting colour field — but light instead of black:
 * the base is a pale pinkish white and the ridges sit on it as a soft pastel
 * wash. Plain WebGL, no framework, no build step.
 *
 * Usage:  <canvas class="ridges" data-ridges='{"colorA":"#42a8ff",...}'></canvas>
 */
(function () {
  var VS = [
    'attribute vec2 p;',
    'void main(){ gl_Position = vec4(p, 0.0, 1.0); }'
  ].join('\n');

  var FS = [
    'precision highp float;',
    'uniform vec2 uRes;',
    'uniform float uTime;',
    'uniform vec3 uColorA;',
    'uniform vec3 uColorB;',
    'uniform vec3 uColorC;',
    'uniform vec3 uBase;',
    'uniform float uZoom;',
    'uniform float uRot;',
    'uniform float uGain;',
    'uniform float uBoost;',
    'uniform float uDensity;',
    'uniform float uFlow;',
    'uniform float uSwirl;',
    'uniform float uGrain;',
    '',
    'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }',
    'float noise(vec2 p){',
    '  vec2 i = floor(p), f = fract(p);',
    '  vec2 u = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),',
    '             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);',
    '}',
    'float fbm(vec2 p){',
    '  float a = 0.5, s = 0.0;',
    '  for (int i = 0; i < 3; i++){ s += a * noise(p); p = p * 2.03 + vec2(13.1, 7.7); a *= 0.5; }',
    '  return s;',
    '}',
    '',
    'void main(){',
    '  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / min(uRes.x, uRes.y);',
    '  uv *= uZoom;',
    '  float c = cos(uRot), s = sin(uRot);',
    '  uv = mat2(c, -s, s, c) * uv;',
    '',
    '  float t = uTime * uFlow;',
    '  vec2 warp = vec2(fbm(uv * 1.3 + vec2(t, -t * 0.7)),',
    '                   fbm(uv * 1.3 + vec2(-t * 0.6, t * 0.9) + 5.2));',
    '  uv += (warp - 0.5) * (uSwirl * 0.02);',
    '',
    '  float ridges = 0.0;',
    '  float total = 0.0;',
    '  for (int i = 0; i < 6; i++){',
    '    float fi = float(i);',
    '    vec2 q = uv * vec2(1.75, 0.9) * (1.0 + fi * 0.16) + vec2(0.0, fi * 0.34 + t * (0.35 + fi * 0.05));',
    '    float n = fbm(q * uDensity * 0.5 + warp * 1.35);',
    '    float ridge = 1.0 - abs(2.0 * n - 1.0);',
    '    ridge = pow(clamp(ridge, 0.0, 1.0), 4.6);',
    '    float w = 1.0 / (1.0 + fi * 0.42);',
    '    ridges += ridge * w;',
    '    total += w;',
    '  }',
    '  ridges /= total;',
    '',
    '  vec3 col = mix(uColorA, uColorB, clamp(0.5 + 0.5 * sin(uv.x * 1.1 + t * 0.5), 0.0, 1.0));',
    '  col = mix(col, uColorC, clamp(0.5 + 0.5 * sin(uv.y * 0.9 - t * 0.35 + 1.7), 0.0, 1.0));',
    '',
    '  float amt = clamp(ridges * uBoost * uGain, 0.0, 0.9);',
    '  vec3 accent = mix(uBase, col, 0.45);',
    '  vec3 outc = mix(uBase, accent, amt);',
    '',
    '  float g = hash(gl_FragCoord.xy + fract(uTime) * 91.7);',
    '  outc += (g - 0.5) * uGrain * 0.05;',
    '',
    '  gl_FragColor = vec4(clamp(outc, 0.0, 1.0), 1.0);',
    '}'
  ].join('\n');

  function hexToRgb(hex) {
    var h = (hex || '#000').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }

  function compile(gl, type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.warn('ridges shader:', gl.getShaderInfoLog(sh));
      return null;
    }
    return sh;
  }

  function init(canvas) {
    var opts = {};
    try { opts = JSON.parse(canvas.getAttribute('data-ridges') || '{}'); } catch (e) {}
    var gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' })
          || canvas.getContext('experimental-webgl');
    if (!gl) { canvas.style.display = 'none'; canvas.dataset.ridgesState = 'no-webgl'; return; }
    canvas.addEventListener('webglcontextlost', function (e) {
      e.preventDefault();
      canvas.dataset.ridgesState = 'context-lost';
      canvas.style.display = 'none';
    }, false);

    var vs = compile(gl, gl.VERTEX_SHADER, VS);
    var fs = compile(gl, gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs) { canvas.style.display = 'none'; canvas.dataset.ridgesState = 'shader-error'; return; }
    var prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      canvas.style.display = 'none';
      canvas.dataset.ridgesState = 'link-error';
      return;
    }
    gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    var u = {
      res: gl.getUniformLocation(prog, 'uRes'),
      time: gl.getUniformLocation(prog, 'uTime'),
      a: gl.getUniformLocation(prog, 'uColorA'),
      b: gl.getUniformLocation(prog, 'uColorB'),
      c: gl.getUniformLocation(prog, 'uColorC'),
      base: gl.getUniformLocation(prog, 'uBase'),
      zoom: gl.getUniformLocation(prog, 'uZoom'),
      rot: gl.getUniformLocation(prog, 'uRot'),
      gain: gl.getUniformLocation(prog, 'uGain'),
      boost: gl.getUniformLocation(prog, 'uBoost'),
      density: gl.getUniformLocation(prog, 'uDensity'),
      flow: gl.getUniformLocation(prog, 'uFlow'),
      swirl: gl.getUniformLocation(prog, 'uSwirl'),
      grain: gl.getUniformLocation(prog, 'uGrain')
    };

    gl.uniform3fv(u.a, hexToRgb(opts.colorA || '#42a8ff'));
    gl.uniform3fv(u.b, hexToRgb(opts.colorB || '#22d3ee'));
    gl.uniform3fv(u.c, hexToRgb(opts.colorC || '#ffb8d0'));
    gl.uniform3fv(u.base, hexToRgb(opts.base || '#f8f1ef'));
    gl.uniform1f(u.zoom, opts.zoom == null ? 1.6 : opts.zoom);
    gl.uniform1f(u.rot, (opts.rotation == null ? -28 : opts.rotation) * Math.PI / 180);
    gl.uniform1f(u.gain, opts.gain == null ? 0.30 : opts.gain);
    gl.uniform1f(u.boost, opts.boost == null ? 2.2 : opts.boost);
    gl.uniform1f(u.density, opts.density == null ? 6 : opts.density);
    gl.uniform1f(u.flow, opts.flowSpeed == null ? 0.1 : opts.flowSpeed);
    gl.uniform1f(u.swirl, opts.swirl == null ? 12 : opts.swirl);
    gl.uniform1f(u.grain, opts.grain == null ? 0.22 : opts.grain);

    var dpr = Math.min(window.devicePixelRatio || 1, 1) * 0.75;
    function resize() {
      var r = canvas.getBoundingClientRect();
      var w = Math.max(1, Math.round(r.width * dpr));
      var h = Math.max(1, Math.round(r.height * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
        gl.uniform2f(u.res, w, h);
      }
    }
    resize();
    window.addEventListener('resize', resize, { passive: true });

    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var running = true;
    var start = performance.now();

    function frame(now) {
      if (!running) return;
      resize();
      gl.uniform1f(u.time, reduced ? 12 : (now - start) / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!canvas.dataset.ridgesState) {
        var err = gl.getError();
        canvas.dataset.ridgesState = err === gl.NO_ERROR ? 'running' : ('gl-error-' + err);
      }
      if (!reduced) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { running = false; }
      else if (!reduced) { running = true; requestAnimationFrame(frame); }
    });
  }

  function boot() {
    var nodes = document.querySelectorAll('canvas[data-ridges]');
    for (var i = 0; i < nodes.length; i++) init(nodes[i]);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
