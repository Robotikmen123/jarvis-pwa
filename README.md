# JARVIS PWA

iPhone/Android/PC için tarayıcıdan çalışan JARVIS. Ana ekrana eklenince app gibi davranır.

## Özellikler

- Sesli sohbet (Gemini Live, "Puck" sesi default)
- Iron Man HUD animasyonu (Canvas) — PC ve Android'dekiyle aynı
- Tools: web_search, weather_report, youtube_video, send_message, save_memory, open_url
- Çalıştığı her cihazda hafıza (`localStorage`)

## Çalıştırma — yerel test

Static dosyalar, build yok. Tek komut:

```bash
cd JarvisPWA
python -m http.server 8000
```

Tarayıcıdan `http://localhost:8000` aç. Mikrofon izni iste, Gemini API key gir, başla.

> **Not:** Mikrofon HTTPS veya `localhost` ister. Sadece IP üzerinden açarsan Safari/Chrome mic'i bloklar.

## Deploy — Vercel (önerilen, ücretsiz, otomatik HTTPS)

1. https://vercel.com aç, GitHub ile login
2. **Add New → Project → Import Git Repository**
3. Bu klasörü kendi repo'na pushla, oradan import et
   - VEYA: `npx vercel` çalıştır (Vercel CLI), interactive olarak yükler
4. Build settings: **none** — preset olarak "Other" seç
5. Output Directory: `.` (root)
6. Deploy bas
7. `https://jarvis-xxx.vercel.app` linki gelir

## Deploy — GitHub Pages (alternatif)

1. Repo'yu push'la
2. Settings → Pages → Source = `main` branch, folder = `/JarvisPWA`
3. ~1 dakika bekle, `https://USER.github.io/REPO/JarvisPWA/` linkin hazır

## iPhone'a kurma

1. Safari aç (Chrome değil — iOS'ta sadece Safari PWA destekler)
2. Yukarıdaki linki gir
3. Sesli izini ver, Gemini key gir, START
4. Adres çubuğunda **Paylaş** ikonu (kare + ok) → **Ana Ekrana Ekle**
5. İsim "JARVIS" → Ekle
6. Ana ekranda ikon olarak gözüküyor → tıkla → fullscreen açılır

## Android'e kurma

1. Chrome'da linki aç
2. Adres çubuğunda otomatik "Yükle" / "Install" promptu çıkar
3. Veya: ⋮ menü → Uygulamayı Yükle / Install App

## Gemini API key alma

1. https://aistudio.google.com/apikey
2. **Create API Key** → kopyala
3. JARVIS'i ilk açtığında setup ekranına yapıştır

## Güvenlik notu

API key cihazında `localStorage`'da kalır, hiçbir yere yollanmaz. Ama PWA kendi hostname'inden başkalarıyla paylaşılırsa, dikkat: tarayıcı extension veya XSS bug'ı varsa key okunabilir. Kişisel deploy için (kendi hesabın ile Vercel/GitHub Pages) güvenli. Halka açık deploy yapmazsan sıkıntı yok.

## Sınırlamalar (iOS Safari)

- **Background:** PWA arka plana atılınca mic kapanır, Gemini bağlantısı düşer. Açtığın zaman çalışır.
- **Reminder/Alarm:** AlarmManager iOS'ta yok. Notification API var ama PWA arka planda çalışmadığı için zamanlanmış bildirim sınırlı. Hatırlatmalar için takvim app'i kullan.
- **Native uygulama açma:** WhatsApp/SMS/email URL şemaları çalışıyor, ama Spotify gibi şeyler için web link açılır.

## Dosya yapısı

```
JarvisPWA/
├── index.html
├── manifest.webmanifest
├── sw.js                # service worker — offline shell
├── styles.css
├── icon.svg
├── js/
│   ├── app.js           # main controller
│   ├── live.js          # Gemini Live WebSocket
│   ├── audio.js         # mic + speaker
│   ├── hud.js           # Canvas HUD
│   ├── tools.js         # tool dispatcher
│   └── config.js        # localStorage settings
└── icons/
    ├── icon-180.png     # apple-touch
    ├── icon-192.png
    ├── icon-512.png
    └── icon-maskable-512.png
```
