# Billions Neon — Avatar Game (with Proxy & Local Fallback)

- X avatarını `/api/avatar?handle=...` proxy route ile indirir (CORS sorunsuz).
- Yerel dosya yükleme fallback'i vardır.
- `public/billions-glasses.png` gözlüğü slider'larla hizala, karakter olarak kullan.

## Kurulum
```bash
npm install
npm run dev
# http://localhost:3000
```

## Sorun Giderme
- Handle'ı @ olmadan gir.
- `Use local image` kutusunu işaretleyip kendi görselini yükleyerek test et.
- Sunucu loglarına (Vercel/terminal) bak: `/api/avatar` 404/500 veriyorsa handle geçersizdir veya unavatar yanıt vermiyordur.


## Screens
- Intro: avatar & glasses setup
- Play: arcade
- Game Over: share on X, restart, back to intro
