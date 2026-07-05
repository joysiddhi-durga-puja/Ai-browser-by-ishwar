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

// ============================================================================
// GITHUB OAUTH DEVICE FLOW
// Lets someone connect their GitHub account without ever copying a Personal
// Access Token by hand. Device Flow is the same mechanism TV/CLI apps use
// (e.g. `gh auth login`) — no client secret involved at any step, so it's
// safe to ship fully client-side with nothing hidden. To turn this on:
//   1. Go to github.com/settings/developers > "New OAuth App"
//   2. Any Homepage URL / Authorization callback URL works (device flow
//      never redirects back to one) — just fill in something valid.
//   3. On the app's settings page, tick "Enable Device Flow".
//   4. Copy the generated "Client ID" (NOT the client secret — that one is
//      never used here) and paste it below.
// Leaving this blank keeps the manual-token screen as the only option.
// ============================================================================
export const GITHUB_OAUTH_CLIENT_ID = 'Ov23liSGcCrB4MzOo6oN';
export const GITHUB_DEVICE_CODE_URL = 'https://github.com/login/device/code';
export const GITHUB_OAUTH_TOKEN_URL = 'https://github.com/login/oauth/access_token';
export const GITHUB_OAUTH_SCOPE = 'repo';

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
      'button.ytp-ad-skip-button-modern',
      '.ytp-ad-skip-button-slot button',
      '.ytp-ad-skip-button-slot [role="button"]'
    ];

    // A JS .click() only fires a synthetic "click" event. Real buttons in
    // YouTube's mobile ad player often react to pointerdown/up instead, so
    // a plain .click() can silently do nothing. Fire a full realistic
    // event sequence to cover every case.
    function fireFullClick(el) {
      if (!el) return;
      try {
        var rect = el.getBoundingClientRect();
        var x = rect.left + rect.width / 2;
        var y = rect.top + rect.height / 2;
        var opts = { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y };
        ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(function(type) {
          try {
            var EventCtor = (window.PointerEvent && /^pointer/.test(type)) ? PointerEvent : MouseEvent;
            el.dispatchEvent(new EventCtor(type, opts));
          } catch (e) { /* ignore unsupported event types */ }
        });
      } catch (e) { /* element may not be in a measurable state */ }
      if (typeof el.click === 'function') { try { el.click(); } catch (e) {} }
    }

    // Given a matched element that merely *contains* the real control
    // (e.g. a wrapper div), find the actual clickable node inside it.
    function resolveClickable(el) {
      if (!el) return null;
      if (el.tagName === 'BUTTON' || el.tagName === 'A' || el.getAttribute('role') === 'button') return el;
      var inner = el.querySelector && el.querySelector('button, a, [role="button"]');
      return inner || el;
    }

    // YouTube's mobile ad UI increasingly renders through web components
    // (Polymer/Lit elements with an open shadow root). A plain
    // querySelector on the document can never see inside those — this
    // walks the light DOM and recurses into every open shadow root too.
    function queryAllDeep(root, selector) {
      var out = [];
      try { out = Array.prototype.slice.call(root.querySelectorAll(selector)); } catch (e) {}
      var all;
      try { all = root.querySelectorAll('*'); } catch (e) { all = []; }
      for (var i = 0; i < all.length; i++) {
        if (all[i].shadowRoot) out = out.concat(queryAllDeep(all[i].shadowRoot, selector));
      }
      return out;
    }

    function clickSkipIfPresent() {
      for (var i = 0; i < SKIP_SELECTORS.length; i++) {
        var btn = document.querySelector(SKIP_SELECTORS[i]);
        if (btn && btn.offsetParent !== null) { fireFullClick(resolveClickable(btn)); return true; }
      }
      // Broader net for when YouTube tweaks its exact class names: any
      // element whose class or aria-label merely contains "skip" (and looks
      // like an ad-skip control, not an unrelated "skip" elsewhere on the
      // page) — restricted to the player container to avoid false hits.
      var player = document.querySelector('.html5-video-player, #movie_player');
      if (player) {
        var loose = player.querySelectorAll('[class*="skip" i], [aria-label*="skip" i]');
        for (var k = 0; k < loose.length; k++) {
          if (loose[k].offsetParent !== null) { fireFullClick(resolveClickable(loose[k])); return true; }
        }
      }
      // Next: any short "Skip..." text label anywhere on the page (covers
      // "Skip", "Skip Ad", "Skip Ads", "Skip ►" with an icon glyph that
      // doesn't show up as text at all).
      var candidates = document.querySelectorAll('button, [role="button"], span, div');
      for (var j = 0; j < candidates.length; j++) {
        var text = (candidates[j].innerText || '').trim().toLowerCase();
        if (text.indexOf('skip') === 0 && text.length < 20 && candidates[j].offsetParent !== null) {
          fireFullClick(resolveClickable(candidates[j]));
          return true;
        }
      }
      // Last resort: pierce shadow DOM for web-component based skip
      // buttons that never show up in a normal querySelector at all.
      if (player) {
        var deep = queryAllDeep(player, '[class*="skip" i], [aria-label*="skip" i], [role="button"]');
        for (var d = 0; d < deep.length; d++) {
          var dtext = (deep[d].innerText || deep[d].getAttribute('aria-label') || '').trim().toLowerCase();
          if (dtext.indexOf('skip') === 0 || /skip/i.test(deep[d].className || '')) {
            fireFullClick(resolveClickable(deep[d]));
            return true;
          }
        }
      }
      return false;
    }

    // Button-independent fallback. YouTube's player container itself gets
    // an "ad-showing"/"ad-interrupting" class the instant an ad starts —
    // that class name has stayed stable for years even while the Skip
    // button's own class names keep changing, and it's also true for ads
    // that have no Skip button at all (unskippable pre-rolls still show
    // this class, so jumping the ad's own <video> element straight to its
    // end is the only way to get past those). This runs first every tick;
    // clickSkipIfPresent below is kept purely as a secondary path for any
    // odd case this misses.
    function forceSkipAdByJumpingToEnd() {
      var player = document.querySelector('.html5-video-player, #movie_player');
      if (!player) return false;
      var isAdShowing = player.classList.contains('ad-showing') || player.classList.contains('ad-interrupting');
      if (!isAdShowing) return false;
      var video = document.querySelector('video.html5-main-video, video');
      if (video && isFinite(video.duration) && video.duration > 0 && video.currentTime < video.duration - 0.25) {
        try { video.muted = true; } catch (e) {}
        video.currentTime = video.duration;
        return true;
      }
      return false;
    }

    // Interval + MutationObserver both call this, so throttle to avoid
    // hammering it on every tiny DOM change (captions, progress bar, etc
    // mutate constantly during playback).
    var lastCheckAt = 0;
    function throttledCheck() {
      var now = Date.now();
      if (now - lastCheckAt < 250) return;
      lastCheckAt = now;
      if (forceSkipAdByJumpingToEnd()) return;
      clickSkipIfPresent();
    }

    setInterval(throttledCheck, 300);
    var adObserver = new MutationObserver(throttledCheck);
    adObserver.observe(document.body, { childList: true, subtree: true });
    // The jump-to-end check is a single cheap classList read, so it can
    // safely run much faster than the throttled button search above —
    // this is what actually makes the skip feel instant instead of
    // waiting up to ~300ms.
    setInterval(forceSkipAdByJumpingToEnd, 100);
  })();
  true;
`;

// ============================================================================
// YOUTUBE SPONSOR-SEGMENT AUTO-SKIP
// YouTube's own pre/mid-roll ads (handled above) are a different thing from
// a creator's own in-video sponsor read ("this video is sponsored by...").
// YouTube has no native skip button for that — it's just part of the video
// file. This uses the community-run SponsorBlock database (the same public
// API the SponsorBlock browser extension itself calls): for the video
// currently playing, it fetches the timestamp ranges people have tagged as
// sponsor/self-promo/interaction-reminder segments, and the moment playback
// enters one it jumps straight past it automatically — no button, no tap.
// A toast fires (see onMessage handling) so it's still visible that a
// segment was skipped. Re-checks the URL every 1.5s to notice YouTube's
// in-app "change video without a real page reload" navigation and re-fetch
// segments for the new video. Domain-gated and install-guarded the same way
// as the ad-skip script.
// ============================================================================
export const YOUTUBE_SPONSOR_SKIP_INJECTED_JS = `
  (function() {
    if (window.__aiYtSponsorSkipInstalled) { true; return; }
    if (!/(^|\\.)youtube\\.com$/.test(location.hostname)) { true; return; }
    window.__aiYtSponsorSkipInstalled = true;

    var currentVideoId = null;
    var segments = [];
    var lastAutoSkippedTo = null;

    function getVideoId() {
      var match = location.href.match(/[?&]v=([^&]+)/);
      return match ? match[1] : null;
    }

    function fetchSegments(videoId) {
      var categories = encodeURIComponent(JSON.stringify(['sponsor', 'selfpromo', 'interaction']));
      var url = 'https://sponsor.ajay.app/api/skipSegments?videoID=' + encodeURIComponent(videoId) + '&categories=' + categories;
      function attempt(retriesLeft) {
        fetch(url).then(function(res) {
          return res.ok ? res.json() : [];
        }).then(function(data) {
          segments = (data || []).map(function(item) { return item.segment; });
        }).catch(function() {
          // The public SponsorBlock server is community-run and sometimes
          // slow/overloaded — one retry after a short delay covers a
          // transient timeout without hammering it on every failure.
          if (retriesLeft > 0) {
            setTimeout(function() { attempt(retriesLeft - 1); }, 4000);
          } else {
            segments = [];
          }
        });
      }
      attempt(1);
    }

    function checkForVideoChange() {
      var vid = getVideoId();
      if (vid && vid !== currentVideoId) {
        currentVideoId = vid;
        segments = [];
        lastAutoSkippedTo = null;
        fetchSegments(vid);
      }
    }
    setInterval(checkForVideoChange, 1500);
    checkForVideoChange();

    // No button, no tap needed — as soon as playback enters a known
    // sponsor/selfpromo/interaction segment, jump straight past it.
    setInterval(function() {
      var video = document.querySelector('video');
      if (!video || !segments.length) return;
      var t = video.currentTime;
      for (var i = 0; i < segments.length; i++) {
        var seg = segments[i];
        if (t >= seg[0] && t < seg[1] - 0.3 && lastAutoSkippedTo !== seg[1]) {
          video.currentTime = seg[1];
          lastAutoSkippedTo = seg[1];
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'sponsor-segment-skipped' }));
          }
          break;
        }
      }
    }, 400);
  })();
  true;
`;

// ============================================================================
// MEDIA PLAY-STATE DETECTION (for background play)
// Watches any <video> element on the page and tells React Native (via
// postMessage) whenever playback starts/stops/ends. React Native uses this
// to start/stop the native foreground service that keeps audio playing
// when the screen is off or the app is backgrounded. Works on any site with
// HTML5 video, not just YouTube.
// ============================================================================
export const MEDIA_PLAY_STATE_INJECTED_JS = `
  (function() {
    if (window.__aiMediaPlayStateInstalled) { true; return; }
    window.__aiMediaPlayStateInstalled = true;

    function post(playing) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'media-play-state', playing: playing }));
      }
    }

    function attach(video) {
      if (video.__aiTracked) return;
      video.__aiTracked = true;
      video.addEventListener('play', function() { post(true); });
      video.addEventListener('pause', function() { post(false); });
      video.addEventListener('ended', function() { post(false); });
    }

    setInterval(function() {
      var v = document.querySelector('video');
      if (v) attach(v);
    }, 1000);
  })();
  true;
`;


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
