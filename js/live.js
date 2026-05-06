// Gemini Live (BidiGenerateContent) WebSocket client. Mirrors the Android
// GeminiLiveClient.kt — setup → mic chunks → server audio + tool calls → tool
// responses → server endOfTurn.

import { pcmToBase64 } from "./audio.js";

const URL_BASE =
  "wss://generativelanguage.googleapis.com/ws/" +
  "google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";

export class LiveClient {
  constructor({ apiKey, model, voiceName }) {
    this.apiKey = apiKey;
    this.model = model;
    this.voiceName = voiceName || "Puck";
    this.ws = null;
    this.listeners = {};
  }

  on(ev, fn) { (this.listeners[ev] ||= []).push(fn); return this; }
  _emit(ev, ...args) { (this.listeners[ev] || []).forEach((fn) => fn(...args)); }

  connect({ systemInstruction, tools }) {
    const url = `${URL_BASE}?key=${encodeURIComponent(this.apiKey)}`;
    const ws = new WebSocket(url);
    this.ws = ws;
    ws.binaryType = "arraybuffer";

    ws.onopen = () => {
      const setup = {
        setup: {
          model: this.model,
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: this.voiceName },
              },
            },
          },
          systemInstruction: systemInstruction
            ? { parts: [{ text: systemInstruction }] }
            : undefined,
          tools: tools && tools.length ? tools : undefined,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
      };
      ws.send(JSON.stringify(setup));
    };

    ws.onmessage = async (ev) => {
      let text;
      if (ev.data instanceof ArrayBuffer) {
        text = new TextDecoder().decode(new Uint8Array(ev.data));
      } else if (ev.data instanceof Blob) {
        text = await ev.data.text();
      } else {
        text = ev.data;
      }
      let msg;
      try { msg = JSON.parse(text); } catch { return; }
      this._handle(msg);
    };

    ws.onerror = (e) => this._emit("error", "websocket error");
    ws.onclose  = (e) => this._emit("closed", e.code, e.reason);
  }

  _handle(msg) {
    if (msg.setupComplete !== undefined) {
      this._emit("setupComplete");
      return;
    }
    const sc = msg.serverContent;
    if (sc) {
      const turn = sc.modelTurn;
      if (turn && turn.parts) {
        for (const p of turn.parts) {
          if (p.inlineData && /audio\/pcm/.test(p.inlineData.mimeType || "")) {
            this._emit("audio", p.inlineData.data);
          } else if (p.text) {
            this._emit("modelText", p.text);
          }
        }
      }
      if (sc.outputTranscription && sc.outputTranscription.text) {
        this._emit("outputTranscript", sc.outputTranscription.text);
      }
      if (sc.inputTranscription && sc.inputTranscription.text) {
        this._emit("inputTranscript", sc.inputTranscription.text);
      }
      if (sc.turnComplete) this._emit("turnComplete");
      if (sc.interrupted) this._emit("interrupted");
    }
    if (msg.toolCall) {
      const calls = msg.toolCall.functionCalls || [];
      this._emit("toolCall", calls);
    }
  }

  sendMicChunk(int16) {
    if (!this.ws || this.ws.readyState !== 1) return;
    const b64 = pcmToBase64(int16);
    this.ws.send(JSON.stringify({
      realtimeInput: {
        mediaChunks: [{ mimeType: "audio/pcm;rate=16000", data: b64 }],
      },
    }));
  }

  sendUserText(text) {
    if (!this.ws || this.ws.readyState !== 1) return;
    this.ws.send(JSON.stringify({
      clientContent: {
        turns: [{ role: "user", parts: [{ text }] }],
        turnComplete: true,
      },
    }));
  }

  sendToolResponses(pairs) {
    if (!this.ws || this.ws.readyState !== 1) return;
    const functionResponses = pairs.map(([call, output]) => ({
      id: call.id,
      name: call.name,
      response: { output: typeof output === "string" ? output : JSON.stringify(output) },
    }));
    this.ws.send(JSON.stringify({ toolResponse: { functionResponses } }));
  }

  close() {
    try { this.ws && this.ws.close(); } catch {}
    this.ws = null;
  }
}
