import React, { useEffect, useRef } from 'react';
import { View, Linking } from 'react-native';
import { WebView } from 'react-native-webview';
import { captureRef } from 'react-native-view-shot';
import HomeScreen from './HomeScreen';
import layoutStyles from '../styles';
import {
  HOME_URL,
  AD_BLOCK_DOMAINS,
  AD_BLOCK_INJECTED_JS,
  DESKTOP_VIEWPORT_INJECTED_JS,
  NIGHT_MODE_INJECTED_JS,
  NIGHT_MODE_REMOVE_JS,
  isLikelyDownloadUrl
} from '../constants';

// Combines whichever injected scripts are currently active into one payload
// so both can run together on initial page load.
const buildInjectedJs = (adBlockOn, nightModeOn, desktopModeOn) => {
  const scripts = [];
  if (adBlockOn) scripts.push(AD_BLOCK_INJECTED_JS);
  if (nightModeOn) scripts.push(NIGHT_MODE_INJECTED_JS);
  if (desktopModeOn) scripts.push(DESKTOP_VIEWPORT_INJECTED_JS);
  return scripts.length ? scripts.join('\n') : undefined;
};

// --- RUNTIME CANVAS ENGINE ---
// All tabs stay mounted (display: none/flex toggle) so WebView state/scroll
// position survives switching tabs.
export default function BrowserTabsView({
  tabs,
  activeTabId,
  isNightMode,
  isDesktopMode,
  isAdBlockOn,
  webViewRefs,
  updateTabState,
  setInputUrl,
  setProgress,
  commitHistoryNode,
  activateHomeSearch,
  startFileDownload,
  showTabSwitcher
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
              <HomeScreen isNightMode={isNightMode} />
            ) : (
              <WebView
                ref={nativeRefNode => { if (nativeRefNode) webViewRefs.current[runningTabInstance.id] = nativeRefNode; }}
                source={{ uri: runningTabInstance.url }}
                userAgent={isDesktopMode ? "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" : undefined}
                scalesPageToFit={isDesktopMode}
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
                  if (isAdBlockOn && AD_BLOCK_DOMAINS.some(adHost => targetNavUrl.includes(adHost))) {
                    return false;
                  }
                  // Ad networks on piracy/adult sites redirect via JS/timers
                  // right after a tap (navigationType 'other', not 'click').
                  // Their domains rotate constantly so a hostname list alone
                  // can't keep up — block the redirect type itself instead.
                  if (isAdBlockOn && navRequest.navigationType === 'other' && targetNavUrl !== runningTabInstance.url) {
                    return false;
                  }
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
                }}
                onNavigationStateChange={(navigationMetricsState) => {
                  updateTabState(runningTabInstance.id, { canGoBack: navigationMetricsState.canGoBack, canGoForward: navigationMetricsState.canGoForward, url: navigationMetricsState.url });
                  if (frameSelectionFlag) setInputUrl(navigationMetricsState.url);
                }}
                onLoadProgress={(computedProgressEvent) => frameSelectionFlag && setProgress(computedProgressEvent.nativeEvent.progress)}
                injectedJavaScript={buildInjectedJs(isAdBlockOn, isNightMode, isDesktopMode)}
                injectedJavaScriptBeforeContentLoaded={buildInjectedJs(isAdBlockOn, isNightMode, isDesktopMode)}
                style={isNightMode ? layoutStyles.nightModeWebViewBg : null}
              />
            )}
          </View>
        );
      })}
    </View>
  );
}
