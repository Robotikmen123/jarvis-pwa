// Tool declarations + dispatcher. iOS Safari is the constraint here:
// most "open this app" calls go through URL schemes (https://wa.me/, tel:, sms:)
// or just opening Google search/YouTube in a new tab.

export const declarations = [{
  functionDeclarations: [
    {
      name: "web_search",
      description:
        "Search Google for the user's query. Use whenever the user asks to look something up, find info, or research.",
      parameters: {
        type: "OBJECT",
        properties: { query: { type: "STRING", description: "Search query" } },
        required: ["query"],
      },
    },
    {
      name: "weather_report",
      description: "Fetch current weather for a city via wttr.in (no API key).",
      parameters: {
        type: "OBJECT",
        properties: {
          city: { type: "STRING", description: "City name, e.g. Istanbul" },
        },
      },
    },
    {
      name: "youtube_video",
      description:
        "Open YouTube. Use 'play' to open a video by query, or 'open_channel' " +
        "to open a channel page.",
      parameters: {
        type: "OBJECT",
        properties: {
          action: { type: "STRING", description: "play | open_channel (default: play)" },
          query:   { type: "STRING", description: "Search query for play" },
          channel: { type: "STRING", description: "Channel name or @handle for open_channel" },
        },
      },
    },
    {
      name: "send_message",
      description:
        "Open a draft message in the user's messaging app. Supports WhatsApp, " +
        "SMS, and email via URL schemes.",
      parameters: {
        type: "OBJECT",
        properties: {
          channel: { type: "STRING", description: "whatsapp | sms | email" },
          to:      { type: "STRING", description: "Phone number (with country code) or email" },
          message: { type: "STRING", description: "Message body" },
          subject: { type: "STRING", description: "Subject (email only)" },
        },
        required: ["channel", "to", "message"],
      },
    },
    {
      name: "save_memory",
      description: "Persist a fact about the user to long-term memory on this device.",
      parameters: {
        type: "OBJECT",
        properties: {
          key:   { type: "STRING", description: "Short label, e.g. 'favorite_color'" },
          value: { type: "STRING", description: "The value to remember" },
        },
        required: ["key", "value"],
      },
    },
    {
      name: "open_url",
      description: "Open an arbitrary URL in a new browser tab.",
      parameters: {
        type: "OBJECT",
        properties: { url: { type: "STRING" } },
        required: ["url"],
      },
    },
  ],
}];

const MEM_KEY = "jarvis.memory.v1";

function loadMemory() {
  try { return JSON.parse(localStorage.getItem(MEM_KEY) || "{}"); }
  catch { return {}; }
}
function saveMemory(m) { localStorage.setItem(MEM_KEY, JSON.stringify(m)); }

export function memoryForPrompt() {
  const m = loadMemory();
  const keys = Object.keys(m);
  if (!keys.length) return "";
  const lines = keys.map((k) => `  - ${k}: ${m[k]}`);
  return "[LONG-TERM MEMORY ABOUT THE USER]\n" + lines.join("\n") + "\n\n";
}

function openUrl(url) {
  // window.open with _blank is the closest thing to "launch app" in PWA.
  // Safari opens it in the foreground browser tab (or app, for known schemes).
  try { window.open(url, "_blank"); } catch {}
}

async function weather(city) {
  const c = (city || "").trim() || "Istanbul";
  try {
    const r = await fetch(`https://wttr.in/${encodeURIComponent(c)}?format=j1`);
    const j = await r.json();
    const cc = j.current_condition && j.current_condition[0];
    if (!cc) return `Hava bilgisi alinamadi: ${c}.`;
    const temp = cc.temp_C;
    const desc = (cc.weatherDesc && cc.weatherDesc[0] && cc.weatherDesc[0].value) || "";
    return `${c}: ${temp}°C, ${desc}.`;
  } catch (e) {
    return `Hava servisi yanitlamadi: ${e.message || e}.`;
  }
}

export async function dispatch(name, args) {
  switch (name) {
    case "web_search": {
      const q = (args && args.query) || "";
      openUrl(`https://www.google.com/search?q=${encodeURIComponent(q)}`);
      return `Google'da arandi: ${q}`;
    }
    case "weather_report":
      return await weather(args && args.city);
    case "youtube_video": {
      const action = (args && args.action) || "play";
      if (action === "open_channel") {
        const ch = (args && args.channel) || "";
        const handle = ch.startsWith("@") ? ch : ch;
        openUrl(`https://www.youtube.com/results?search_query=${encodeURIComponent(handle)}&sp=EgIQAg%253D%253D`);
        return `Kanal aciliyor: ${ch}`;
      }
      const q = (args && args.query) || "";
      openUrl(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`);
      return `YouTube'da arandi: ${q}`;
    }
    case "send_message": {
      const ch = (args && args.channel) || "";
      const to = (args && args.to) || "";
      const msg = (args && args.message) || "";
      if (ch === "whatsapp") {
        const num = to.replace(/[^\d+]/g, "");
        openUrl(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`);
        return `WhatsApp acildi: ${num}`;
      }
      if (ch === "sms") {
        // iOS prefers `sms:NUM&body=...`; Android prefers `sms:NUM?body=...`
        // The ampersand form works on both.
        const sep = /iPhone|iPad|iPod/i.test(navigator.userAgent) ? "&" : "?";
        openUrl(`sms:${to}${sep}body=${encodeURIComponent(msg)}`);
        return `SMS taslagi: ${to}`;
      }
      if (ch === "email") {
        const subj = (args && args.subject) || "";
        openUrl(`mailto:${to}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(msg)}`);
        return `E-posta taslagi: ${to}`;
      }
      return `Bilinmeyen kanal: ${ch}`;
    }
    case "save_memory": {
      const key = (args && args.key) || "";
      const val = (args && args.value) || "";
      if (!key) return "Anahtar yok.";
      const m = loadMemory();
      m[key] = val;
      saveMemory(m);
      return `Hafizaya kaydedildi: ${key} = ${val}`;
    }
    case "open_url": {
      const u = (args && args.url) || "";
      openUrl(u);
      return `Acildi: ${u}`;
    }
    default:
      return `Bilinmeyen tool: ${name}`;
  }
}
