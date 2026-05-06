// Persisted settings — stored only in the user's localStorage on their device.
const KEY = "jarvis.cfg.v1";

// `model` lives here (not in localStorage) so model upgrades roll out to all
// users on the next deploy without anyone needing to clear settings.
const DEFAULTS = {
  apiKey: "",
  voice: "Puck",
  userName: "",
};

const MODEL = "models/gemini-2.5-flash-native-audio-preview-12-2025";

export function load() {
  let saved = {};
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) saved = JSON.parse(raw);
  } catch {}
  return { ...DEFAULTS, ...saved, model: MODEL };
}

export function save(cfg) {
  // Persist only user-facing settings; never the model name.
  const { apiKey = "", voice = "Puck", userName = "" } = cfg;
  localStorage.setItem(KEY, JSON.stringify({ apiKey, voice, userName }));
}

export function isConfigured() {
  return !!load().apiKey;
}
