/**
 * 个人网络技术测试实践平台 - 交互脚本
 *
 * 模块：
 *   1. 加载屏与首屏计时
 *   2. Three.js 星空背景（WebGL 不可用时降级为 Canvas 2D）
 *   3. 鼠标光晕跟随
 *   4. 打字机、时钟、年份
 *   5. 滚动入场、数字滚动、导航高亮
 */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function $(id) { return document.getElementById(id); }

  /* ========== 1. 加载屏 ========== */
  var preloader = $("preloader");
  var preloaderFill = $("preloaderFill");

  function setProgress(p) {
    if (preloaderFill) preloaderFill.style.width = p + "%";
  }

  function hidePreloader() {
    if (!preloader || preloader.classList.contains("is-hidden")) return;
    setProgress(100);
    setTimeout(function () {
      preloader.classList.add("is-hidden");
      runHeroReveal();
    }, 320);
  }

  setProgress(30);
  if (document.readyState === "complete") {
    setProgress(70);
    setTimeout(hidePreloader, 350);
  } else {
    setProgress(60);
    window.addEventListener("load", function () {
      setProgress(90);
      setTimeout(hidePreloader, 400);
    });
  }
  // 兜底：3 秒后无论如何都放行，避免资源异常卡住首屏
  setTimeout(hidePreloader, 3000);

  /* ========== 2. 背景：Three.js 星空 ========== */
  var canvas = $("bgCanvas");

  function markReady() {
    if (canvas) canvas.classList.add("is-ready");
  }

  function startStars3D() {
    if (!canvas || !window.THREE) return startStars2D();

    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        alpha: true,
        antialias: true,
        powerPreference: "high-performance"
      });
    } catch (e) {
      return startStars2D();
    }

    var w = window.innerWidth;
    var h = window.innerHeight;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);

    var scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x070a12, 0.0011);

    var camera = new THREE.PerspectiveCamera(62, w / h, 0.1, 2400);
    camera.position.z = 520;

    var count = w < 700 ? 900 : 1600;
    var positions = new Float32Array(count * 3);
    var colors = new Float32Array(count * 3);
    var base = new THREE.Color(0x38bdf8);
    var alt = new THREE.Color(0x818cf8);
    var white = new THREE.Color(0xdbeafe);

    var i;
    for (i = 0; i < count; i++) {
      // 球壳随机分布
      var r = 320 + Math.random() * 900;
      var theta = Math.random() * Math.PI * 2;
      var phi = Math.acos(2 * Math.random() - 1);

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.7;
      positions[i * 3 + 2] = r * Math.cos(phi) - 260;

      var pick = Math.random();
      var c = pick > 0.82 ? alt : (pick > 0.6 ? base : white);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    var geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    var mat = new THREE.PointsMaterial({
      size: 2.1,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      sizeAttenuation: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    var points = new THREE.Points(geo, mat);
    scene.add(points);

    // 线框多面体，增加空间纵深感
    var wire = new THREE.Mesh(
      new THREE.IcosahedronGeometry(210, 1),
      new THREE.MeshBasicMaterial({
        color: 0x3b6ea8,
        wireframe: true,
        transparent: true,
        opacity: 0.16
      })
    );
    wire.position.z = -180;
    scene.add(wire);

    var targetX = 0;
    var targetY = 0;
    var camX = 0;
    var camY = 0;

    window.addEventListener("mousemove", function (e) {
      targetX = (e.clientX / w - 0.5) * 70;
      targetY = (e.clientY / h - 0.5) * 45;
    }, { passive: true });

    var resizeTimer;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        w = window.innerWidth;
        h = window.innerHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
      }, 180);
    });

    // 页面不可见时停止渲染，节省资源
    var paused = false;
    document.addEventListener("visibilitychange", function () {
      paused = document.hidden;
      if (!paused) requestAnimationFrame(render);
    });

    var startTs = Date.now();

    function render() {
      if (paused) return;

      if (!reduceMotion) {
        var t = (Date.now() - startTs) * 0.0001;
        points.rotation.y = t * 1.4;
        points.rotation.x = Math.sin(t * 0.8) * 0.08;
        wire.rotation.y = -t * 2.1;
        wire.rotation.z = t * 1.1;
      }

      camX += (targetX - camX) * 0.045;
      camY += (targetY - camY) * 0.045;
      camera.position.x = camX;
      camera.position.y = -camY;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
      requestAnimationFrame(render);
    }

    markReady();
    requestAnimationFrame(render);
  }

  /* 降级方案：Canvas 2D 星空 */
  function startStars2D() {
    if (!canvas) return;
    var ctx = canvas.getContext("2d");
    if (!ctx) return;

    var w, h, stars, i;

    function build() {
      w = canvas.width = Math.floor(window.innerWidth * Math.min(window.devicePixelRatio || 1, 1.5));
      h = canvas.height = Math.floor(window.innerHeight * Math.min(window.devicePixelRatio || 1, 1.5));
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";

      var count = Math.floor((w * h) / 9000);
      stars = [];
      for (i = 0; i < count; i++) {
        stars.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: Math.random() * 1.5 + 0.3,
          a: Math.random() * 0.5 + 0.25,
          s: Math.random() * 0.08 + 0.01
        });
      }
    }

    build();
    markReady();

    var resizeTimer;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(build, 180);
    });

    var paused = false;
    document.addEventListener("visibilitychange", function () {
      paused = document.hidden;
      if (!paused) requestAnimationFrame(draw);
    });

    function draw() {
      if (paused) return;
      ctx.clearRect(0, 0, w, h);
      for (i = 0; i < stars.length; i++) {
        var s = stars[i];
        if (!reduceMotion) {
          s.y -= s.s;
          if (s.y < 0) { s.y = h; s.x = Math.random() * w; }
        }
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(203, 226, 255, " + s.a + ")";
        ctx.fill();
      }
      requestAnimationFrame(draw);
    }

    requestAnimationFrame(draw);
  }

  if (reduceMotion) {
    if (canvas) canvas.classList.add("is-ready");
  } else {
    startStars3D();
  }

  /* ========== 3. 鼠标光晕 ========== */
  (function () {
    var glow = $("cursorGlow");
    if (!glow || reduceMotion) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;

    var gx = 0, gy = 0, cx = 0, cy = 0;
    var moved = false;

    window.addEventListener("mousemove", function (e) {
      gx = e.clientX;
      gy = e.clientY;
      if (!moved) {
        cx = gx; cy = gy;
        glow.classList.add("is-active");
        moved = true;
      }
    }, { passive: true });

    (function loop() {
      cx += (gx - cx) * 0.12;
      cy += (gy - cy) * 0.12;
      glow.style.transform = "translate3d(" + cx + "px," + cy + "px,0)";
      requestAnimationFrame(loop);
    })();
  })();

  /* ========== 4. 打字机 / 时钟 / 年份 ========== */
  var yearEl = $("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  (function () {
    var el = $("typewriter");
    if (!el) return;
    var text = "explore network · capture packets · keep it running";
    if (reduceMotion) { el.textContent = text; return; }

    var idx = 0;
    var timer = setInterval(function () {
      if (idx >= text.length) { clearInterval(timer); return; }
      el.textContent += text.charAt(idx);
      idx += 1;
    }, 55);
  })();

  (function () {
    var clockEl = $("clock");
    if (!clockEl) return;
    function pad(n) { return n < 10 ? "0" + n : String(n); }
    function tick() {
      var d = new Date();
      clockEl.textContent = pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
    }
    tick();
    setInterval(tick, 1000);
  })();

  /* ========== 5. 滚动入场 / 数字 / 导航 ========== */
  var revealedOnce = false;

  function runHeroReveal() {
    if (revealedOnce) return;
    revealedOnce = true;

    if (reduceMotion) {
      var all = document.querySelectorAll(".reveal");
      for (var i = 0; i < all.length; i++) all[i].classList.add("is-in");
      startCounters();
      return;
    }

    var heroNodes = document.querySelectorAll(".hero .reveal");
    for (var j = 0; j < heroNodes.length; j++) heroNodes[j].classList.add("is-in");

    startCounters();

    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        });
      }, { threshold: 0.14, rootMargin: "0px 0px -40px 0px" });

      var rest = document.querySelectorAll("main .section .reveal");
      for (var k = 0; k < rest.length; k++) io.observe(rest[k]);
    } else {
      var nodes = document.querySelectorAll(".reveal");
      for (var m = 0; m < nodes.length; m++) nodes[m].classList.add("is-in");
    }
  }

  function startCounters() {
    var nums = document.querySelectorAll(".stat-num[data-count]");
    for (var i = 0; i < nums.length; i++) {
      (function (el) {
        if (el.getAttribute("data-plain") === "1") return;
        if (reduceMotion) { el.textContent = el.getAttribute("data-count"); return; }
        var target = parseInt(el.getAttribute("data-count"), 10) || 0;
        var duration = 1100;
        var start = null;
        function step(ts) {
          if (start === null) start = ts;
          var p = Math.min((ts - start) / duration, 1);
          el.textContent = String(Math.round(target * (1 - Math.pow(1 - p, 3))));
          if (p < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
      })(nums[i]);
    }
  }

  /* 导航：滚动态 + 当前区块高亮 */
  (function () {
    var nav = $("nav");
    var links = document.querySelectorAll(".nav-link");
    var sections = [];
    for (var i = 0; i < links.length; i++) {
      var sec = document.querySelector(links[i].getAttribute("href"));
      if (sec) sections.push({ link: links[i], el: sec });
    }

    function update() {
      var y = window.pageYOffset || document.documentElement.scrollTop;
      if (nav) nav.classList.toggle("is-stuck", y > 20);

      // 以视口上 1/3 处作为判定基准
      var line = y + window.innerHeight * 0.32;
      var active = null;
      for (var s = 0; s < sections.length; s++) {
        if (sections[s].el.offsetTop <= line) active = sections[s].link;
      }
      for (var t = 0; t < links.length; t++) links[t].classList.remove("is-active");
      if (active) active.classList.add("is-active");
    }

    var ticking = false;
    window.addEventListener("scroll", function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        update();
        ticking = false;
      });
    }, { passive: true });

    update();
  })();

  /* 首屏渲染耗时 */
  window.addEventListener("load", function () {
    var el = $("perfTime");
    if (!el || !window.performance || !performance.timing) return;
    var t = performance.timing;
    var cost = t.domContentLoadedEventEnd - t.navigationStart;
    if (cost > 0) el.textContent = String(cost);
  });
})();
