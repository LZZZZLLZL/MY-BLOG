/* ============================================================
   ParticleText —— 把文字采样成粒子群（明日方舟 #world 那种点云感）
   用法：
     var pt = new ParticleText(canvasEl);
     pt.setText("MATHEMATICS II");
     pt.destroy();
   特性：换文案时粒子会自己飞拢成新字；鼠标靠近会把粒子拨开。
   ============================================================ */
window.ParticleText = (function () {
  "use strict";

  function ParticleText(canvas, opt) {
    var o = opt || {};
    this.cv = canvas;
    this.ctx = canvas.getContext("2d");
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.step = o.step || 4;                 // 采样步长，越小点越密
    this.color = o.color || "123,229,180";
    this.base = o.base || 0.85;              // 基础不透明度
    this.mouseR = o.mouseR || 120;
    /* 归位速度：每 60fps 帧向目标靠近的比例。
       0.0376 → (1-0.0376)^120 ≈ 0.01，即约 2s 归位、全程不过冲 ——
       这是「缓缓构成字形」的档位（之前 0.06 的弹簧档只要 0.58s，且过冲 41%）。 */
    this.smooth = o.smooth || 0.0376;
    /* 鼠标拨散单独走一条快通道，否则归位那么慢会完全不跟手 */
    this.smoothMouse = o.smoothMouse || 0.22;
    this.mousePush = o.mousePush || 46;   // 最多被推开多少像素（≈ 带宽的一半，太大会把粒子推出画布）
    this.font = o.font || '900 %SPX "Saira Condensed","Rajdhani",system-ui,sans-serif';
    this.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    this.text = "";
    this.parts = [];
    this.mouse = { x: -9999, y: -9999 };
    this._last = 0;
    this.raf = null;
    this.running = true;
    this.ready = false;

    this._measure();
    this._bind();
    this._start();

    // 字体是异步加载的，加载完重新采样一次，否则字形会退回系统字体
    var self = this;
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { self._measure(); self._resample(); });
    }
  }

  ParticleText.prototype._measure = function () {
    var r = this.cv.getBoundingClientRect();
    this.w = Math.max(1, Math.round(r.width));
    this.h = Math.max(1, Math.round(r.height));
    this.cv.width = this.w * this.dpr;
    this.cv.height = this.h * this.dpr;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this._paint();
  };

  /* 把文字画到离屏画布上，再读出像素点作为粒子目标 */
  ParticleText.prototype._paint = function () {
    var off = document.createElement("canvas");
    off.width = this.w; off.height = this.h;
    var c = off.getContext("2d");
    c.fillStyle = "#fff";
    c.textBaseline = "middle";
    c.textAlign = "left";

    var text = (this.text || "").toUpperCase();
    if (!text) return;

    // 逐字摆放，手动控制字间距（canvas 的 letterSpacing 兼容性不够）
    var fs = this.h * 0.86;   // 大写字母实际高度约为字号的 0.7，取 0.92 才撑得满
    var spacing = fs * 0.06;
    var setFont = function (size) {
      c.font = "900 " + size + "px \"Saira Condensed\",\"Rajdhani\",system-ui,sans-serif";
    };
    var measure = function (size) {
      setFont(size);
      var chars = text.split("");
      var total = 0;
      for (var i = 0; i < chars.length; i++) total += c.measureText(chars[i]).width;
      return total + spacing * (chars.length - 1);
    };

    var maxW = this.w * 0.95;
    if (measure(fs) > maxW) fs = fs * (maxW / measure(fs));   // 缩到能放下
    setFont(fs);

    var chars = text.split("");
    var total = 0, ws = [];
    for (var i = 0; i < chars.length; i++) { ws[i] = c.measureText(chars[i]).width; total += ws[i]; }
    total += spacing * (chars.length - 1);

    var x = (this.w - total) / 2, y = this.h / 2;
    for (var j = 0; j < chars.length; j++) { c.fillText(chars[j], x, y); x += ws[j] + spacing; }

    var data = c.getImageData(0, 0, this.w, this.h).data;
    var pts = [];
    var st = this.w < 700 ? this.step + 1 : this.step;
    for (var py = 0; py < this.h; py += st) {
      for (var px = 0; px < this.w; px += st) {
        if (data[(py * this.w + px) * 4 + 3] > 128) {
          pts.push({ x: px, y: py });
        }
      }
    }
    this.targets = pts;
    this._assign();
    // 降级模式必须在这里同步画：rAF 很可能在 setText 之前就已经跑过那一帧了，
    // 那一帧还没有粒子，等下一次 rAF 又永远等不到 —— 粒子带就是全黑的。
    if (this.reduced) this._drawStatic();
  };

  /* 降级模式：按最终位置一次性画出来，不做任何动画 */
  ParticleText.prototype._drawStatic = function () {
    var ctx = this.ctx, i, p;
    ctx.clearRect(0, 0, this.w, this.h);
    ctx.fillStyle = "rgba(" + this.color + "," + this.base + ")";
    for (i = 0; i < this.parts.length; i++) {
      p = this.parts[i];
      if (!p.alive) continue;
      ctx.fillRect(p.tx, p.ty, p.size, p.size);
    }
  };

  /* 把目标点分配给粒子：不够就补，多了就让它淡出 */
  ParticleText.prototype._assign = function () {
    var t = this.targets || [];
    var i;
    for (i = 0; i < t.length; i++) {
      if (i < this.parts.length) {
        this.parts[i].tx = t[i].x; this.parts[i].ty = t[i].y;
        this.parts[i].alive = true;
      } else {
        this.parts.push(this._spawn(t[i].x, t[i].y));
      }
    }
    for (i = t.length; i < this.parts.length; i++) this.parts[i].alive = false;
    this.ready = true;
  };

  ParticleText.prototype._spawn = function (tx, ty) {
    /* 椭圆散布：横向散得开（粒子从两侧缓缓汇入），纵向收窄 ——
       这条粒子带只有 100 多像素高，纵向散太开粒子会出生在画布外、看着像凭空冒出来。 */
    var a = Math.random() * 6.2832;
    var rH = 40 + Math.random() * 190;
    var rV = 14 + Math.random() * 46;
    return {
      x: tx + Math.cos(a) * rH,
      y: ty + Math.sin(a) * rV,
      tx: tx, ty: ty,
      ox: 0, oy: 0,        // 鼠标拨开带来的偏移（快通道）
      a: 0, seed: Math.random() * 6.283,
      size: 1.5 + Math.random() * 0.9,
      alive: true
    };
  };

  ParticleText.prototype.setText = function (text) {
    if (text === this.text) return;
    this.text = text || "";
    this._paint();
  };

  ParticleText.prototype._resample = function () {
    if (!this.text) return;
    this._paint();
  };

  ParticleText.prototype._bind = function () {
    var self = this;
    var host = this.cv.parentNode || this.cv;
    host.addEventListener("mousemove", function (e) {
      var r = self.cv.getBoundingClientRect();
      self.mouse.x = e.clientX - r.left;
      self.mouse.y = e.clientY - r.top;
    });
    host.addEventListener("mouseleave", function () { self.mouse.x = -9999; self.mouse.y = -9999; });

    var t;
    window.addEventListener("resize", function () {
      clearTimeout(t); t = setTimeout(function () { self._measure(); self._resample(); }, 200);
    });
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) self._stop(); else self._start();
    });
  };

  ParticleText.prototype._start = function () {
    if (this.raf || !this.running) return;
    var self = this;
    (function loop(t) {
      self._frame(t);
      self.raf = requestAnimationFrame(loop);
    })(0);
  };
  ParticleText.prototype._stop = function () {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
  };

  ParticleText.prototype._frame = function (t) {
    var ctx = this.ctx, i, p;
    ctx.clearRect(0, 0, this.w, this.h);

    if (this.reduced) return;   // 静态绘制在 _paint 里同步完成，不等 rAF

    // 用真实 dt 归一化到 60fps，30fps / 120fps 的归位时间一致
    var now = (typeof t === "number" && t > 0) ? t : performance.now();
    var dt = this._last ? Math.min(0.1, (now - this._last) / 1000) : 1 / 60;
    this._last = now;
    var kSlow = 1 - Math.pow(1 - this.smooth, dt * 60);
    var kFast = 1 - Math.pow(1 - this.smoothMouse, dt * 60);

    var mx = this.mouse.x, my = this.mouse.y;
    var R = this.mouseR, R2 = R * R, push = this.mousePush;

    for (i = 0; i < this.parts.length; i++) {
      p = this.parts[i];

      var tgt = p.alive ? 1 : 0;
      p.a += (tgt - p.a) * 0.06;
      if (p.a < 0.01 && !p.alive) continue;

      // 极缓的目标点漂移，避免整片死住
      var wob = Math.sin(now * 0.0011 + p.seed) * 0.5;
      var wob2 = Math.cos(now * 0.0009 + p.seed * 1.7) * 0.5;

      // 慢通道：缓缓靠向字形上的目标点
      p.x += (p.tx + wob - p.x) * kSlow;
      p.y += (p.ty + wob2 - p.y) * kSlow;

      // 快通道：鼠标把粒子拨开，松手后自己收回
      var ox = 0, oy = 0;
      var ddx = p.x - mx, ddy = p.y - my;
      var d2 = ddx * ddx + ddy * ddy;
      if (d2 < R2) {
        var d = Math.sqrt(d2) || 1;
        var f = 1 - d / R;
        f = f * f;                       // 边缘过渡更柔和
        ox = (ddx / d) * f * push;
        oy = (ddy / d) * f * push;
      }
      p.ox += (ox - p.ox) * kFast;
      p.oy += (oy - p.oy) * kFast;

      ctx.fillStyle = "rgba(" + this.color + "," + (this.base * p.a) + ")";
      ctx.fillRect(p.x + p.ox, p.y + p.oy, p.size, p.size);
    }
  };

  ParticleText.prototype.destroy = function () {
    this.running = false;
    this._stop();
  };

  return ParticleText;
})();
