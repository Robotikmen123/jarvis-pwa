// Canvas-based J.A.R.V.I.S HUD. Direct port of the Android HudRenderer.kt.
// State: idle | connecting | listening | thinking | speaking | muted | error

const COLORS = {
  idle:       "#3A8A9A",
  connecting: "#FFCC00",
  listening:  "#00D4FF",
  thinking:   "#FF6B00",
  speaking:   "#00FF88",
  muted:      "#FF3366",
  error:      "#FF3355",
};

function hexToRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export class HUD {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext("2d");
    this.state = "idle";
    this.tick = 0;
    this.pulse = 0;
    this.scanAngle = 0;
    this.ringAngles = [0, 72, 144, 216, 288];
    this.waveform = new Float32Array(32);
    this.waveIdx = 0;
    this.sparks = [];
    this.cx = 0; this.cy = 0; this.baseR = 0;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this._resize = this._resize.bind(this);
    window.addEventListener("resize", this._resize);
    this._resize();
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  _resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.cv.width  = Math.floor(w * this.dpr);
    this.cv.height = Math.floor(h * this.dpr);
    this.cv.style.width  = w + "px";
    this.cv.style.height = h + "px";
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.W = w; this.H = h;
  }

  setState(s) { this.state = s; }
  pushAmplitude(v) {
    this.waveform[this.waveIdx % 32] = Math.max(0.05, Math.min(1, v));
    this.waveIdx++;
  }

  _advance() {
    this.tick++;
    this.pulse = (Math.sin(this.tick * 0.05) + 1) * 0.5;
    const spd = this.state === "speaking" ? 3.5 : 1;
    this.ringAngles[0] = (this.ringAngles[0] + 0.6 * spd) % 360;
    this.ringAngles[1] = (this.ringAngles[1] - 1.0 * spd + 360) % 360;
    this.ringAngles[2] = (this.ringAngles[2] + 1.7 * spd) % 360;
    this.ringAngles[3] = (this.ringAngles[3] - 0.4 * spd + 360) % 360;
    this.ringAngles[4] = (this.ringAngles[4] + 2.3 * spd) % 360;
    this.scanAngle = (this.scanAngle + (this.state === "thinking" ? 4 : 1.8)) % 360;

    const active = this.state === "listening" || this.state === "speaking";
    if (!active) {
      this.waveform[this.waveIdx % 32] = (this.waveform[this.waveIdx % 32] || 0) * 0.8;
      this.waveIdx++;
    }

    if (this.state === "speaking" && this.tick % 2 === 0 && this.baseR > 0) {
      for (let i = 0; i < 2; i++) {
        const ang = Math.random() * Math.PI * 2;
        const sr = this.baseR * 0.54;
        this.sparks.push({
          x: this.cx + Math.cos(ang) * sr,
          y: this.cy + Math.sin(ang) * sr,
          vx: Math.cos(ang) * (3 + Math.random() * 7),
          vy: Math.sin(ang) * (3 + Math.random() * 7) - 1,
          life: 1,
        });
      }
    }
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.x += s.vx; s.y += s.vy; s.vy += 0.25;
      s.life -= 0.04;
      if (s.life <= 0) this.sparks.splice(i, 1);
    }
  }

  _loop() {
    this._advance();
    this._draw();
    requestAnimationFrame(this._loop);
  }

  _draw() {
    const { ctx, W, H } = this;
    const col = COLORS[this.state] || COLORS.idle;
    const [r, g, b] = hexToRgb(col);
    this.cx = W / 2;
    this.cy = H * 0.40;
    this.baseR = Math.min(W, H) * 0.30;

    ctx.fillStyle = "#00060A";
    ctx.fillRect(0, 0, W, H);

    this._grid(r, g, b);
    this._corners(col, r, g, b);
    this._topBar(r, g, b);
    this._sideData(r, g, b);
    this._scanSweep(r, g, b);
    this._tickMarks(r, g, b);
    this._rings(r, g, b);
    this._core(col, r, g, b);
    this._waveform(r, g, b);
    this._sparks(r, g, b);
    this._stateLabel(col, r, g, b);
  }

  _rgba(r, g, b, a) { return `rgba(${r},${g},${b},${a})`; }

  _grid(r, g, b) {
    const { ctx, W, H } = this;
    ctx.strokeStyle = this._rgba(r, g, b, 0.06);
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 44) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
    for (let y = 0; y <= H; y += 44) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.stroke();
  }

  _corners(col, r, g, b) {
    const { ctx, W, H } = this;
    const len = 44, pad = 20;
    ctx.strokeStyle = this._rgba(r, g, b, 0.82);
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(pad, pad + len); ctx.lineTo(pad, pad); ctx.lineTo(pad + len, pad);
    ctx.moveTo(W - pad - len, pad); ctx.lineTo(W - pad, pad); ctx.lineTo(W - pad, pad + len);
    ctx.moveTo(pad, H - pad - len); ctx.lineTo(pad, H - pad); ctx.lineTo(pad + len, H - pad);
    ctx.moveTo(W - pad - len, H - pad); ctx.lineTo(W - pad, H - pad); ctx.lineTo(W - pad, H - pad - len);
    ctx.stroke();
    ctx.fillStyle = col;
    for (const [x, y] of [[pad, pad], [W - pad, pad], [pad, H - pad], [W - pad, H - pad]]) {
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = this._rgba(r, g, b, 0.4);
    ctx.font = "10px ui-monospace, monospace";
    ctx.textAlign = "left";  ctx.fillText("00°N 00°E", pad + 6, pad + 16);
    ctx.textAlign = "right"; ctx.fillText("MARK V", W - pad - 6, pad + 16);
  }

  _topBar(r, g, b) {
    const { ctx, W } = this;
    ctx.strokeStyle = this._rgba(r, g, b, 0.32); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, 56); ctx.lineTo(W, 56); ctx.stroke();
    ctx.fillStyle = this._rgba(r, g, b, 0.85);
    ctx.font = "bold 16px ui-monospace, monospace";
    ctx.textAlign = "left";  ctx.fillText("J.A.R.V.I.S", 70, 38);
    ctx.fillStyle = this._rgba(r, g, b, 0.55);
    ctx.font = "11px ui-monospace, monospace";
    ctx.textAlign = "right"; ctx.fillText("GEMINI 2.5  ●  ACTIVE", W - 70, 38);
  }

  _sideData(r, g, b) {
    const { ctx, W } = this;
    ctx.fillStyle = this._rgba(r, g, b, 0.35);
    ctx.font = "10px ui-monospace, monospace";
    const mid = this.cy - 10;
    const left  = ["NEURAL LINK", "SIG: ████░░", "LATENCY:--ms", "MEM:ONLINE"];
    const proc = 40 + Math.floor(this.pulse * 60);
    const right = ["AUDIO  I/O", `PROC: ${proc}%`, "TOOLS: ARMED", "VER: 2.5F"];
    ctx.textAlign = "left";
    left.forEach((s, i) => ctx.fillText(s, 22, mid + i * 18));
    ctx.textAlign = "right";
    right.forEach((s, i) => ctx.fillText(s, W - 22, mid + i * 18));
  }

  _scanSweep(r, g, b) {
    if (this.state !== "thinking" && this.state !== "connecting") return;
    const { ctx } = this;
    const grad = ctx.createConicGradient(this.scanAngle * Math.PI / 180, this.cx, this.cy);
    grad.addColorStop(0, this._rgba(r, g, b, 0));
    grad.addColorStop(0.07, this._rgba(r, g, b, 0.25));
    grad.addColorStop(0.15, this._rgba(r, g, b, 0));
    grad.addColorStop(1, this._rgba(r, g, b, 0));
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(this.cx, this.cy, this.baseR * 2.3, 0, Math.PI * 2); ctx.fill();
  }

  _tickMarks(r, g, b) {
    const { ctx } = this;
    const tickR = this.baseR * 2.18;
    ctx.lineWidth = 1;
    for (let i = 0; i < 72; i++) {
      const ang = (i * 5 - 90) * Math.PI / 180;
      const major = i % 9 === 0;
      const inner = tickR - (major ? 12 : 4);
      ctx.strokeStyle = this._rgba(r, g, b, major ? 0.75 : 0.18);
      ctx.beginPath();
      ctx.moveTo(this.cx + Math.cos(ang) * inner, this.cy + Math.sin(ang) * inner);
      ctx.lineTo(this.cx + Math.cos(ang) * (tickR + 1), this.cy + Math.sin(ang) * (tickR + 1));
      ctx.stroke();
    }
  }

  _rings(r, g, b) {
    const { ctx } = this;
    const rings = [
      { rad: this.baseR * 2.15, segs: 8,  sweep: 28,  alpha: 0.25, w: 1.2, ai: 0 },
      { rad: this.baseR * 1.85, segs: 6,  sweep: 48,  alpha: 0.34, w: 1.8, ai: 1 },
      { rad: this.baseR * 1.62, segs: 10, sweep: 20,  alpha: 0.42, w: 1.4, ai: 2 },
      { rad: this.baseR * 1.40, segs: 4,  sweep: 72,  alpha: 0.55, w: 2.5, ai: 3 },
      { rad: this.baseR * 1.20, segs: 3,  sweep: 108, alpha: 0.62, w: 3.2, ai: 4 },
    ];
    for (const ring of rings) {
      ctx.strokeStyle = this._rgba(r, g, b, ring.alpha);
      ctx.lineWidth = ring.w;
      const segAng = 360 / ring.segs;
      for (let s = 0; s < ring.segs; s++) {
        const start = (this.ringAngles[ring.ai] + s * segAng) * Math.PI / 180;
        const end = start + ring.sweep * Math.PI / 180;
        ctx.beginPath();
        ctx.arc(this.cx, this.cy, ring.rad, start, end);
        ctx.stroke();
      }
    }
  }

  _core(col, r, g, b) {
    const { ctx } = this;
    // Glow layers
    for (let l = 6; l >= 1; l--) {
      const lr = this.baseR * (0.60 + l * 0.14);
      ctx.fillStyle = this._rgba(r, g, b, (0.015 + l * 0.018 + this.pulse * 0.03));
      ctx.beginPath(); ctx.arc(this.cx, this.cy, lr, 0, Math.PI * 2); ctx.fill();
    }
    const coreR = this.baseR * (0.54 + this.pulse * 0.04);
    const grad = ctx.createRadialGradient(this.cx, this.cy, 0, this.cx, this.cy, coreR);
    grad.addColorStop(0,    `rgba(${Math.min(255, r + 100)},${Math.min(255, g + 100)},${Math.min(255, b + 100)},1)`);
    grad.addColorStop(0.45, this._rgba(r, g, b, 1));
    grad.addColorStop(1,    this._rgba(r >> 1, g >> 1, b >> 1, 0.78));
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(this.cx, this.cy, coreR, 0, Math.PI * 2); ctx.fill();

    ctx.strokeStyle = col; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.arc(this.cx, this.cy, coreR, 0, Math.PI * 2); ctx.stroke();

    // Hex
    ctx.strokeStyle = this._rgba(r, g, b, 0.42); ctx.lineWidth = 1;
    const hexR = coreR * 0.52;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i * 60 - 30 + this.ringAngles[0] * 0.3) * Math.PI / 180;
      const x = this.cx + Math.cos(a) * hexR, y = this.cy + Math.sin(a) * hexR;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.stroke();
    ctx.fillStyle = this._rgba(r, g, b, 0.55);
    for (let i = 0; i < 6; i++) {
      const a = (i * 60 - 30 + this.ringAngles[0] * 0.3) * Math.PI / 180;
      ctx.beginPath();
      ctx.arc(this.cx + Math.cos(a) * hexR, this.cy + Math.sin(a) * hexR, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = this._rgba(r, g, b, 0.65); ctx.lineWidth = 1.5;
    const cr = coreR * 0.19;
    ctx.beginPath();
    ctx.moveTo(this.cx - cr, this.cy); ctx.lineTo(this.cx + cr, this.cy);
    ctx.moveTo(this.cx, this.cy - cr); ctx.lineTo(this.cx, this.cy + cr);
    ctx.stroke();
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath(); ctx.arc(this.cx, this.cy, 3.5, 0, Math.PI * 2); ctx.fill();
  }

  _waveform(r, g, b) {
    const { ctx } = this;
    const waveW = this.baseR * 2;
    const barMax = this.baseR * 0.26;
    const baseY = this.cy + this.baseR * 0.76;
    const startX = this.cx - waveW / 2;
    const slot = waveW / 32;
    ctx.fillStyle = this._rgba(r, g, b, 0.6);
    for (let i = 0; i < 32; i++) {
      const amp = this.waveform[(this.waveIdx + i) % 32];
      const bh = Math.max(1.5, amp * barMax);
      ctx.fillRect(startX + i * slot + 1, baseY - bh, slot - 2, bh * 2);
    }
  }

  _sparks(r, g, b) {
    const { ctx } = this;
    for (const s of this.sparks) {
      ctx.fillStyle = this._rgba(r, g, b, s.life);
      ctx.beginPath();
      ctx.arc(s.x, s.y, Math.max(0.5, 3.5 * s.life), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _stateLabel(col, r, g, b) {
    const { ctx } = this;
    const labels = {
      idle:"STANDBY", connecting:"CONNECTING...", listening:"LISTENING",
      thinking:"PROCESSING", speaking:"RESPONDING", muted:"MUTED", error:"ERROR",
    };
    const text = labels[this.state] || "";
    const y = this.cy + this.baseR * 1.14;
    ctx.fillStyle = col;
    ctx.font = "bold 18px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText(text, this.cx, y);
    const half = ctx.measureText(text).width / 2 + 16;
    ctx.strokeStyle = this._rgba(r, g, b, 0.36); ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.cx - this.baseR * 1.1, y - 5); ctx.lineTo(this.cx - half, y - 5);
    ctx.moveTo(this.cx + half, y - 5); ctx.lineTo(this.cx + this.baseR * 1.1, y - 5);
    ctx.stroke();
  }
}
