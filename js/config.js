// Persisted settings — stored only in the user's localStorage on their device.
const KEY = "jarvis.cfg.v1";

const DEFAULTS = {
  apiKey: "",
  voice: "Puck",
  userName: "",
  model: "models/gemini-2.5-flash-preview-native-audio-dialog",
};

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function save(cfg) {
  localStorage.setItem(KEY, JSON.stringify(cfg));
}

export function isConfigured() {
  return !!load().apiKey;
}
