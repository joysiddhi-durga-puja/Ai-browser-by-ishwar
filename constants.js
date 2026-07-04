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
// YOUTUBE AUTO-SKIP-AD
// YouTube's in-video ads are a native player overlay, not a normal blockable
// network request — the video/ad stream itself still has to load. The only
// real fix inside a WebView is to watch for the player's own "Skip Ad"
// button and click it the instant it becomes clickable. Domain-gated so this
// is a no-op (returns immediately) on every non-YouTube page. Guarded by
// window.__aiYtAdSkipInstalled so re-injecting (night mode toggle, desktop
// mode reload, etc.) never stacks a second interval.
// ============================================================================
export const YOUTUBE_AD_SKIP_INJECTED_JS = `
  (function() {
    if (window.__aiYtAdSkipInstalled) { true; return; }
    if (!/(^|\\.)youtube\\.com$/.test(location.hostname)) { true; return; }
    window.__aiYtAdSkipInstalled = true;

    var SKIP_SELECTORS = [
      '.ytp-ad-skip-button',
      '.ytp-ad-skip-button-modern',
      '.ytp-skip-ad-button',
      '.ytp-ad-skip-button-container button',
      'button.ytp-ad-skip-button-modern'
    ];

    function clickSkipIfPresent() {
      for (var i = 0; i < SKIP_SELECTORS.length; i++) {
        var btn = document.querySelector(SKIP_SELECTORS[i]);
        if (btn) { btn.click(); return; }
      }
      // Broader net for when YouTube tweaks its exact class names: any
      // element whose class or aria-label merely contains "skip" (and looks
      // like an ad-skip control, not an unrelated "skip" elsewhere on the
      // page) — restricted to the player container to avoid false hits.
      var player = document.querySelector('.html5-video-player, #movie_player');
      if (player) {
        var loose = player.querySelectorAll('[class*="skip" i], [aria-label*="skip" i]');
        for (var k = 0; k < loose.length; k++) {
          if (loose[k].offsetParent !== null) { loose[k].click(); return; }
        }
      }
      // Last resort: plain "Skip Ad" text link anywhere on the page.
      var candidates = document.querySelectorAll('button, span');
      for (var j = 0; j < candidates.length; j++) {
        var text = (candidates[j].innerText || '').trim().toLowerCase();
        if (text === 'skip ad' || text === 'skip ads') { candidates[j].click(); return; }
      }
    }

    setInterval(clickSkipIfPresent, 600);
  })();
  true;
`;

// ============================================================================
// YOUTUBE SPONSOR-SEGMENT SKIP BUTTON
// YouTube's own pre/mid-roll ads (handled above) are a different thing from
// a creator's own in-video sponsor read ("this video is sponsored by...").
// YouTube has no native skip button for that — it's just part of the video
// file. This uses the community-run SponsorBlock database (the same public
// API the SponsorBlock browser extension itself calls): for the video
// currently playing, it fetches the timestamp ranges people have tagged as
// sponsor/self-promo/interaction-reminder segments. Unlike the ad-skip
// script above, this does NOT auto-skip — it shows a small "Skip Sponsor"
// button in the top-right corner of the player only while playback is
// inside a tagged segment, and only jumps ahead when the person taps it.
// The button disappears again the moment playback leaves the segment (by
// tapping it, or by the person seeking past it themselves). Re-checks the
// URL every 1.5s to notice YouTube's in-app "change video without a real
// page reload" navigation and re-fetch segments for the new video.
// Domain-gated and install-guarded the same way as the ad-skip script.
// ============================================================================
export const YOUTUBE_SPONSOR_SKIP_INJECTED_JS = `
  (function() {
    if (window.__aiYtSponsorSkipInstalled) { true; return; }
    if (!/(^|\\.)youtube\\.com$/.test(location.hostname)) { true; return; }
    window.__aiYtSponsorSkipInstalled = true;

    var currentVideoId = null;
    var segments = [];
    var activeSegmentEnd = null;
    var skipButtonEl = null;

    function getVideoId() {
      var match = location.href.match(/[?&]v=([^&]+)/);
      return match ? match[1] : null;
    }

    function fetchSegments(videoId) {
      var categories = encodeURIComponent(JSON.stringify(['sponsor', 'selfpromo', 'interaction']));
      var url = 'https://sponsor.ajay.app/api/skipSegments?videoID=' + encodeURIComponent(videoId) + '&categories=' + categories;
      fetch(url).then(function(res) {
        return res.ok ? res.json() : [];
      }).then(function(data) {
        segments = (data || []).map(function(item) { return item.segment; });
      }).catch(function() { segments = []; });
    }

    function removeSkipButton() {
      if (skipButtonEl) { skipButtonEl.remove(); skipButtonEl = null; }
      activeSegmentEnd = null;
    }

    function checkForVideoChange() {
      var vid = getVideoId();
      if (vid && vid !== currentVideoId) {
        currentVideoId = vid;
        segments = [];
        removeSkipButton();
        fetchSegments(vid);
      }
    }
    setInterval(checkForVideoChange, 1500);
    checkForVideoChange();

    function showSkipButton(segEnd) {
      activeSegmentEnd = segEnd;
      if (skipButtonEl) return;
      var player = document.querySelector('.html5-video-player, #movie_player');
      if (!player) return;
      var btn = document.createElement('button');
      btn.textContent = 'Skip Sponsor ›';
      btn.style.cssText = 'position:absolute;top:14px;right:14px;z-index:999999;background:rgba(28,28,28,0.85);color:#ffffff;border:none;border-radius:6px;padding:8px 14px;font-size:13px;font-weight:600;cursor:pointer;';
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var video = document.querySelector('video');
        if (video && activeSegmentEnd != null) video.currentTime = activeSegmentEnd;
        removeSkipButton();
      });
      player.appendChild(btn);
      skipButtonEl = btn;
    }

    setInterval(function() {
      var video = document.querySelector('video');
      if (!video || !segments.length) { if (skipButtonEl) removeSkipButton(); return; }
      var t = video.currentTime;
      var inSegment = false;
      for (var i = 0; i < segments.length; i++) {
        var seg = segments[i];
        if (t >= seg[0] && t < seg[1] - 0.3) {
          inSegment = true;
          showSkipButton(seg[1]);
          break;
        }
      }
      if (!inSegment && skipButtonEl) removeSkipButton();
    }, 400);
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
// PAGE QUESTION SCAN (powers the "Auto Answer" floating button)
// Walks every text node looking for lines ending in "?". For each one it
// checks whether the very next element already has a real chunk of text (or
// a filled input) right after it — a rough proxy for "this question already
// has a visible answer nearby".
//
// onLoadEnd fires as soon as the base HTML/document load completes — on
// quiz/form/SPA-style pages the actual question text is often injected by
// JS a moment *after* that event, so a single scan right at load time can
// come back blank even though questions show up on screen a second later.
// To avoid that, the very first call installs a re-usable scan function,
// runs it immediately, then again at 1s and 2.5s while the page settles,
// and finally hooks a debounced MutationObserver so any question content
// that appears later (lazy load, infinite scroll, route change) triggers
// one more scan instead of leaving the button stuck on its first result.
// The install-guard means later calls to this same script (e.g. the
// on-demand re-scan right before an Auto Answer request) just re-run the
// existing scan instead of stacking duplicate observers.
// ============================================================================
export const PAGE_QUESTION_SCAN_JS = `
  (function() {
    if (window.__aiPageScanRun) { window.__aiPageScanRun(); true; return; }

    function runScan() {
      try {
        var bodyText = (document.body && document.body.innerText) || '';
        var total = 0, unanswered = 0;
        var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
        var node;
        while ((node = walker.nextNode())) {
          var t = (node.textContent || '').trim();
          if (t.length > 8 && t.length < 300 && t.slice(-1) === '?') {
            total++;
            var parentEl = node.parentElement;
            var nextEl = parentEl ? parentEl.nextElementSibling : null;
            var nextText = nextEl ? (nextEl.innerText || '').trim() : '';
            var nextInput = nextEl ? nextEl.querySelector('input, textarea, select') : null;
            var inputFilled = nextInput && (nextInput.value || '').trim().length > 0;
            if (nextText.length < 15 && !inputFilled) unanswered++;
          }
        }
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'AI_PAGE_SCAN',
          hasQuestions: total > 0,
          unansweredCount: unanswered,
          totalQuestions: total,
          pageText: bodyText.slice(0, 6000)
        }));
      } catch (e) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'AI_PAGE_SCAN', hasQuestions: false, unansweredCount: 0, totalQuestions: 0, pageText: '' }));
      }
    }

    window.__aiPageScanRun = runScan;
    runScan();
    setTimeout(runScan, 1000);
    setTimeout(runScan, 2500);

    try {
      var debounceTimer = null;
      var observer = new MutationObserver(function() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(runScan, 800);
      });
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    } catch (e) {}
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
