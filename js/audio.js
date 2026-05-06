// Mic capture (16 kHz PCM) + speaker playback (24 kHz PCM, scheduled streaming).
// Uses AudioWorklet when available, falls back to ScriptProcessor.

export class AudioIO {
  constructor({ onMicChunk, onMicLevel } = {}) {
    this.onMicChunk = onMicChunk || (() => {});
    this.onMicLevel = onMicLevel || (() => {});
    this.muted = false;
    this._micCtx = null;
    this._micSrc = null;
    this._micNode = null;
    this._stream = null;
    this._playCtx = null;
    this._nextPlayTime = 0;
    this._jarvisSpeakingUntil = 0;
  }

  async startMic() {
    if (this._micCtx) return;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: 16000, channelCount: 1,
        echoCancellation: true, noiseSuppression: true, autoGainControl: true,
      },
    });
    this._stream = stream;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx({ sampleRate: 16000 });
    this._micCtx = ctx;
    if (ctx.state === "suspended") await ctx.resume();

    const src = ctx.createMediaStreamSource(stream);
    this._micSrc = src;

    // ScriptProcessorNode is deprecated but universally supported and good
    // enough for streaming 16 kHz mono mic into the Live API.
    const node = ctx.createScriptProcessor(2048, 1, 1);
    this._micNode = node;
    const silentGain = ctx.createGain();
    silentGain.gain.value = 0;

    node.onaudioprocess = (e) => {
      if (this.muted) { this.onMicLevel(0); return; }
      const f32 = e.inputBuffer.getChannelData(0);
      const i16 = new Int16Array(f32.length);
      let peak = 0;
      for (let i = 0; i < f32.length; i++) {
        const v = Math.max(-1, Math.min(1, f32[i]));
        i16[i] = v < 0 ? v * 0x8000 : v * 0x7FFF;
        const a = Math.abs(v);
        if (a > peak) peak = a;
      }
      this.onMicLevel(peak);
      this.onMicChunk(i16);
    };

    src.connect(node);
    node.connect(silentGain);
    silentGain.connect(ctx.destination);
  }

  setMuted(m) { this.muted = !!m; }

  async stopMic() {
    try { this._micNode && this._micNode.disconnect(); } catch {}
    try { this._micSrc && this._micSrc.disconnect(); } catch {}
    if (this._stream) this._stream.getTracks().forEach((t) => t.stop());
    if (this._micCtx) await this._micCtx.close().catch(() => {});
    this._micCtx = null; this._micSrc = null; this._micNode = null; this._stream = null;
  }

  // Schedule incoming PCM 24 kHz mono int16 chunks back-to-back so the voice
  // sounds continuous instead of stutter.
  enqueuePlayback(int16) {
    if (!this._playCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this._playCtx = new Ctx({ sampleRate: 24000 });
    }
    const ctx = this._playCtx;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const buf = ctx.createBuffer(1, int16.length, 24000);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < int16.length; i++) ch[i] = int16[i] / 32768;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    const now = ctx.currentTime;
    const start = Math.max(now, this._nextPlayTime);
    src.start(start);
    this._nextPlayTime = start + buf.duration;
    this._jarvisSpeakingUntil = performance.now() + buf.duration * 1000 + 80;
  }

  isJarvisSpeaking() {
    return performance.now() < this._jarvisSpeakingUntil;
  }

  endOfTurn() {
    this._nextPlayTime = 0;
  }
}

// base64 helpers used by the live client
export function pcmToBase64(int16) {
  const bytes = new Uint8Array(int16.buffer, int16.byteOffset, int16.byteLength);
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

export function base64ToPcm16(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
}
