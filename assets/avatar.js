/* A small 3D portrait of Lareesa, drawn with three.js (self-hosted, MIT).
 *
 * Hero: she stands inside the portrait panel — full figure, framed — and her head
 *       follows the cursor.
 * Scrolled: she shrinks into a little pet standing on the bottom edge and keeps
 *       watching the cursor; scroll back up and she grows back.
 *
 * One fixed, full-viewport canvas (pointer-events:none). The character is positioned
 * and scaled inside the scene rather than by moving the canvas, so the morph is a
 * single smooth interpolation with no layout thrash. Falls back to the photograph if
 * WebGL is unavailable.
 */
(function () {
  var canvas = document.getElementById('avatar');
  var slot = document.getElementById('avatar-slot');
  if (!canvas || !slot || !window.THREE) return;
  var THREE = window.THREE;

  function fallback() {
    canvas.style.display = 'none';
    slot.classList.add('avatar-fallback');
  }

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  } catch (e) { return fallback(); }
  if (!renderer || !renderer.getContext()) return fallback();
  if ('outputColorSpace' in renderer && THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearAlpha(0);

  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  var FOV = 30 * Math.PI / 180;

  /* ---------- materials: matte, so no specular hotspot blows out her face ---------- */
  function mat(color, roughness, metalness) {
    return new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: roughness, metalness: metalness || 0 });
  }
  var M = {
    skin: mat('#f0c6a6', 0.92),
    hair: mat('#241a18', 0.86),
    hairHi: mat('#2b1f1c', 0.9),
    top: mat('#c96a3a', 0.62, 0.03),
    topDark: mat('#8f4520', 0.68),
    dark: mat('#2a2430', 0.78),
    shoe: mat('#1b1720', 0.7),
    eye: mat('#2a160e', 0.42),
    mouth: mat('#a8424c', 0.6),
    black: mat('#2b2432', 0.6),
    ivory: mat('#e7d9c8', 0.72),
    white: new THREE.MeshStandardMaterial({ color: new THREE.Color('#ffffff'), roughness: 0.55, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.18 })
  };

  /* ---------- the character (feet at y = 0, ~1.78 units tall) ---------- */
  var char = new THREE.Group();
  function add(parent, geo, material, x, y, z) {
    var m = new THREE.Mesh(geo, material);
    m.position.set(x || 0, y || 0, z || 0);
    parent.add(m);
    return m;
  }
  var SPH = function (r, w, h) { return new THREE.SphereGeometry(r, w || 32, h || 24); };

  /* soft radial alpha maps, drawn once — a flat disc reads as a sticker, a gradient reads as light */
  function radialTexture(stops) {
    var c = document.createElement('canvas'); c.width = c.height = 128;
    var g = c.getContext('2d');
    var grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    stops.forEach(function (st) { grd.addColorStop(st[0], st[1]); });
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    var t = new THREE.CanvasTexture(c);
    if (THREE.SRGBColorSpace && 'colorSpace' in t) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  var shadowMap = radialTexture([[0, 'rgba(0,0,0,0.72)'], [0.45, 'rgba(0,0,0,0.34)'], [1, 'rgba(0,0,0,0)']]);
  var blushMap = radialTexture([[0, 'rgba(226,138,128,0.85)'], [0.55, 'rgba(226,138,128,0.32)'], [1, 'rgba(226,138,128,0)']]);

  /* feet + legs */
  [-1, 1].forEach(function (dir) {
    var f = add(char, new THREE.CapsuleGeometry(0.052, 0.10, 6, 14), M.shoe, dir * 0.095, 0.052, 0.035);
    f.rotation.x = Math.PI / 2; f.rotation.z = -dir * 0.10;
    add(char, new THREE.BoxGeometry(0.115, 0.055, 0.115), M.shoe, dir * 0.095, 0.03, -0.035);
    add(char, new THREE.CapsuleGeometry(0.082, 0.30, 6, 16), M.dark, dir * 0.095, 0.33, 0);
  });

  /* hips + top + neck */
  add(char, new THREE.CylinderGeometry(0.170, 0.196, 0.22, 28), M.topDark, 0, 0.60, 0);
  add(char, new THREE.CylinderGeometry(0.196, 0.166, 0.42, 28), M.top, 0, 0.87, 0);
  var shoulders = add(char, SPH(0.19), M.top, 0, 1.05, 0);
  shoulders.scale.set(1.18, 0.74, 0.94);
  add(char, new THREE.CylinderGeometry(0.058, 0.066, 0.10, 20), M.skin, 0, 1.14, 0);

  /* arms: a short sleeve at the shoulder, arm hanging from it */
  var falls = [];
  [-1, 1].forEach(function (dir) {
    var sleeve = add(char, SPH(0.088, 20, 14), M.top, dir * 0.20, 1.015, 0);
    sleeve.scale.set(1, 0.86, 0.94);
    var arm = add(char, new THREE.CapsuleGeometry(0.052, 0.26, 6, 16), M.skin, dir * 0.205, 0.87, 0);
    arm.rotation.z = -dir * 0.13;
    var hand = add(char, SPH(0.058, 20, 14), M.skin, dir * 0.232, 0.72, 0.012);
    hand.scale.set(1, 0.92, 1);
  });

  /* the fan she is holding — dark leaf over an ivory rim so it reads on a dark page */
  var fan = new THREE.Group();
  add(fan, new THREE.CircleGeometry(0.128, 24, 0, Math.PI), M.ivory, 0, 0, -0.005);
  add(fan, new THREE.CircleGeometry(0.114, 24, 0, Math.PI), M.black, 0, 0, 0);
  for (var i = 0; i < 5; i++) {
    var rib = add(fan, new THREE.BoxGeometry(0.005, 0.108, 0.004), M.dark, 0, 0.055, 0.004);
    rib.rotation.z = -0.62 + i * 0.31;
  }
  var grip = add(fan, new THREE.CylinderGeometry(0.013, 0.013, 0.055, 10), M.dark, 0, -0.012, 0.003);
  grip.rotation.z = Math.PI / 2;
  /* pivot sits in her hand, so the grip is held rather than floating beside it */
  fan.position.set(0.238, 0.735, 0.105);
  fan.rotation.set(0.06, -0.34, -0.5);
  char.add(fan);

  /* ---------- head (its own pivot so it can follow the cursor) ---------- */
  var head = new THREE.Group();
  head.position.set(0, 1.14, 0);
  char.add(head);
  function hy(worldY) { return worldY - 1.14; }   /* authored at body heights, stored head-local */

  var skull = add(head, SPH(0.285, 40, 28), M.skin, 0, hy(1.40), 0);
  skull.scale.set(1, 1.05, 0.97);

  var hairBack = add(head, SPH(0.302, 36, 26), M.hair, 0, hy(1.415), -0.045);
  hairBack.scale.set(1.02, 1.04, 1.0);
  var fringe = add(head, SPH(0.286, 36, 24), M.hairHi, 0, hy(1.556), 0.03);
  fringe.scale.set(0.97, 0.42, 0.70);
  fringe.rotation.x = -0.18;
  var nape = add(head, new THREE.CapsuleGeometry(0.25, 0.30, 6, 18), M.hair, 0, hy(1.04), -0.16);
  nape.scale.set(0.64, 1, 0.86);
  [-1, 1].forEach(function (dir) {
    var fall = add(head, new THREE.CapsuleGeometry(0.072, 0.46, 6, 16), M.hair, dir * 0.252, hy(1.14), -0.015);
    fall.rotation.z = -dir * 0.05;
    fall.userData.sway = dir;
    falls.push(fall);
  });

  var eyes = [];
  [-1, 1].forEach(function (dir) {
    var e = add(head, SPH(0.044, 20, 16), M.eye, dir * 0.098, hy(1.408), 0.252);
    e.scale.set(1, 1.12, 0.5);
    eyes.push(e);
    add(head, SPH(0.012, 12, 10), M.white, dir * 0.106, hy(1.428), 0.278);
  });
  var browL = add(head, new THREE.BoxGeometry(0.084, 0.015, 0.018), M.hair, -0.10, hy(1.484), 0.262);
  var browR = add(head, new THREE.BoxGeometry(0.084, 0.015, 0.018), M.hair, 0.10, hy(1.484), 0.262);
  browL.rotation.z = -0.13; browR.rotation.z = 0.13;

  var blushMat = new THREE.MeshBasicMaterial({ map: blushMap, transparent: true, opacity: 0.75, depthWrite: false });
  [-1, 1].forEach(function (dir) {
    var b = add(head, new THREE.PlaneGeometry(0.15, 0.15), blushMat, dir * 0.148, hy(1.362), 0.252);
    b.rotation.set(-0.14, -dir * 0.66, 0);
  });
  var smile = add(head, new THREE.TorusGeometry(0.036, 0.009, 8, 16, Math.PI), M.mouth, 0, hy(1.34), 0.276);
  smile.rotation.z = Math.PI;

  /* contact shadow so she stands in the panel instead of floating */
  var shadow = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.72),
    new THREE.MeshBasicMaterial({ map: shadowMap, transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.set(0, 0.003, 0.02); char.add(shadow);
  var shadowWide = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 1.25),
    new THREE.MeshBasicMaterial({ map: shadowMap, transparent: true, opacity: 0.35, depthWrite: false }));
  shadowWide.rotation.x = -Math.PI / 2; shadowWide.position.y = 0.002; char.add(shadowWide);

  scene.add(char);

  /* ---------- light: warm key, soft violet rim, warm front fill so the skin stays skin ---------- */
  scene.add(new THREE.HemisphereLight(new THREE.Color('#a9b2ff'), new THREE.Color('#241d2c'), 0.38));
  var key = new THREE.DirectionalLight(new THREE.Color('#fff3e8'), 1.15); key.position.set(1.5, 2.4, 2.9); scene.add(key);
  var rim = new THREE.DirectionalLight(new THREE.Color('#ff9cfc'), 0.85); rim.position.set(-1.7, 1.3, -2.1); scene.add(rim);
  var fill = new THREE.DirectionalLight(new THREE.Color('#ffd9c2'), 0.42); fill.position.set(0.5, 0.9, 2.4); scene.add(fill);

  /* ---------- pointer + scroll ---------- */
  var pointer = { x: -1, y: -1, seen: false };
  window.addEventListener('pointermove', function (e) {
    pointer.x = e.clientX; pointer.y = e.clientY; pointer.seen = true;
  }, { passive: true });

  var yaw = 0, pitch = 0, yawT = 0, pitchT = 0;

  function frame() {
    var vw = window.innerWidth, vh = window.innerHeight;
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    if (canvas.width !== Math.round(vw * dpr) || canvas.height !== Math.round(vh * dpr)) {
      renderer.setPixelRatio(dpr);
      renderer.setSize(vw, vh, false);
      camera.aspect = vw / vh;
      camera.updateProjectionMatrix();
    }

    var dist = 3.2;
    var visH = 2 * Math.tan(FOV / 2) * dist;
    var visW = visH * (vw / vh);
    var pxPerUnit = vh / visH;

    /* how far into the shrink are we? 0 = portrait, 1 = pet */
    var r = slot.getBoundingClientRect();
    var p = (vh * 0.55 - r.bottom) / (vh * 0.45);
    p = p < 0 ? 0 : (p > 1 ? 1 : p);
    var e = p * p * (3 - 2 * p);

    var scaleHero = (r.height * 0.94) / (1.78 * pxPerUnit);
    var scalePet = 118 / (1.78 * pxPerUnit);
    var scale = scaleHero + (scalePet - scaleHero) * e;
    char.scale.setScalar(scale);

    var anchorLocalY = 0.90;
    var ax = 0, ay = anchorLocalY * scale;

    var targetX = (r.left + r.right) / 2;
    var targetY = r.top + r.height * 0.52;
    var petX = vw - Math.max(56, vw * 0.06) - 60;
    var petY = vh - 26 - 56;
    var sx = targetX + (petX - targetX) * e;
    var sy = targetY + (petY - targetY) * e;
    var nx = (sx / vw) * 2 - 1;
    var ny = -((sy / vh) * 2 - 1);

    var ox = -nx * visW / 2, oy = -ny * visH / 2;
    camera.position.set(ax + ox, ay + oy, dist);
    camera.lookAt(ax + ox, ay + oy, 0);

    /* the head follows the cursor, measured from where she actually is on screen */
    if (pointer.seen) {
      var dx = (pointer.x - sx) / (vh * 0.55);
      var dy = (pointer.y - sy) / (vh * 0.55);
      yawT = Math.max(-0.68, Math.min(0.68, dx * 1.25));
      pitchT = Math.max(-0.32, Math.min(0.28, dy * 0.8));
    }
    yaw += (yawT - yaw) * 0.09;
    pitch += (pitchT - pitch) * 0.09;
    head.rotation.set(pitch * 0.85, yaw, yaw * 0.05);
    char.rotation.y += (yaw * 0.26 - char.rotation.y) * 0.07;

    if (!reduced) {
      var t = performance.now() / 1000;
      char.position.y = Math.sin(t * 1.5) * 0.012;
      falls.forEach(function (f) {
        f.rotation.z = -f.userData.sway * (0.05 + Math.sin(t * 1.1 + (f.userData.sway > 0 ? 0.4 : 0)) * 0.035);
      });
      var blink = (t % 5.2) > 5.05 ? 0.12 : 1;
      eyes.forEach(function (en) { en.scale.y = 1.12 * blink; });
    }

    renderer.render(scene, camera);
  }

  function loop() {
    if (!document.hidden) frame();
    requestAnimationFrame(loop);
  }
  loop();
  window.addEventListener('resize', frame);
})();
