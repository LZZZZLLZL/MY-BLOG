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
    if (reduced || (navigator.connection && navigator.connection.saveData)) return;

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
  function initNav() {
    var top = $(".top"), nav = $("#nav"), burger = $("#burger");
    if (burger && nav) {
      burger.addEventListener("click", function () { nav.classList.toggle("is-open"); });
      $$(".top__link", nav).forEach(function (a) {
        a.addEventListener("click", function () { nav.classList.remove("is-open"); });
      });
    }
    var stuck = function () { if (top) top.classList.toggle("is-stuck", window.scrollY > 20); };
    stuck(); window.addEventListener("scroll", stuck, { passive: true });

    // 导轨
    var rail = $("#rail-dots");
    var secs = $$("[data-sec]");
    if (rail && secs.length) {
      rail.innerHTML = secs.map(function (s, i) {
        return '<a class="rail__dot" href="#' + s.id + '" data-i="' + i + '" aria-label="' + (s.dataset.label || s.id) + '"><i></i></a>';
      }).join("");
    }

    // 当前区段序号
    var noEl = $("#rail-no");
    function setActive(idx) {
      if (rail) $$(".rail__dot", rail).forEach(function (d, i) { d.classList.toggle("is-on", i === idx); });
      $$(".top__link").forEach(function (a) {
        var t = a.getAttribute("href");
        a.classList.toggle("is-on", secs[idx] && t === "#" + secs[idx].id);
      });
      if (noEl) noEl.innerHTML = "<b>" + String(idx).padStart(2, "0") + "</b> / " + String(Math.max(0, secs.length - 1)).padStart(2, "0");
    }
    if (secs.length && "IntersectionObserver" in window) {
      var cur = 0;
      var ob = new IntersectionObserver(function (ents) {
        ents.forEach(function (en) {
          if (!en.isIntersecting) return;
          var i = secs.indexOf(en.target);
          if (i >= 0 && i !== cur) { cur = i; setActive(i); }
        });
      }, { rootMargin: "-45% 0px -45% 0px" });
      secs.forEach(function (s) { ob.observe(s); });
      setActive(0);
    }

    // 顶部进度线
    var line = $("#scroll-line");
    if (line) {
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

  function renderSubjects() {
    var box = $("#subjects");
    if (!box) return;
    var subs = (window.MISSION || {}).subjects || [];
    box.innerHTML = subs.map(function (s) {
      var pct = subjectPct(s);
      var mods = s.modules || [];
      var body = mods.length
        ? '<ul class="mods">' + mods.map(function (m) {
            return '<li class="mod' + (m.p > 0 ? " is-on" : "") + '">' +
              '<span class="mod__n">' + esc(m.name) + "</span>" +
              '<span class="mod__b"><i data-p="' + m.p + '"></i></span>' +
              '<span class="mod__p">' + (m.p > 0 ? m.p + "%" : "—") + "</span></li>";
          }).join("") + "</ul>"
        : '<div class="subj__foot"><span>' + esc(s.note || "") + "</span></div>";
      return '<div class="subj cell rv">' +
        '<div class="subj__top"><span class="subj__code">' + esc(s.code) + "</span>" +
        '<span class="subj__name">' + esc(s.name) + "</span>" +
        '<span class="subj__score">' + s.score + " 分</span></div>" +
        '<div class="subj__bar"><i data-p="' + pct + '"></i></div>' +
        '<div class="subj__foot"><span>' + (mods.length ? mods.filter(function (m) { return m.p > 0; }).length + " / " + mods.length + " 模块已启动" : "") +
        "</span><b>" + pct + "%</b></div>" + body + "</div>";
    }).join("");
    whenVisible(box, function () {
      $$("i[data-p]", box).forEach(function (i, k) {
        setTimeout(function () { i.style.width = i.getAttribute("data-p") + "%"; }, reduced ? 0 : Math.min(k, 12) * 55);
      });
    });
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
    var box = $("#projects");
    if (!box) return;
    box.innerHTML = (window.PROJECTS || []).map(function (p) {
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
    var box = $("#log");
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
    initNav();
    initTerm();
    initCountdown();
    renderHeroCard();
    renderProfile();
    renderMissionTop();
    renderSubjects();
    renderOverall();
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
