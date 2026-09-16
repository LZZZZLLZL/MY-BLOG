/* ============================================================
   LZL · BLOG — 站点引擎（原生 JS，零依赖）
   ============================================================ */
(function () {
  "use strict";

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = (window.MD && MD.esc) || function (s) { return String(s); };
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var POSTS = (window.POSTS || []).slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  var SITE = window.SITE || {};

  /* ---------------- 工具 ---------------- */
  function fmtDate(d, style) {
    var p = String(d).split("-");
    if (style === "dot") return p[0] + "." + p[1] + "." + p[2];
    if (style === "short") return p[1] + "." + p[2];
    return p[0] + " 年 " + p[1] + " 月 " + p[2] + " 日";
  }
  function readTime(p) {
    var n = (p.body || "").replace(/\s/g, "").length;
    return Math.max(1, Math.round(n / 300));
  }
  function postURL(p) { return "post.html?id=" + encodeURIComponent(p.id); }
  function byId(id) {
    for (var i = 0; i < POSTS.length; i++) if (POSTS[i].id === id) return POSTS[i];
    return null;
  }
  function allTags() {
    var m = {};
    POSTS.forEach(function (p) { (p.tags || []).forEach(function (t) { m[t] = (m[t] || 0) + 1; }); });
    return Object.keys(m).sort(function (a, b) { return m[b] - m[a]; }).map(function (t) { return { name: t, count: m[t] }; });
  }
  function params() { try { return new URLSearchParams(location.search); } catch (e) { return new URLSearchParams(""); } }

  /* ---------------- 翻页引擎（首页） ---------------- */
  var PAGES = {
    isDeck: false, panes: [], idx: 0, locked: false, subject: -1, pt: null, ptSheet: null,
    indexOf: function (id) {
      for (var i = 0; i < this.panes.length; i++) if (this.panes[i].id === id) return i;
      return -1;
    },
    go: function (i) { if (this._go) this._go(i); }
  };

  /* ---------------- 主题 ---------------- */
  var TKEY = "lzl-theme";
  function setTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    $$("[data-theme-toggle]").forEach(function (b) {
      b.setAttribute("aria-label", t === "dark" ? "切换到白昼模式" : "切换到夜间模式");
      b.innerHTML = t === "dark"
        ? '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8"/></svg>'
        : '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20.5 14.6A8.5 8.5 0 1 1 9.4 3.5a6.8 6.8 0 0 0 11.1 11.1Z"/></svg>';
    });
  }
  function initTheme() {
    var saved = null;
    try { saved = localStorage.getItem(TKEY); } catch (e) {}
    var q = params().get("theme");
    if (q !== "dark" && q !== "light") q = null;
    var t = q || saved || "dark"; // 默认夜间（明日方舟式）
    setTheme(t);
    if (q) { try { localStorage.setItem(TKEY, q); } catch (e2) {} }
    $$("[data-theme-toggle]").forEach(function (b) {
      b.addEventListener("click", function () {
        var n = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
        setTheme(n);
        try { localStorage.setItem(TKEY, n); } catch (e3) {}
        window.dispatchEvent(new Event("resize"));
      });
    });
  }

  /* ---------------- 背景视频 ---------------- */
  function initBG() {
    var host = $(".bgv");
    if (!host) return;
    /* 手机版：wallpaper.mp4 有 3MB，蜂窝网络下既费流量、解码又掉帧，
       触屏设备和小屏直接用 HTML 里那张 poster 图（.bgv__media 的 <img>），
       只有桌面鼠标设备才升级成视频。 */
    var coarse = window.matchMedia("(pointer: coarse)").matches;
    var smallScreen = window.matchMedia("(max-width: 880px)").matches;
    if (reduced || coarse || smallScreen || (navigator.connection && navigator.connection.saveData)) return;

    var v = document.createElement("video");
    v.className = "bgv__media";
    v.muted = true; v.loop = true; v.autoplay = true;
    v.playsInline = true; v.setAttribute("playsinline", "");
    v.setAttribute("aria-hidden", "true");
    v.poster = "assets/img/poster.jpg";
    var s = document.createElement("source");
    s.src = "assets/video/wallpaper.mp4"; s.type = "video/mp4";
    v.appendChild(s);

    var img = $(".bgv__media", host);
    v.addEventListener("canplay", function () {
      if (img && img.parentNode) img.parentNode.removeChild(img);
    }, { once: true });
    v.addEventListener("error", function () { /* 保留海报图兜底 */ });
    host.appendChild(v);
    var p = v.play(); if (p && p.catch) p.catch(function () {});

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) v.pause(); else v.play().catch(function () {});
    });

    // 轻微视差
    if (window.matchMedia("(pointer:fine)").matches) {
      var tx = 0, ty = 0, cx = 0, cy = 0, raf = null;
      var loop = function () {
        cx += (tx - cx) * .06; cy += (ty - cy) * .06;
        v.style.transform = "scale(1.04) translate3d(" + cx.toFixed(2) + "px," + cy.toFixed(2) + "px,0)";
        if (Math.abs(tx - cx) > .1 || Math.abs(ty - cy) > .1) raf = requestAnimationFrame(loop);
        else raf = null;
      };
      window.addEventListener("mousemove", function (e) {
        tx = (e.clientX / window.innerWidth - .5) * -18;
        ty = (e.clientY / window.innerHeight - .5) * -12;
        if (!raf) raf = requestAnimationFrame(loop);
      }, { passive: true });
    }
  }

  /* ---------------- 启动序列 ---------------- */
  function initBoot() {
    var boot = $("#boot");
    if (!boot) return;
    var seen = false;
    try { seen = !!sessionStorage.getItem("lzl-booted"); } catch (e) {}
    if (reduced || seen) { boot.classList.add("is-done"); boot.remove(); return; }

    var bar = $("#boot-bar"), pct = $("#boot-pct"), log = $("#boot-log");
    var lines = window.BOOT_LINES || [];
    var n = 0, shown = 0;

    var timer = setInterval(function () {
      n = Math.min(100, n + Math.random() * 13 + 5);
      if (bar) bar.style.right = (100 - n) + "%";
      if (pct) pct.textContent = String(Math.floor(n)).padStart(3, "0") + "%";
      var shouldShow = Math.floor((n / 100) * lines.length);
      while (shown < shouldShow && shown < lines.length) {
        var d = document.createElement("div");
        d.textContent = lines[shown++];
        if (log) log.appendChild(d);
      }
      if (n >= 100) {
        clearInterval(timer);
        while (shown < lines.length) {
          var d2 = document.createElement("div"); d2.textContent = lines[shown++]; if (log) log.appendChild(d2);
        }
        setTimeout(function () {
          boot.classList.add("is-done");
          try { sessionStorage.setItem("lzl-booted", "1"); } catch (e) {}
          setTimeout(function () { boot.remove(); }, 800);
        }, 380);
      }
    }, 130);
  }

  /* ---------------- 顶栏 / 导轨 / 滚动守望 ---------------- */
  /* 翻页引擎与导航共用：切换所有「当前页」相关的 UI */
  function syncChrome(idx) {
    var panes = PAGES.panes;
    var rail = $("#rail-dots"), noEl = $("#rail-no");
    if (rail) $$(".rail__dot", rail).forEach(function (d, i) { d.classList.toggle("is-on", i === idx); });
    $$(".top__link").forEach(function (a) {
      a.classList.toggle("is-on", panes[idx] && a.getAttribute("data-nav") === panes[idx].id);
    });
    if (noEl) noEl.innerHTML = "<b>" + String(idx).padStart(2, "0") + "</b> / " +
      String(Math.max(0, panes.length - 1)).padStart(2, "0");
    var bi = $("#bar-i"); if (bi) bi.textContent = String(idx + 1).padStart(2, "0");
    var lbl = $("#pane-label"); if (lbl) lbl.textContent = (panes[idx] && panes[idx].dataset.label) || "";
    var pv = $("#prev"), nx = $("#next");
    if (pv) pv.disabled = idx <= 0;
    if (nx) nx.disabled = idx >= panes.length - 1;
    var line = $("#scroll-line");
    if (line && panes.length > 1) line.style.width = ((idx + 1) / panes.length * 100) + "%";
  }

  /* ---------------- 横向翻页 ---------------- */
  function initDeck() {
    var stage = $("#stage"), deck = $("#deck");
    if (!stage || !deck) return;
    var panes = $$(".pane", deck);
    if (panes.length < 2) return;

    PAGES.isDeck = true;
    PAGES.panes = panes;

    function apply() {
      var idx = PAGES.idx;
      panes.forEach(function (p, k) {
        var d = k - idx;
        p.style.transform = "translate3d(" + (d * 100) + "%,0,0)";
        p.classList.toggle("is-far", Math.abs(d) > 1);
        p.setAttribute("aria-hidden", d === 0 ? "false" : "true");
      });
    }

    function go(i, silent) {
      if (typeof i !== "number" || isNaN(i)) return;
      i = Math.max(0, Math.min(panes.length - 1, i));
      if (i === PAGES.idx && !silent) return;
      var dir = i > PAGES.idx ? 1 : -1;
      PAGES.idx = i;
      apply();
      syncChrome(i);
      if (!silent && !reduced) {
        var wp = $("#wipe");
        if (wp) {
          wp.classList.remove("is-go");
          void wp.offsetWidth;
          wp.style.transformOrigin = dir > 0 ? "left center" : "right center";
          wp.classList.add("is-go");
        }
      }
      PAGES.locked = true;
      setTimeout(function () { PAGES.locked = false; }, reduced ? 80 : 900);
      if (history.replaceState) history.replaceState(null, "", "#" + panes[i].id);
      panes[i].scrollTop = 0;
      reveal(panes[i]);
      // 到位后再填一次环，让进度条是「翻到这页才长出来」
      setTimeout(function () { fillRings(panes[i]); }, reduced ? 0 : 380);
    }
    PAGES._go = go;

    // 初始页：优先跟随 hash
    var start = PAGES.indexOf((location.hash || "").replace("#", ""));
    PAGES.idx = start >= 0 ? start : 0;
    apply();
    syncChrome(PAGES.idx);
    reveal(panes[PAGES.idx]);
    var bn = $("#bar-n"); if (bn) bn.textContent = String(panes.length).padStart(2, "0");

    // 滚轮 / 触控板：面板内部还能滚就先滚，滚到底才翻页
    var acc = 0, accT = 0;
    stage.addEventListener("wheel", function (e) {
      var pane = panes[PAGES.idx];
      var atTop = pane.scrollTop <= 1;
      var atBottom = pane.scrollTop + pane.clientHeight >= pane.scrollHeight - 2;
      var dy = e.deltaY, dx = e.deltaX;
      if ((dy > 0 && !atBottom) || (dy < 0 && !atTop)) { acc = 0; return; }
      e.preventDefault();
      if (PAGES.locked) return;
      var d = Math.abs(dx) > Math.abs(dy) ? dx : dy;
      var now = Date.now();
      if (now - accT > 420) acc = 0;
      accT = now; acc += d;
      if (Math.abs(acc) > 55) { go(PAGES.idx + (acc > 0 ? 1 : -1)); acc = 0; }
    }, { passive: false });

    // 键盘
    window.addEventListener("keydown", function (e) {
      if (SHEET.open) return;   // 弹层开着时方向键交给弹层自己滚
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      var k = e.key;
      if (k === "ArrowRight" || k === "PageDown" || k === " ") { e.preventDefault(); go(PAGES.idx + 1); }
      else if (k === "ArrowLeft" || k === "PageUp") { e.preventDefault(); go(PAGES.idx - 1); }
      else if (k === "Home") { e.preventDefault(); go(0); }
      else if (k === "End") { e.preventDefault(); go(panes.length - 1); }
    });

    // 触摸横滑
    var tx = 0, ty = 0, tt = 0;
    stage.addEventListener("touchstart", function (e) {
      var t0 = e.changedTouches[0]; tx = t0.clientX; ty = t0.clientY; tt = Date.now();
    }, { passive: true });
    stage.addEventListener("touchend", function (e) {
      var t0 = e.changedTouches[0];
      var dx = t0.clientX - tx, dy = t0.clientY - ty;
      if (Date.now() - tt > 700) return;
      if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.4) go(PAGES.idx + (dx < 0 ? 1 : -1));
    }, { passive: true });

    var back = $("#back-mission");
    if (back) back.addEventListener("click", function () { go(PAGES.indexOf("pane-mission")); });

    var pv = $("#prev"), nx = $("#next");
    if (pv) pv.addEventListener("click", function () { go(PAGES.idx - 1); });
    if (nx) nx.addEventListener("click", function () { go(PAGES.idx + 1); });

    window.addEventListener("hashchange", function () {
      var k = PAGES.indexOf((location.hash || "").replace("#", ""));
      if (k >= 0) go(k);
    });
  }

  function initNav() {
    var top = $(".top"), nav = $("#nav"), burger = $("#burger");
    if (burger && nav) {
      burger.addEventListener("click", function () { nav.classList.toggle("is-open"); });
    }
    var stuck = function () { if (top) top.classList.toggle("is-stuck", PAGES.isDeck || window.scrollY > 20); };
    stuck(); window.addEventListener("scroll", stuck, { passive: true });

    // 导轨：有翻页就用面板，没有就退回文档区段
    var rail = $("#rail-dots");
    var secs = PAGES.isDeck ? PAGES.panes : $$("[data-sec]");
    if (rail && secs.length) {
      rail.innerHTML = secs.map(function (s, i) {
        return '<a class="rail__dot" href="#' + s.id + '" data-i="' + i + '" aria-label="' + (s.dataset.label || s.id) + '"><i></i></a>';
      }).join("");
    }

    // 任何带 data-nav / 指向面板 hash 的链接，都交给翻页引擎
    document.addEventListener("click", function (e) {
      var a = e.target.closest ? e.target.closest("[data-nav], a[href^='#pane-']") : null;
      if (!a || !PAGES.isDeck) return;
      var id = a.getAttribute("data-nav") || (a.getAttribute("href") || "").replace("#", "");
      var k = PAGES.indexOf(id);
      if (k < 0) return;
      e.preventDefault();
      PAGES.go(k);
      if (nav) nav.classList.remove("is-open");
    });

    // 顶栏进度线（非翻页页面的文档滚动）
    var line = $("#scroll-line");
    if (line && !PAGES.isDeck) {
      var tick = false;
      var upd = function () {
        var h = document.documentElement.scrollHeight - window.innerHeight;
        line.style.width = (h > 0 ? Math.min(100, window.scrollY / h * 100) : 0) + "%";
        tick = false;
      };
      window.addEventListener("scroll", function () { if (!tick) { tick = true; requestAnimationFrame(upd); } }, { passive: true });
      upd();
    }

    // 回到顶部
    var tt = $(".totop");
    if (tt) {
      var on = function () { tt.classList.toggle("is-on", window.scrollY > 600); };
      on(); window.addEventListener("scroll", on, { passive: true });
      tt.addEventListener("click", function () { window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" }); });
    }
  }

  /* ---------------- 入场 ---------------- */
  var io = null;
  function reveal(root) {
    var els = $$(".rv:not(.in)", root || document);
    if (!els.length) return;
    if (reduced || !("IntersectionObserver" in window)) { els.forEach(function (e) { e.classList.add("in"); }); return; }
    if (!io) {
      io = new IntersectionObserver(function (ents) {
        ents.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
      }, { rootMargin: "0px 0px -6% 0px", threshold: .05 });
    }
    els.forEach(function (e, i) { e.style.transitionDelay = Math.min(i % 5, 4) * 70 + "ms"; io.observe(e); });
  }
  function whenVisible(el, fn) {
    if (!el) return;
    if (reduced || !("IntersectionObserver" in window)) { fn(); return; }
    var o = new IntersectionObserver(function (e) { if (e[0].isIntersecting) { fn(); o.disconnect(); } }, { threshold: .2 });
    o.observe(el);
  }

  /* ---------------- 首屏终端 ---------------- */
  function initTerm() {
    var el = $("#term");
    if (!el) return;
    var lines = window.BOOT_LINES || [];
    if (reduced) { el.innerHTML = lines.join("<br>"); return; }
    var li = 0, ci = 0, out = "";
    (function tick() {
      if (li >= lines.length) { out += '<span class="cur"></span>'; el.innerHTML = out; return; }
      var cur = lines[li];
      ci++;
      var piece = esc(cur.slice(0, ci)).replace(/^(&gt;)/, "<b>$1</b>");
      el.innerHTML = out + piece + '<span class="cur"></span>';
      if (ci >= cur.length) { out += piece + "<br>"; li++; ci = 0; setTimeout(tick, 260); }
      else setTimeout(tick, 26);
    })();
  }

  /* ---------------- 考研倒计时 ---------------- */
  function thirdSat(y) {
    var d = new Date(y, 11, 1);
    var firstSat = 1 + ((6 - d.getDay()) + 7) % 7;
    return new Date(y, 11, firstSat + 14, 8, 30, 0);
  }
  function examDate() {
    var M = window.MISSION || {};
    if (M.examDateOverride) return new Date(M.examDateOverride + "T08:30:00");
    if (M.examYear) return thirdSat(M.examYear);  // 28 考研 => 2027 年 12 月初试
    var y = new Date().getFullYear();
    for (var i = 0; i < 3; i++) if (thirdSat(y + i).getTime() > Date.now()) return thirdSat(y + i);
    return thirdSat(y + 3);
  }
  function initCountdown() {
    var dEl = $("#cd-d"), hEl = $("#cd-h"), mEl = $("#cd-m"), sEl = $("#cd-s");
    if (!dEl) return;
    var target = examDate();
    var dateEl = $("#cd-date");
    if (dateEl) {
      dateEl.innerHTML = "<span>EXAM DATE · " + target.getFullYear() + "." +
        String(target.getMonth() + 1).padStart(2, "0") + "." + String(target.getDate()).padStart(2, "0") + "</span>" +
        "<span>" + ((window.MISSION || {}).examCode || "") + " · 初试</span>";
    }
    function pad(n, w) { return String(Math.max(0, n)).padStart(w, "0"); }
    function tick() {
      var ms = target.getTime() - Date.now();
      if (ms < 0) ms = 0;
      var s = Math.floor(ms / 1000);
      dEl.textContent = pad(Math.floor(s / 86400), 3);
      hEl.textContent = pad(Math.floor(s % 86400 / 3600), 2);
      mEl.textContent = pad(Math.floor(s % 3600 / 60), 2);
      sEl.textContent = pad(s % 60, 2);
    }
    tick(); setInterval(tick, 1000);
  }

  /* ---------------- 首页渲染 ---------------- */
  function renderProfile() {
    var rows = $("#profile-rows"), bio = $("#profile-bio"), card = $("#idcard");
    var P = window.PROFILE || {};
    if (rows) {
      rows.innerHTML = (P.rows || []).map(function (r) {
        return '<div class="row rv"><span class="row__k">' + esc(r.k) + "</span>" +
          '<span class="row__v">' + esc(r.v) + "</span>" +
          '<span class="row__n">' + esc(r.note || "") + "</span></div>";
      }).join("");
    }
    if (bio) bio.innerHTML = (P.bio || []).map(function (t) { return "<p>" + esc(t) + "</p>"; }).join("");
    if (card && P.code) {
      var m = $("#idcard-meta");
      if (m) m.innerHTML = "<span>ID · " + esc(P.code) + "</span><span>GUE · CS</span>";
    }
  }

  /* 单科进度 = 各模块按 w 加权；没写 modules 就回退到 progress 字段 */
  function subjectPct(s) {
    var mods = s.modules || [];
    if (!mods.length) return s.progress || 0;
    var tw = 0, acc = 0;
    mods.forEach(function (m) { var w = m.w || 1; tw += w; acc += w * (m.p || 0); });
    return tw ? Math.round(acc / tw) : 0;
  }
  /* 总进度 = 四科按分值加权 */
  function overallPct() {
    var subs = (window.MISSION || {}).subjects || [];
    var tw = 0, acc = 0;
    subs.forEach(function (s) { var w = s.score || 1; tw += w; acc += w * subjectPct(s); });
    return tw ? Math.round(acc / tw) : 0;
  }

  function renderOverall() {
    var pct = overallPct();
    var n = $("#ov-pct"), b = $("#ov-bar");
    if (n) n.textContent = pct + "%";
    if (b) whenVisible(b, function () { setTimeout(function () { b.style.width = pct + "%"; }, 120); });
  }

  /* ---------------- 环形进度 ---------------- */
  function ringSVG(pct, cls) {
    /* viewBox 固定 100×100，实际像素尺寸完全由 CSS 的 .ring--* 决定。
       之前这里写死了像素值（104/172/42），后来 CSS 尺寸改了而这里没跟着改，
       SVG 就溢出容器并靠左对齐，圆环圆心和中间的数字差了 9px。别再写死。 */
    var V = 100;
    var stroke = cls === "ring--lg" ? 5 : cls === "ring--xs" ? 10 : 8;
    var r = (V - stroke) / 2;
    var c = 2 * Math.PI * r;
    var half = V / 2;
    return '<div class="ring ' + cls + '">' +
      '<svg viewBox="0 0 ' + V + " " + V + '" preserveAspectRatio="xMidYMid meet" aria-hidden="true">' +
        '<circle class="ring-bg" cx="' + half + '" cy="' + half + '" r="' + r.toFixed(1) + '" stroke-width="' + stroke + '"/>' +
        '<circle class="ring-fg" cx="' + half + '" cy="' + half + '" r="' + r.toFixed(1) + '" stroke-width="' + stroke + '"' +
          ' stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + c.toFixed(1) + '"' +
          ' data-c="' + c.toFixed(1) + '" data-p="' + pct + '"/>' +
      "</svg>" +
      '<span class="ring__val">' + pct + "%</span>" +
    "</div>";
  }
  /* 让环从 0 转到目标值 */
  function fillRings(root) {
    $$(".ring-fg", root).forEach(function (c, k) {
      var full = parseFloat(c.getAttribute("data-c"));
      var pct = parseFloat(c.getAttribute("data-p")) || 0;
      var set = function () { c.style.strokeDashoffset = (full * (1 - pct / 100)).toFixed(1); };
      if (reduced) { set(); return; }
      setTimeout(set, Math.min(k, 12) * 70);
    });
  }

  function renderRings() {
    var box = $("#rings");
    if (!box) return;
    var subs = (window.MISSION || {}).subjects || [];
    box.innerHTML = subs.map(function (s, i) {
      return '<button class="ringcard rv" type="button" data-i="' + i + '" data-sub="' + esc(s.code) + '">' +
        '<span class="ringcard__code">' + esc(s.code) + "</span>" +
        ringSVG(subjectPct(s), "ring--sm") +
        '<span class="ringcard__name">' + esc(s.name) + "</span>" +
      "</button>";
    }).join("");
    whenVisible(box, function () { fillRings(box); });
    $$(".ringcard", box).forEach(function (b) {
      b.addEventListener("click", function () { selectSubject(+b.getAttribute("data-i"), true); });
    });
  }

  /* 点开某一科：跑马灯式的展开区 + 粒子文字切到这一科的英文名 */
  /* 选科：填充进度明细页 + 粒子 morph 成该科英文名；nav=true 时翻到明细页 */
  function selectSubject(i, nav) {
    var subs = (window.MISSION || {}).subjects || [];
    var s = subs[i];
    if (!s) return;
    PAGES.subject = i;
    $$(".ringcard").forEach(function (b, k) { b.classList.toggle("is-on", k === i); });

    var box = $("#ringdetail");
    if (box) {
      var mods = s.modules || [];
      box.innerHTML = '<div class="ringdetail__in">' +
        "<div>" + ringSVG(subjectPct(s), "ring--lg") + "</div>" +
        "<div>" +
          '<div class="rd__title">' + esc(s.name) + "</div>" +
          '<div class="rd__sub">' + esc(s.code) + " · " + s.score + " 分 · " + esc(s.en || "") + "</div>" +
          '<div class="rd__mods">' + mods.map(function (m) {
            return '<div class="rd__mod ' + (m.p > 0 ? "is-on" : "is-off") + '">' +
              ringSVG(m.p, "ring--xs") +
              '<span class="rd__modname">' + esc(m.name) + "</span>" +
              '<span class="rd__modp">' + (m.p > 0 ? m.p + "%" : "—") + "</span></div>";
          }).join("") + "</div>" +
          '<div class="rd__note">该科进度 = 各模块按权重加权，改 <code>data.js</code> 里对应模块的 <code>p</code> 即可。</div>' +
        "</div></div>";
      fillRings(box);
    }
    if (PAGES.ptSheet) PAGES.ptSheet.setText(s.en || s.name);   // 弹层里那条跟着科目走
    if (nav) openSheet();
  }

  /* ---------------- 科目英文名 · 粒子文字 ---------------- */
  /* 任务页那条粒子固定显示科目代码，不随选科变化 */
  function initParticles() {
    var cv = $("#pt");
    if (!cv || !window.ParticleText) return;
    PAGES.pt = new window.ParticleText(cv, { color: "123,229,180", step: 3, base: 0.9 });
    PAGES.pt.setText((window.MISSION || {}).examCode || "POSTGRADUATE EXAM");
  }

  /* 弹层里那条粒子显示当前科目的英文名 */
  function initSheetParticles() {
    var cv = $("#pt-sheet");
    if (!cv || !window.ParticleText) return;
    PAGES.ptSheet = new window.ParticleText(cv, { color: "123,229,180", step: 3, base: 0.9 });
  }

  function renderMilestones() {
    var box = $("#miles");
    if (!box) return;
    box.innerHTML = ((window.MISSION || {}).milestones || []).map(function (m) {
      var st = m.state || (m.done ? "done" : "todo");
      return '<div class="mile rv is-' + st + '">' +
        '<span class="mile__t">' + esc(m.time) + "</span>" +
        '<span class="mile__dot"></span>' +
        '<span class="mile__x">' + esc(m.text) +
        (st === "active" ? '<span class="mile__badge">进行中</span>' : "") + "</span></div>";
    }).join("");
  }

  function renderMissionTop() {
    var M = window.MISSION || {};
    var t = $("#target-rows");
    if (t) {
      t.innerHTML = [
        ["报考院校", M.target],
        ["报考专业", M.targetMajor],
        ["学位类型", M.degreeType],
        ["考试年份", (M.enrollYear ? M.enrollYear + " 考研" : "") + (M.examYear ? "（初试 " + M.examYear + ".12）" : "")],
        ["初试科目", M.examCode + "（" + M.examLabel + "）"]
      ].map(function (r) {
        return '<div class="target__row"><span>' + esc(r[0]) + "</span><span>" + esc(r[1]) + "</span></div>";
      }).join("");
    }
    var big = $("#target-big");
    if (big) big.innerHTML = esc(M.target || "") + " · <em>" + esc(M.targetMajor || "") + "</em>";
  }

  function renderProjects() {
    /* 渲染进所有 data-projects 容器（当前只有「03 项目」页一处） */
    var boxes = $$("[data-projects]");
    if (!boxes.length) return;
    var html = (window.PROJECTS || []).map(function (p) {
      return '<article class="proj rv"><div class="panel"><div class="panel__in">' +
        '<div class="proj__top"><span class="proj__idx">' + esc(p.index) + "</span>" +
        '<span class="proj__glyph">' + esc(p.glyph || "◈") + "</span></div>" +
        '<h3 class="proj__name">' + esc(p.name) + "</h3>" +
        '<div class="proj__cn">' + esc(p.cn || "") + "</div>" +
        (p.role ? '<div class="proj__role">' + esc(p.role) + "</div>" : "") +
        '<p class="proj__tag">' + esc(p.tagline) + "</p>" +
        '<p class="proj__desc">' + esc(p.desc) + "</p>" +
        '<ul class="proj__hl">' + (p.highlights || []).map(function (h) { return "<li>" + esc(h) + "</li>"; }).join("") + "</ul>" +
        '<div class="proj__stack">' + (p.stack || []).map(function (s) { return '<span class="tag">' + esc(s) + "</span>"; }).join("") + "</div>" +
        '<a class="proj__link" href="' + esc(p.url) + '" target="_blank" rel="noopener">View on GitHub <span>→</span></a>' +
        "</div></div></article>";
    }).join("");
    boxes.forEach(function (b) { b.innerHTML = html; });
  }

  function renderService() {
    var S = window.SERVICE || {};
    var st = $("#svc-stats");
    if (st) {
      st.innerHTML = (S.stats || []).map(function (s) {
        return '<div class="svc-stat cell rv"><b data-count="' + esc(s.v) + '">' + esc(s.v) + "</b>" +
          "<u>" + (s.u ? esc(s.u) : "\u00A0") + "</u><span>" + esc(s.k) + "</span></div>";
      }).join("");
      whenVisible(st, function () {
        if (reduced) return;
        $$("b[data-count]", st).forEach(function (b) {
          var raw = b.getAttribute("data-count");
          var num = parseInt(raw, 10);
          if (isNaN(num)) return;
          var suffix = raw.replace(/[0-9]/g, "");
          var t0 = null;
          var step = function (ts) {
            if (!t0) t0 = ts;
            var k = Math.min(1, (ts - t0) / 1100);
            var e = 1 - Math.pow(1 - k, 3);
            b.textContent = Math.round(num * e) + suffix;
            if (k < 1) requestAnimationFrame(step);
          };
          b.textContent = "0" + suffix;
          requestAnimationFrame(step);
        });
      });
    }
    var g = $("#svc-grid");
    if (g) {
      g.innerHTML = (S.items || []).map(function (i) {
        return '<div class="svc cell rv"><div class="svc__n">' + esc(i.n) + "</div>" +
          '<div class="svc__t">' + esc(i.t) + "</div>" +
          '<p class="svc__d">' + esc(i.d) + "</p></div>";
      }).join("");
    }
    var intro = $("#svc-intro");
    if (intro) intro.textContent = S.intro || "";
    var hrs = $("#svc-hours");
    if (hrs) hrs.textContent = S.hours || "";
    var org = $("#svc-org");
    if (org) org.innerHTML = esc(S.org || "") + ' <em style="font-style:normal;color:var(--acc)">· ' + esc(S.role || "") + "</em>";
  }

  function logHTML(p) {
    return '<a class="log__item" href="' + postURL(p) + '">' +
      '<span class="log__date">' + fmtDate(p.date, "dot") + "</span>" +
      '<span class="log__glyph">' + esc(p.glyph || "◈") + "</span>" +
      "<span><span class=\"log__t\">" + esc(p.title) + "</span>" +
      '<span class="log__tags">' + (p.tags || []).map(function (t) { return "<span>#" + esc(t) + "</span>"; }).join("") + "</span></span>" +
      '<span class="log__go">READ ' + readTime(p) + " MIN →</span></a>";
  }
  function renderLog() {
    var box = $("#log-list");
    if (box) box.innerHTML = POSTS.slice(0, 5).map(logHTML).join("");
  }

  function renderHeroCard() {
    var box = $("#hero-rows");
    if (!box) return;
    box.innerHTML = [
      ["MAJOR", "计算机科学与技术"],
      ["SCHOOL", "广东第二师范学院"],
      ["ROLE", "电脑义务维修中心 · 主任"],
      ["TARGET", "<em>广州大学 · 计算机技术</em>"],
      ["EXAM", "22408"],
      ["BIRTHDAY", "03.22"]
    ].map(function (r) {
      return '<div class="hcard__row"><span class="hcard__k">' + r[0] + '</span><span class="hcard__v">' + r[1] + "</span></div>";
    }).join("");
  }

  /* ---------------- 文章列表页 ---------------- */
  function initList() {
    var box = $("#list");
    if (!box) return;
    var state = { q: params().get("q") || "", tag: params().get("tag") || "" };
    var tagsBox = $("#filter-tags"), input = $("#search"), count = $("#count");

    function renderTags() {
      if (!tagsBox) return;
      tagsBox.innerHTML = '<button class="chip' + (state.tag ? "" : " is-on") + '" data-tag="">ALL</button>' +
        allTags().map(function (t) {
          return '<button class="chip' + (state.tag === t.name ? " is-on" : "") + '" data-tag="' + esc(t.name) + '">#' +
            esc(t.name) + "<small>" + t.count + "</small></button>";
        }).join("");
      $$("button[data-tag]", tagsBox).forEach(function (b) {
        b.addEventListener("click", function () { state.tag = b.getAttribute("data-tag"); renderTags(); render(); });
      });
    }
    function card(p) {
      return '<a class="acard rv" href="' + postURL(p) + '"><div class="panel"><div class="panel__in">' +
        '<div class="acard__top"><span>' + fmtDate(p.date, "dot") + "</span><span>" + readTime(p) + " MIN</span></div>" +
        '<h3 class="acard__t">' + esc(p.title) + "</h3>" +
        '<p class="acard__x">' + esc(p.excerpt) + "</p>" +
        '<div class="acard__tags">' + (p.tags || []).map(function (t) { return '<span class="tag">#' + esc(t) + "</span>"; }).join("") + "</div>" +
        "</div></div></a>";
    }
    function render() {
      var q = state.q.trim().toLowerCase();
      var list = POSTS.filter(function (p) {
        if (state.tag && (p.tags || []).indexOf(state.tag) < 0) return false;
        if (!q) return true;
        return (p.title + " " + p.excerpt + " " + (p.body || "") + " " + (p.tags || []).join(" ")).toLowerCase().indexOf(q) >= 0;
      });
      box.innerHTML = list.length ? list.map(card).join("")
        : '<div class="empty">// NO RECORD FOUND — 换个关键词试试</div>';
      if (count) count.textContent = String(list.length).padStart(2, "0") + " RECORDS";
      reveal(box);
    }
    if (input) {
      input.value = state.q;
      var t;
      input.addEventListener("input", function () { clearTimeout(t); t = setTimeout(function () { state.q = input.value; render(); }, 150); });
    }
    renderTags(); render();
  }

  /* ---------------- 文章详情页 ---------------- */
  function initPost() {
    var host = $("#article");
    if (!host) return;
    var p = byId(params().get("id")) || POSTS[0];
    if (!p) { host.innerHTML = '<div class="empty">// 文章不存在</div>'; return; }

    var md = MD.render(p.body);
    document.title = p.title + " · " + (SITE.name || "LZL");

    var idx = POSTS.map(function (x) { return x.id; }).indexOf(p.id);
    var next = POSTS[idx - 1], prev = POSTS[idx + 1];

    host.innerHTML =
      '<header class="art-head">' +
        '<div class="art-head__meta"><span>' + fmtDate(p.date) + "</span>" +
        "<span>READ <b>" + readTime(p) + " MIN</b></span>" +
        "<span>" + (p.tags || []).map(function (t) { return "#" + esc(t); }).join(" ") + "</span></div>" +
        '<h1 class="art-title">' + esc(p.title) + "</h1>" +
        '<p style="color:var(--ink-2);font-size:.95rem;margin-top:14px">' + esc(p.excerpt) + "</p>" +
      "</header>" +
      '<div class="art-cover"><span>' + esc(p.glyph || "◈") + "</span></div>" +
      '<div class="prose" id="prose">' + md.html + "</div>";

    // 目录
    var toc = $("#toc");
    if (toc) {
      if (md.headings.length < 2) toc.style.display = "none";
      else {
        toc.innerHTML = md.headings.map(function (h) {
          return '<a href="#' + h.id + '" data-h="' + h.id + '"><span>' + esc(h.text) + "</span><i></i></a>";
        }).join("");
        var ob = new IntersectionObserver(function (ents) {
          ents.forEach(function (en) {
            if (!en.isIntersecting) return;
            $$("a", toc).forEach(function (a) { a.classList.toggle("is-on", a.getAttribute("data-h") === en.target.id); });
          });
        }, { rootMargin: "-15% 0px -70% 0px" });
        md.headings.forEach(function (h) { var el = document.getElementById(h.id); if (el) ob.observe(el); });
      }
    }

    // 上下篇
    var pager = $("#pager");
    if (pager) {
      pager.innerHTML =
        (prev ? '<a class="cell rv" href="' + postURL(prev) + '"><small>← PREV</small><b>' + esc(prev.title) + "</b></a>" : "<span></span>") +
        (next ? '<a class="cell rv" href="' + postURL(next) + '"><small>NEXT →</small><b>' + esc(next.title) + "</b></a>" : "<span></span>");
    }

    initComments(p.id);
  }

  /* ---------------- 留言 ---------------- */
  function initComments(pid) {
    var list = $("#cmt-list"), form = $("#cmt-form");
    if (!list) return;
    var KEY = "lzl-cmt-" + pid;
    function load() {
      var saved = [];
      try { saved = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (e) {}
      return saved;
    }
    function render() {
      var items = load();
      list.innerHTML = items.length ? items.map(function (c) {
        return '<div class="cmt"><div class="cmt__av">' + esc(String(c.name || "?").slice(0, 1)) + "</div>" +
          "<div><div><span class=\"cmt__n\">" + esc(c.name) + '</span><span class="cmt__t">' + esc(c.time) + "</span></div>" +
          '<p class="cmt__x">' + esc(c.text) + "</p></div></div>";
      }).join("") : '<p style="color:var(--ink-3);font-size:.86rem;font-family:var(--f-mono)">// 还没有留言，来做第一个</p>';
      var n = $("#cmt-n"); if (n) n.textContent = items.length;
    }
    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var name = ($("#c-name") || {}).value || "";
        var text = (($("#c-text") || {}).value || "").trim();
        if (!text) return;
        var saved = [];
        try { saved = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (e2) {}
        var d = new Date(), pad = function (x) { return String(x).padStart(2, "0"); };
        saved.unshift({
          name: name.trim() || "匿名旅人", text: text,
          time: d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes())
        });
        try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch (e3) {}
        $("#c-text").value = ""; render();
      });
    }
    render();
  }

  /* ---------------- 科目详情全屏层 ---------------- */
  var SHEET = { el: null, open: false };
  function openSheet() {
    if (!SHEET.el) return;
    SHEET.el.classList.add("is-open");
    SHEET.el.setAttribute("aria-hidden", "false");
    SHEET.open = true;
    var sc = $("#sheet-scroll"); if (sc) sc.scrollTop = 0;
    reveal(SHEET.el);
  }
  function closeSheet() {
    if (!SHEET.el) return;
    SHEET.el.classList.remove("is-open");
    SHEET.el.setAttribute("aria-hidden", "true");
    SHEET.open = false;
  }
  function initSheet() {
    SHEET.el = $("#sheet");
    if (!SHEET.el) return;
    ["#sheet-close", "#sheet-close2"].forEach(function (sel) {
      var b = $(sel); if (b) b.addEventListener("click", closeSheet);
    });
    // 只有直接点到遮罩层才关，点内容不关
    SHEET.el.addEventListener("click", function (e) { if (e.target === SHEET.el) closeSheet(); });
    window.addEventListener("keydown", function (e) { if (e.key === "Escape" && SHEET.open) closeSheet(); });

    // 弹层里滚到底还继续往下滚 = 收起弹层，翻到「03 项目」页
    // （弹层不在 .stage 里，所以这里的滚轮不会触发翻页引擎，得自己接）
    var sc = $("#sheet-scroll");
    if (!sc) return;
    var acc = 0, accT = 0;
    function leaveTo(nextId) {
      var k = PAGES.indexOf(nextId);
      closeSheet();
      if (k >= 0) PAGES.go(k);
      acc = 0;
    }
    sc.addEventListener("wheel", function (e) {
      if (!SHEET.open) return;
      var atTop = sc.scrollTop <= 1;
      var atBottom = sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 2;
      // 弹层内容自己能滚就先让它滚
      if ((e.deltaY > 0 && !atBottom) || (e.deltaY < 0 && !atTop)) { acc = 0; return; }
      if (e.deltaY <= 0) { acc = 0; return; }   // 只有「往下滚」才切走
      e.preventDefault();
      var now = Date.now();
      if (now - accT > 420) acc = 0;
      accT = now; acc += e.deltaY;
      if (acc > 55) leaveTo("pane-projects");
    }, { passive: false });

    var ty = 0, tt = 0;
    sc.addEventListener("touchstart", function (e) {
      var t0 = e.changedTouches[0]; ty = t0.clientY; tt = Date.now();
    }, { passive: true });
    sc.addEventListener("touchend", function (e) {
      if (!SHEET.open || Date.now() - tt > 700) return;
      var t0 = e.changedTouches[0];
      var dy = t0.clientY - ty;
      var atBottom = sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 2;
      if (dy < -55 && atBottom && sc.scrollHeight <= sc.clientHeight + 4) leaveTo("pane-projects");
    }, { passive: true });
  }

  /* ---------------- 页脚 / 通用 ---------------- */
  function renderFoot() {
    var y = $("#year"); if (y) y.textContent = new Date().getFullYear();
    var f = $("#foot-note"); if (f && SITE.footer) f.textContent = SITE.footer;
    $$("[data-ticker]").forEach(function (box) {
      var items = (window.TICKER || []).concat(window.TICKER || []);
      box.innerHTML = items.map(function (t) { return '<span class="ticker__item">' + esc(t) + "</span>"; }).join("");
    });
    $$("[data-github]").forEach(function (a) { a.href = SITE.github || "#"; });
  }

  /* ---------------- 装配 ---------------- */
  function boot() {
    initTheme();
    initBG();
    initBoot();
    initDeck();     // 先建翻页，initNav 才有 PAGES 可用
    initNav();
    initTerm();
    initCountdown();
    renderHeroCard();
    renderProfile();
    renderMissionTop();
    renderRings();
    renderOverall();
    initParticles();       // 任务页：固定 22408
    initSheetParticles();  // 弹层：跟着科目走
    initSheet();
    selectSubject(0);
    renderMilestones();
    renderProjects();
    renderService();
    renderLog();
    initList();
    initPost();
    renderFoot();
    reveal();
  }

  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", boot) : boot();
})();
