import React, { useEffect, useRef } from 'react';
import { View, Linking } from 'react-native';
import { WebView } from 'react-native-webview';
import { captureRef } from 'react-native-view-shot';
import HomeScreen from './HomeScreen';
import layoutStyles from '../styles';
import {
  HOME_URL,
  DESKTOP_VIEWPORT_INJECTED_JS,
  NIGHT_MODE_INJECTED_JS,
  NIGHT_MODE_REMOVE_JS,
  PAGE_QUESTION_SCAN_JS,
  YOUTUBE_AD_SKIP_INJECTED_JS,
  YOUTUBE_SPONSOR_SKIP_INJECTED_JS,
  MEDIA_PLAY_STATE_INJECTED_JS,
  isLikelyDownloadUrl
} from '../constants';

// Combines whichever injected scripts are currently active into one payload
// so both can run together on initial page load. The YouTube scripts and the
// media play-state watcher are always included — all are domain/feature
// gated internally and no-op instantly where they don't apply.
const buildInjectedJs = (nightModeOn, desktopModeOn) => {
  const scripts = [YOUTUBE_AD_SKIP_INJECTED_JS, YOUTUBE_SPONSOR_SKIP_INJECTED_JS, MEDIA_PLAY_STATE_INJECTED_JS];
  if (nightModeOn) scripts.push(NIGHT_MODE_INJECTED_JS);
  if (desktopModeOn) scripts.push(DESKTOP_VIEWPORT_INJECTED_JS);
  return scripts.join('\n');
};

// --- RUNTIME CANVAS ENGINE ---
// All tabs stay mounted (display: none/flex toggle) so WebView state/scroll
// position survives switching tabs.
export default function BrowserTabsView({
  tabs,
  activeTabId,
  isNightMode,
  isDesktopMode,
  webViewRefs,
  updateTabState,
  setInputUrl,
  setProgress,
  commitHistoryNode,
  activateHomeSearch,
  startFileDownload,
  showTabSwitcher,
  onWebViewMessage,
  navigateToUrl,
  createNewTab,
  showBrowserToast
}) {
  // Refs to each tab's wrapping frame (not the WebView itself) so we can
  // rasterize whatever is currently on screen into a JPEG thumbnail — this
  // is what powers the Chrome-style live preview cards in the tab switcher.
  const frameRefs = useRef({});
  // Pending address-bar commits, keyed by tab id. An ad-redirect chain
  // fires onNavigationStateChange with the ad's URL, then almost always
  // fails and bounces back (see onError below) within a few hundred ms.
  // Delaying the actual address-bar text update by a short window lets a
  // fast bounce-back cancel it before the user ever sees the ad's URL —
  // real navigations still settle inside the delay so this isn't
  // noticeable for normal browsing.
  const pendingUrlCommits = useRef({});
  const URL_COMMIT_DEBOUNCE_MS = 260;
  // Last URL that genuinely finished loading, per tab id. Only updated in
  // onLoad below (which fires on success only — never for a page that
  // failed). This is what onError uses to recover exactly where the
  // person was, since a failed ad-redirect chain can push several hops
  // onto the WebView's own history stack and a single goBack() would
  // only undo one of them.
  const lastGoodUrlRef = useRef({});

  // Grab a fresh screenshot of the tab that's currently visible right at
  // the moment the tab switcher opens, so its card shows the real page
  // instead of a stale/blank preview. Other tabs keep whatever preview
  // they last captured the same way.
  useEffect(() => {
    if (!showTabSwitcher) return;
    const targetNode = frameRefs.current[activeTabId];
    if (!targetNode) return;
    captureRef(targetNode, { format: 'jpg', quality: 0.5, result: 'tmpfile' })
      .then(uri => updateTabState(activeTabId, { previewUri: uri }))
      .catch(() => {});
  }, [showTabSwitcher]);
  // Night mode is toggled from the menu while pages are already loaded.
  // injectedJavaScript only runs on the initial page load, so without this
  // effect flipping the switch would do nothing until the tab was reloaded.
  // Since every tab stays mounted, this reaches every open tab at once.
  useEffect(() => {
    tabs.forEach((t) => {
      const webViewRef = webViewRefs.current[t.id];
      if (webViewRef && t.url !== HOME_URL) {
        webViewRef.injectJavaScript(isNightMode ? NIGHT_MODE_INJECTED_JS : NIGHT_MODE_REMOVE_JS);
      }
    });
  }, [isNightMode]);

  // Desktop mode only changes the `userAgent` prop we pass to WebView.
  // react-native-webview does NOT automatically re-request the current
  // page when this prop changes on its own — the page keeps running
  // under whichever user-agent it originally loaded with. So without a
  // reload here, the toggle flips visually (toast shows) but the site
  // itself never actually receives the new UA string. Skip the very
  // first render so we don't reload every tab on app start.
  const isFirstDesktopRender = useRef(true);
  useEffect(() => {
    if (isFirstDesktopRender.current) {
      isFirstDesktopRender.current = false;
      return;
    }
    tabs.forEach((t) => {
      const webViewRef = webViewRefs.current[t.id];
      if (webViewRef && t.url !== HOME_URL) {
        webViewRef.reload();
      }
    });
  }, [isDesktopMode]);

  return (
    <View style={layoutStyles.webviewCoreLayoutContainerBody}>
      {tabs.map((runningTabInstance) => {
        const frameSelectionFlag = runningTabInstance.id === activeTabId;
        const isThisTabHome = runningTabInstance.url === HOME_URL;
        return (
          <View
            key={runningTabInstance.id}
            ref={node => { if (node) frameRefs.current[runningTabInstance.id] = node; }}
            collapsable={false}
            style={[layoutStyles.webviewFrameStructuralContainer, { display: frameSelectionFlag ? 'flex' : 'none' }]}
          >
            {isThisTabHome ? (
              <HomeScreen isNightMode={isNightMode} navigateToUrl={navigateToUrl} />
            ) : (
              <WebView
                ref={nativeRefNode => { if (nativeRefNode) webViewRefs.current[runningTabInstance.id] = nativeRefNode; }}
                source={{ uri: runningTabInstance.url }}
                userAgent={isDesktopMode ? "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" : undefined}
                scalesPageToFit={isDesktopMode}
                allowsFullscreenVideo={true}
                allowsInlineMediaPlayback={true}
                mediaPlaybackRequiresUserAction={false}
                // --- Anti external-redirect settings ---
                // window.open()/target="_blank" popups (the way most ad
                // networks try to escape the current page) now open in a
                // brand-new browser tab via onOpenWindow below, instead of
                // hijacking this WebView. That way the tab the person was
                // actually reading never navigates away at all — going
                // back is a non-issue because there's nothing to go back
                // from, the original page was never left.
                // (Setting this to false is also a known WebView
                // vulnerability — CVE-2020-6506 — so true is correct
                // regardless.)
                setSupportMultipleWindows={true}
                javaScriptCanOpenWindowsAutomatically={true}
                onOpenWindow={(syntheticEvent) => {
                  const targetUrl = syntheticEvent.nativeEvent.targetUrl;
                  if (targetUrl) {
                    createNewTab && createNewTab(targetUrl);
                  }
                }}
                onFileDownload={({ nativeEvent }) => startFileDownload(nativeEvent.downloadUrl)}
                onShouldStartLoadWithRequest={(navRequest) => {
                  const targetNavUrl = navRequest.url;
                  // A real file (PDF, APK, image, video, etc) instead of a
                  // web page — hand it to the download manager and keep the
                  // WebView exactly where it currently is, like Chrome does.
                  if (/^https?:\/\//i.test(targetNavUrl) && isLikelyDownloadUrl(targetNavUrl)) {
                    startFileDownload(targetNavUrl);
                    return false;
                  }
                  if (/^https?:\/\//i.test(targetNavUrl) || targetNavUrl === 'about:blank') {
                    return true;
                  }
                  // Non-web schemes (intent:, market:, upi:, tel:, mailto:,
                  // whatsapp:, etc.) can never be rendered by a WebView.
                  // Historically we let the request pass through and the
                  // OS silently fell back to opening Chrome. Now we hand
                  // it to Linking explicitly (or drop it) and keep the
                  // WebView exactly where it was.
                  Linking.canOpenURL(targetNavUrl).then(isSupportedScheme => {
                    if (isSupportedScheme) Linking.openURL(targetNavUrl);
                  }).catch(() => {});
                  return false;
                }}
                onLoadStart={() => {
                  updateTabState(runningTabInstance.id, { loading: true });
                  if (frameSelectionFlag) setProgress(0);
                }}
                onLoad={(syntheticEvent) => {
                  const loadedUrl = syntheticEvent.nativeEvent.url;
                  // Fires on success only, so this is the one safe place to
                  // remember "the page the person was actually on" and to
                  // log history — a failed ad-redirect page never reaches
                  // this handler, only onError below.
                  lastGoodUrlRef.current[runningTabInstance.id] = loadedUrl;
                  updateTabState(runningTabInstance.id, { title: syntheticEvent.nativeEvent.title, url: loadedUrl });
                  if (frameSelectionFlag) setInputUrl(loadedUrl);
                  commitHistoryNode(syntheticEvent.nativeEvent.title, loadedUrl, runningTabInstance.isIncognito);
                }}
                onLoadEnd={(syntheticEvent) => {
                  // Fires whether the load succeeded or failed — only safe
                  // to use for clearing the loading indicator here, not for
                  // committing the url/title (onLoad above owns that, so a
                  // failed ad page's url never gets written into state).
                  updateTabState(runningTabInstance.id, { loading: false });
                  if (frameSelectionFlag) setProgress(0);
                  // Scan the freshly loaded page for unanswered questions so
                  // the Auto Answer button knows whether to show itself.
                  webViewRefs.current[runningTabInstance.id]?.injectJavaScript(PAGE_QUESTION_SCAN_JS);
                }}
                onMessage={(event) => onWebViewMessage && onWebViewMessage(runningTabInstance.id, event)}
                // Movie/piracy-style download sites route their "Download"
                // buttons through an ad network first. Because popups
                // (window.open/target=_blank) now open in their own tab via
                // onOpenWindow above, what lands here is a direct top-level
                // redirect the ad chain drove this same WebView through —
                // when it finally breaks on a dead/untrusted domain, we
                // recover by forcing the WebView straight back to the last
                // page that genuinely finished loading (see onLoad above)
                // rather than a single goBack(), since the chain can have
                // pushed several hops onto the native history stack and one
                // goBack() would only undo one of them, stranding the
                // person on a different ad page instead of their own.
                // Rather than show any error screen at all, renderError
                // below is left blank and this just bounces straight back,
                // with a toast as the only sign anything happened.
                onError={(syntheticEvent) => {
                  const { nativeEvent } = syntheticEvent;
                  const desc = String(nativeEvent?.description || '').toLowerCase();
                  const isUntrustedCert = desc.includes('ssl') || desc.includes('certificate');
                  const tabId = runningTabInstance.id;
                  // Kill any queued address-bar update for this tab right
                  // away — this is exactly the ad-redirect-then-bounce case,
                  // so the ad's URL must never actually reach the input box.
                  if (pendingUrlCommits.current[tabId]) {
                    clearTimeout(pendingUrlCommits.current[tabId]);
                    delete pendingUrlCommits.current[tabId];
                  }
                  const webViewRef = webViewRefs.current[tabId];
                  const recoveryUrl = lastGoodUrlRef.current[tabId];
                  if (webViewRef && recoveryUrl) {
                    // Command the actual navigation via injected JS rather
                    // than only updating React state — the tab's `url`
                    // state was deliberately never advanced during the ad
                    // chain (that's what keeps the address bar clean), so
                    // it may already equal recoveryUrl and a state update
                    // alone wouldn't be seen as a change worth re-navigating
                    // for. Setting location directly always forces it.
                    webViewRef.injectJavaScript(`window.location.replace(${JSON.stringify(recoveryUrl)}); true;`);
                    updateTabState(tabId, { url: recoveryUrl });
                    if (frameSelectionFlag) setInputUrl(recoveryUrl);
                  } else if (webViewRef) {
                    // No known-good page recorded yet for this tab (e.g. its
                    // very first load was the one that failed) — fall back
                    // to a plain back-step.
                    webViewRef.goBack();
                  }
                  if (frameSelectionFlag) {
                    showBrowserToast && showBrowserToast(isUntrustedCert ? 'Blocked an unsafe redirect' : "Redirect failed, couldn't load");
                  }
                }}
                onNavigationStateChange={(navigationMetricsState) => {
                  // Back/forward availability is safe to reflect instantly —
                  // it doesn't render any URL text so there's nothing to glitch.
                  updateTabState(runningTabInstance.id, { canGoBack: navigationMetricsState.canGoBack, canGoForward: navigationMetricsState.canGoForward });

                  const targetUrl = navigationMetricsState.url;
                  const tabId = runningTabInstance.id;
                  if (pendingUrlCommits.current[tabId]) {
                    clearTimeout(pendingUrlCommits.current[tabId]);
                  }
                  pendingUrlCommits.current[tabId] = setTimeout(() => {
                    delete pendingUrlCommits.current[tabId];
                    updateTabState(tabId, { url: targetUrl });
                    if (frameSelectionFlag) setInputUrl(targetUrl);
                  }, URL_COMMIT_DEBOUNCE_MS);
                }}
                onLoadProgress={(computedProgressEvent) => frameSelectionFlag && setProgress(computedProgressEvent.nativeEvent.progress)}
                injectedJavaScript={buildInjectedJs(isNightMode, isDesktopMode)}
                injectedJavaScriptBeforeContentLoaded={buildInjectedJs(isNightMode, isDesktopMode)}
                renderError={() => (
                  <View style={[layoutStyles.webviewErrorFallbackContainer, isNightMode && layoutStyles.nightModeShellBG]} />
                )}
                style={isNightMode ? layoutStyles.nightModeWebViewBg : null}
              />
            )}
          </View>
        );
      })}
    </View>
  );
}
