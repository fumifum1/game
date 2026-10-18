// 地球儀(正射図法)を canvas に描く。大陸えらびとガチャで使う
(function () {
  const RAD = Math.PI / 180;
  const ease = (t) => 1 - Math.pow(1 - t, 3);
  const easeSpin = (t) => 1 - Math.pow(1 - t, 4); // 最初は速く、最後はゆっくり止まる

  class Globe {
    constructor(canvas, { lon = 135, lat = 25 } = {}) {
      this.cv = canvas; this.g = canvas.getContext('2d');
      this.lon = lon; this.lat = lat;
      this.fill = () => null;   // 国ごとの色(null なら陸の基本色)
      this.marker = null;       // {lon, lat, t0} 止まった国の波紋
      this.raf = 0; this.anim = null;
      this.theme = 'paper';
      new ResizeObserver(() => this.resize()).observe(canvas);
      this.resize();
    }
    resize() {
      const r = this.cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
      if (!r.width) return;
      this.cv.width = Math.round(r.width * dpr); this.cv.height = Math.round(r.height * dpr);
      this.draw();
    }
    project(lon, lat) {
      const l = (lon - this.lon) * RAD, p = lat * RAD, p0 = this.lat * RAD;
      const cp = Math.cos(p), x = cp * Math.sin(l), y = Math.cos(p0) * Math.sin(p) - Math.sin(p0) * cp * Math.cos(l);
      const vis = Math.sin(p0) * Math.sin(p) + Math.cos(p0) * cp * Math.cos(l);
      return [x, y, vis];
    }
    draw() {
      const { g, cv } = this, W = cv.width, H = cv.height;
      if (!W) return;
      const R = Math.min(W, H) / 2 - 3 * (W / 300), cx = W / 2, cy = H / 2;
      const night = this.theme === 'night';
      g.clearRect(0, 0, W, H);
      // 海
      const sea = g.createRadialGradient(cx - R * 0.35, cy - R * 0.35, R * 0.1, cx, cy, R);
      sea.addColorStop(0, night ? '#2b4a78' : '#5d86b8'); sea.addColorStop(1, night ? '#0d1a33' : '#1f3a5f');
      g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fillStyle = sea; g.fill();
      // 経線・緯線
      g.save(); g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.clip();
      g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = Math.max(1, W / 400);
      const line = (pts) => {
        g.beginPath(); let pen = false;
        for (const [lo, la] of pts) {
          const [x, y, v] = this.project(lo, la);
          if (v < 0) { pen = false; continue; }
          pen ? g.lineTo(cx + x * R, cy - y * R) : g.moveTo(cx + x * R, cy - y * R); pen = true;
        }
        g.stroke();
      };
      for (let lo = -180; lo < 180; lo += 30) line(Array.from({ length: 37 }, (_, i) => [lo, -90 + i * 5]));
      for (let la = -60; la <= 60; la += 30) line(Array.from({ length: 73 }, (_, i) => [-180 + i * 5, la]));
      // 陸(裏側の点は地平線へ寄せて塗る)
      g.lineJoin = 'round';
      for (const f of window.GLOBE_DATA) {
        const color = this.fill(f) || (night ? '#3a4a66' : '#f3ead6');
        g.beginPath();
        let any = false;
        for (const r of f.r) {
          let front = 0;
          const pts = [];
          for (let i = 0; i < r.length; i += 2) {
            let [x, y, v] = this.project(r[i], r[i + 1]);
            if (v > 0) front++;
            else { const n = Math.hypot(x, y) || 1; x /= n; y /= n; }
            pts.push(cx + x * R, cy - y * R);
          }
          if (!front) continue;
          any = true;
          g.moveTo(pts[0], pts[1]);
          for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
          g.closePath();
        }
        if (!any) continue;
        g.fillStyle = color; g.fill('evenodd');
        g.strokeStyle = night ? 'rgba(217,180,74,0.35)' : 'rgba(42,36,32,0.35)'; g.lineWidth = Math.max(0.6, W / 600); g.stroke();
      }
      // 止まった国の波紋
      if (this.marker) {
        const [x, y, v] = this.project(this.marker.lon, this.marker.lat);
        if (v > 0) {
          const t = ((performance.now() - this.marker.t0) / 1000) % 1.2 / 1.2;
          g.strokeStyle = `rgba(240,200,96,${1 - t})`; g.lineWidth = W / 90;
          g.beginPath(); g.arc(cx + x * R, cy - y * R, R * (0.05 + t * 0.25), 0, Math.PI * 2); g.stroke();
          g.fillStyle = '#f0c860'; g.beginPath(); g.arc(cx + x * R, cy - y * R, W / 70, 0, Math.PI * 2); g.fill();
        }
      }
      g.restore();
      // 立体感(光と縁)
      const shine = g.createRadialGradient(cx - R * 0.45, cy - R * 0.5, 0, cx - R * 0.3, cy - R * 0.3, R * 1.1);
      shine.addColorStop(0, 'rgba(255,255,255,0.35)'); shine.addColorStop(0.4, 'rgba(255,255,255,0)'); shine.addColorStop(1, 'rgba(0,0,0,0.28)');
      g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fillStyle = shine; g.fill();
      g.lineWidth = Math.max(2, W / 110); g.strokeStyle = night ? '#d9b44a' : '#2a2420'; g.stroke();
    }
    loop() {
      cancelAnimationFrame(this.raf);
      const step = (now) => {
        let more = false;
        if (this.anim) {
          const a = this.anim, t = Math.min(1, (now - a.t0) / a.ms), e = a.ease(t);
          this.lon = a.lon0 + (a.lon1 - a.lon0) * e; this.lat = a.lat0 + (a.lat1 - a.lat0) * e;
          if (t >= 1) { this.anim = null; a.done?.(); } else more = true;
        }
        if (this.marker) more = true;
        this.draw();
        if (more) this.raf = requestAnimationFrame(step);
      };
      this.raf = requestAnimationFrame(step);
    }
    // 近い向きでくるっと回す
    turnTo(lon, lat, ms = 700, done) {
      let d = ((lon - this.lon) % 360 + 540) % 360 - 180;
      this.anim = { t0: performance.now(), ms, lon0: this.lon, lat0: this.lat, lon1: this.lon + d, lat1: lat, ease, done };
      this.loop();
    }
    // 何周も回ってから止める(ガチャ)
    spinTo(lon, lat, ms = 3200, turns = 3, done) {
      this.marker = null;
      let d = ((lon - this.lon) % 360 + 360) % 360;
      this.anim = { t0: performance.now(), ms, lon0: this.lon, lat0: this.lat, lon1: this.lon + d + 360 * turns, lat1: Math.max(-50, Math.min(55, lat)), ease: easeSpin, done };
      this.loop();
    }
    setMarker(lon, lat) { this.marker = lon == null ? null : { lon, lat, t0: performance.now() }; this.loop(); }
    stop() { cancelAnimationFrame(this.raf); }
  }
  window.Globe = Globe;
})();
