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
  showBrowserToast
}) {
  // Refs to each tab's wrapping frame (not the WebView itself) so we can
  // rasterize whatever is currently on screen into a JPEG thumbnail — this
  // is what powers the Chrome-style live preview cards in the tab switcher.
  const frameRefs = useRef({});

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
                // Forces window.open()/target="_blank" popups (the way most
                // ad networks try to escape into the system browser) to
                // load inside THIS WebView instead of spawning a new
                // Android window that the OS resolves to Chrome.
                setSupportMultipleWindows={false}
                javaScriptCanOpenWindowsAutomatically={true}
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
                onLoadEnd={(syntheticEvent) => {
                  updateTabState(runningTabInstance.id, { loading: false, title: syntheticEvent.nativeEvent.title, url: syntheticEvent.nativeEvent.url });
                  if (frameSelectionFlag) {
                    setInputUrl(syntheticEvent.nativeEvent.url);
                    setProgress(0);
                  }
                  commitHistoryNode(syntheticEvent.nativeEvent.title, syntheticEvent.nativeEvent.url, runningTabInstance.isIncognito);
                  // Scan the freshly loaded page for unanswered questions so
                  // the Auto Answer button knows whether to show itself.
                  webViewRefs.current[runningTabInstance.id]?.injectJavaScript(PAGE_QUESTION_SCAN_JS);
                }}
                onMessage={(event) => onWebViewMessage && onWebViewMessage(runningTabInstance.id, event)}
                // Movie/piracy-style download sites route their "Download"
                // buttons through an ad network first. Because popups are
                // forced into this same WebView (setSupportMultipleWindows
                // above), when that ad redirect chain lands on a broken or
                // untrusted-SSL domain, the WebView fails to load it right
                // in place of the page the person was actually on. Rather
                // than show any error screen at all, renderError below is
                // left blank and this just bounces straight back to
                // whatever was on screen before the redirect fired, with a
                // toast as the only sign anything happened.
                onError={(syntheticEvent) => {
                  const { nativeEvent } = syntheticEvent;
                  const desc = String(nativeEvent?.description || '').toLowerCase();
                  const isUntrustedCert = desc.includes('ssl') || desc.includes('certificate');
                  const webViewRef = webViewRefs.current[runningTabInstance.id];
                  if (webViewRef) webViewRef.goBack();
                  if (frameSelectionFlag) {
                    showBrowserToast && showBrowserToast(isUntrustedCert ? 'Blocked an unsafe redirect' : "Redirect failed, couldn't load");
                  }
                }}
                onNavigationStateChange={(navigationMetricsState) => {
                  updateTabState(runningTabInstance.id, { canGoBack: navigationMetricsState.canGoBack, canGoForward: navigationMetricsState.canGoForward, url: navigationMetricsState.url });
                  if (frameSelectionFlag) setInputUrl(navigationMetricsState.url);
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
