// Main controller — wires HUD + AudioIO + LiveClient + tools together.

import * as Config from "./config.js";
import { HUD }       from "./hud.js";
import { AudioIO, base64ToPcm16 } from "./audio.js";
import { LiveClient } from "./live.js";
import * as Tools     from "./tools.js";

const $  = (s) => document.querySelector(s);
const log = (line, cls = "sys") => {
  const d = document.createElement("div");
  d.className = cls;
  d.textContent = line;
  $("#logView").appendChild(d);
  $("#logView").scrollTop = $("#logView").scrollHeight;
};

const hud = new HUD($("#hud"));
let cfg = Config.load();
let audio = null;
let live = null;
let connecting = false;

// ── Setup overlay ─────────────────────────────────────────────────────────
function showSetup() {
  cfg = Config.load();
  $("#apiKey").value   = cfg.apiKey || "";
  $("#voice").value    = cfg.voice || "Puck";
  $("#userName").value = cfg.userName || "";
  $("#setup").classList.remove("hidden");
}
function hideSetup() { $("#setup").classList.add("hidden"); }

$("#setupSave").addEventListener("click", () => {
  const k = $("#apiKey").value.trim();
  if (!k) { alert("Gemini API key gerekli."); return; }
  cfg.apiKey = k;
  cfg.voice  = $("#voice").value;
  cfg.userName = $("#userName").value.trim();
  Config.save(cfg);
  hideSetup();
  if (!live) startLive();
});

$("#settingsBtn").addEventListener("click", showSetup);

// ── System prompt ────────────────────────────────────────────────────────
function buildSystemInstruction() {
  const now = new Date().toString();
  const userLine = cfg.userName ? `The user's name is ${cfg.userName}.\n` : "";
  return (
    `[CURRENT DATE & TIME]\nRight now it is: ${now}\n` +
    `Use this for any time-relative answers.\n\n` +
    Tools.memoryForPrompt() +
    userLine +
    `You are JARVIS, an efficient personal assistant in the spirit of Tony ` +
    `Stark's. Speak naturally, briefly, with a warm formal tone. Address the ` +
    `user as "sir" or by name if given. Use tools when needed; do not ` +
    `narrate that you're using them. Match the user's language (Turkish when ` +
    `they speak Turkish).`
  );
}

// ── Mic button ────────────────────────────────────────────────────────────
$("#micBtn").addEventListener("click", () => {
  if (!audio) return;
  audio.muted = !audio.muted;
  $("#micBtn").classList.toggle("muted", audio.muted);
  $("#micBtn").textContent = audio.muted ? "🔇 MUTED" : "🎙 MIC";
  hud.setState(audio.muted ? "muted" : "listening");
});

// ── Text input ────────────────────────────────────────────────────────────
function sendText() {
  const t = $("#textInput").value.trim();
  if (!t || !live) return;
  log(`You: ${t}`, "me");
  live.sendUserText(t);
  hud.setState("thinking");
  $("#textInput").value = "";
}
$("#sendBtn").addEventListener("click", sendText);
$("#textInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendText();
});

// ── Live session ──────────────────────────────────────────────────────────
async function startLive() {
  if (connecting) return;
  cfg = Config.load();
  if (!cfg.apiKey) { showSetup(); return; }
  connecting = true;
  hud.setState("connecting");
  log("SYS: Connecting...", "sys");

  audio = new AudioIO({
    onMicChunk: (chunk) => live && live.sendMicChunk(chunk),
    onMicLevel: (lvl) => hud.pushAmplitude(lvl * 4),
  });

  live = new LiveClient({
    apiKey: cfg.apiKey,
    model: cfg.model,
    voiceName: cfg.voice,
  });

  live
    .on("setupComplete", async () => {
      log("SYS: J.A.R.V.I.S online.", "sys");
      try {
        await audio.startMic();
      } catch (e) {
        log(`ERR: Mic izni alinamadi: ${e.message || e}`, "err");
        hud.setState("error");
        return;
      }
      hud.setState("listening");
    })
    .on("audio", (b64) => {
      const pcm = base64ToPcm16(b64);
      audio.enqueuePlayback(pcm);
      hud.setState("speaking");
      // Approximate amplitude from chunk
      let peak = 0;
      for (let i = 0; i < pcm.length; i += 64) {
        const v = Math.abs(pcm[i] / 32768);
        if (v > peak) peak = v;
      }
      hud.pushAmplitude(peak * 1.4);
    })
    .on("inputTranscript", (t) => log(`You: ${t}`, "me"))
    .on("outputTranscript", (t) => log(`Jarvis: ${t}`, "jrv"))
    .on("turnComplete", () => {
      audio.endOfTurn();
      if (!audio.muted) hud.setState("listening");
    })
    .on("toolCall", async (calls) => {
      hud.setState("thinking");
      const pairs = [];
      for (const c of calls) {
        log(`TOOL: ${c.name} ${JSON.stringify(c.args || {})}`, "sys");
        try {
          const out = await Tools.dispatch(c.name, c.args || {});
          pairs.push([c, out]);
        } catch (e) {
          pairs.push([c, `error: ${e.message || e}`]);
        }
      }
      live.sendToolResponses(pairs);
    })
    .on("error", (msg) => {
      log(`ERR: ${msg}`, "err");
      hud.setState("error");
      scheduleReconnect();
    })
    .on("closed", (code, reason) => {
      log(`SYS: closed (${code}) ${reason || ""}`, "sys");
      scheduleReconnect();
    });

  live.connect({
    systemInstruction: buildSystemInstruction(),
    tools: Tools.declarations,
  });
  connecting = false;
}

let reconnectTimer = null;
function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    if (audio) await audio.stopMic();
    if (live)  live.close();
    live = null;
    log("SYS: Reconnecting...", "sys");
    startLive();
  }, 3000);
}

// ── Boot ──────────────────────────────────────────────────────────────────
async function boot() {
  // iOS requires the audio context be created/resumed inside a user gesture.
  if (!Config.isConfigured()) {
    showSetup();
  } else {
    showSetup();   // still ask for confirm tap so iOS allows audio
    $("#setupSave").textContent = "START";
  }

  // Register service worker (best-effort)
  if ("serviceWorker" in navigator) {
    try { await navigator.serviceWorker.register("./sw.js"); } catch {}
  }
}

boot();
