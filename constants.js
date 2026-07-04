// ============================================================================
// AI GATEWAY CONFIG + APP-WIDE CONSTANTS
// The API key is no longer hardcoded. User enters their own Groq API key
// inside the Settings panel, and it's stored locally on-device via
// AsyncStorage. Nothing is bundled into the APK.
// ============================================================================

// Sentinel "url" used to represent the built-in Homepage / New Tab screen.
// A tab whose url equals this constant renders the custom Home UI instead
// of mounting a WebView.
export const HOME_URL = 'aibrowser://home';

export const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

export const AVAILABLE_AI_MODELS = [
  { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B (Versatile)' },
  { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B (Fast)' },
  { id: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B' },
  { id: 'gemma2-9b-it', label: 'Gemma2 9B' }
];

// ============================================================================
// AD BLOCKER CONFIG
// Two-layer approach: (1) refuse network requests whose host matches a known
// ad/tracker domain, (2) inject CSS into every loaded page to hide leftover
// ad containers that don't come from a blocked domain (e.g. same-origin
// slots injected by the publisher's own script).
// ============================================================================
export const AD_BLOCK_DOMAINS = [
  'doubleclick.net', 'googlesyndication.com', 'googleadservices.com',
  'adservice.google.com', 'googletagservices.com', 'googletagmanager.com',
  'adnxs.com', 'adsrvr.org', 'taboola.com', 'outbrain.com',
  'popads.net', 'propellerads.com', 'adcolony.com', 'moatads.com',
  'scorecardresearch.com', 'exoclick.com', 'juicyads.com', 'mgid.com',
  'criteo.com', 'pubmatic.com', 'rubiconproject.com', 'openx.net',
  'media.net', 'bidswitch.net', 'yieldmo.com', 'smartadserver.com'
];

export const AD_BLOCK_INJECTED_JS = `
  (function() {
    var style = document.createElement('style');
    style.innerHTML = '[class*="ad-"], [class*="ads-"], [id*="google_ads"], ' +
      '[id*="ad-slot"], [class*="advert"], iframe[src*="doubleclick"], ' +
      'iframe[src*="googlesyndication"], .adsbygoogle, ins.adsbygoogle ' +
      '{ display: none !important; height: 0 !important; }';
    document.head.appendChild(style);
  })();
  true;
`;

// Desktop mode swaps the user-agent but the page still renders at phone
// viewport width — text/columns get clipped like a real desktop site
// squeezed onto a phone. This forces a proper desktop-width viewport so
// scalesPageToFit can zoom it out to fit the screen, same as Chrome's
// "Desktop site" toggle.
export const DESKTOP_VIEWPORT_INJECTED_JS = `
  (function() {
    var meta = document.querySelector('meta[name="viewport"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'viewport';
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', 'width=1024');
  })();
  true;
`;

// ============================================================================
// NIGHT MODE CONTENT INJECTION
// The old approach just set opacity:0.9 on the WebView, which barely changed
// anything — the loaded page itself stayed pure white. This actually darkens
// the page: invert the whole document, then invert media back a second time
// so photos/videos/icons render with normal colors instead of looking like
// a photo negative.
// ============================================================================
export const NIGHT_MODE_INJECTED_JS = `
  (function() {
    var id = '__ai_browser_night_mode_style__';
    if (document.getElementById(id)) return true;
    var style = document.createElement('style');
    style.id = id;
    style.innerHTML =
      'html { background: #121212 !important; filter: invert(1) hue-rotate(180deg) !important; }' +
      'img, video, iframe, svg, picture, canvas { filter: invert(1) hue-rotate(180deg) !important; }';
    document.documentElement.appendChild(style);
  })();
  true;
`;

// Reverses the injection above when night mode is switched back off while a
// page is already loaded (so the user doesn't have to reload the tab).
export const NIGHT_MODE_REMOVE_JS = `
  (function() {
    var existing = document.getElementById('__ai_browser_night_mode_style__');
    if (existing) existing.remove();
  })();
  true;
`;

// ============================================================================
// DOWNLOAD DETECTION
// react-native-webview has no reliable Android hook for "this response is an
// attachment" (that's a native Content-Disposition header check). As a
// practical stand-in, we treat any navigation whose path ends in a known
// non-renderable file extension as a download request instead of a page
// load, matched before any ?query or #hash.
// ============================================================================
export const DOWNLOADABLE_FILE_EXTENSIONS = [
  'pdf', 'zip', 'rar', '7z', 'tar', 'gz', 'apk', 'exe', 'msi', 'dmg',
  'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'csv', 'txt', 'rtf',
  'mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a',
  'mp4', 'mkv', 'avi', 'mov', 'webm', '3gp',
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg',
  'json', 'xml'
];

const DOWNLOAD_EXTENSION_PATTERN = new RegExp(`\\.(${DOWNLOADABLE_FILE_EXTENSIONS.join('|')})$`, 'i');

export const isLikelyDownloadUrl = (rawUrl) => {
  try {
    const withoutHash = rawUrl.split('#')[0];
    const pathOnly = withoutHash.split('?')[0];
    return DOWNLOAD_EXTENSION_PATTERN.test(pathOnly);
  } catch {
    return false;
  }
};
