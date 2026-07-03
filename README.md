# AI Browser — Setup (Mobile-only workflow)

## 1. Repo bana
- Ye poora `ai-browser` folder GitHub repo me push kar (GitHub app se mobile se, jaise tu normal karta hai).

## 2. Backend deploy (Vercel)
- `api/ask.js` ko ek Vercel project me daal (root me `api/` folder ho toh Vercel usko auto serverless function bana dega).
- Vercel → Project Settings → Environment Variables → `GROQ_API_KEY` add kar (Groq Console se free key le: console.groq.com).
- Deploy hone ke baad URL milega jaise `https://your-app.vercel.app`.
- `App.js` me line 20 pe `AI_ENDPOINT` ko `https://your-app.vercel.app/api/ask` se replace kar.

## 3. App build (bina PC ke)
- Naya dependency add hua hai: `react-native-view-shot` (tab thumbnails ke liye). Build/dev se pehle:
  - `npx expo install react-native-view-shot` (ya seedha `npm install` — package.json me already add hai)
- Mobile pe Expo Go se local test kar sakta hai:
  - `npx expo start` — but WebView tabs/injectedJavaScript Expo Go me kabhi kabhi glitch karte hain, isliye final build EAS se le.
- **EAS Build (cloud, PC nahi chahiye):**
  1. `npm install -g eas-cli` (ya `npx eas-cli`)
  2. `eas login`
  3. `eas build:configure`
  4. `eas build -p android --profile preview`
  5. Build cloud pe hoga, download link milega — APK seedha phone pe install ho jaayega.

## 4. Kya kaam karta hai (Phase 2 — polished)
- **Multi-tab browsing** — URL bar, back/forward/refresh, home button, thin animated loading progress bar.
- **Tab switcher grid** — 2-column live thumbnail previews (Chrome-style) instead of a plain list, captured via `react-native-view-shot` whenever you switch/open the tab tray.
- **Pull-to-refresh** — swipe down on any page to reload (native WebView `pullToRefreshEnabled`).
- **TL;DR button** — auto-appears once you scroll ~25% into a long article; tap it for a 3-5 bullet AI summary (Groq).
- **Bookmarks** — star toggle on/off directly from URL bar, persisted via AsyncStorage, swipe-to-remove list.
- **History** — every page visit auto-logged with timestamp, tap to reopen, clear-all option.
- **✨ AI panel with 4 modes** (Groq `llama-3.3-70b-versatile`, via your Vercel backend):
  - **Ask** — free-form question about the current page, with page text as context.
  - **Explain** — detailed mobile-friendly breakdown of what the page is about.
  - **TL;DR** — 3-5 bullet quick summary, triggered by scroll or manually.
  - **Find Q&A** — scans the page for FAQs/quiz/form questions and answers each one.
- **App icon + splash screen** — custom branded assets in `/assets` (`icon.png`, `splash.png`, `adaptive-icon.png`). Placeholder logo generated for now — drop your own PNGs at the same paths/sizes to rebrand any time, no other code changes needed.
- Error states handled: failed page loads (retry button), AI backend unreachable (clear error message instead of silent fail).
- Long-press the ✨ AI button to open a blank AI panel without auto-running a mode.

## 5. Next steps (agar aage badhana ho)
- Dark mode toggle
- Multiple AI models switch karne ka option (Groq ke andar hi — llama, mixtral, etc.)
- "Dev Mode" tab — raw GET/POST request tester
- Ad-block / content injection via `injectedJavaScript`
- Highlight the exact answer snippet on-page for "Find Q&A" mode
