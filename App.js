import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  SafeAreaView,
  StatusBar,
  Switch,
  ActivityIndicator,
  FlatList,
  BackHandler,
  Alert,
  Share,
  Animated,
  Platform,
  KeyboardAvoidingView
} from 'react-native';
import { WebView } from 'react-native-webview';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ============================================================================
// LIGHTWEIGHT VIA-STYLE SVG VECTOR ICONS COMPONENT MATRIX
// ============================================================================
const ViaIcon = ({ type, color = '#475569', size = 24 }) => {
  switch (type) {
    case 'night':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </Svg>
      );
    case 'reload':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M23 4v6h-6M1 20v-6h6" />
          <Path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
        </Svg>
      );
    case 'bookmarks':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </Svg>
      );
    case 'history':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Circle cx="12" cy="12" r="10" />
          <Path d="M12 6v6l4 2" />
        </Svg>
      );
    case 'downloads':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
        </Svg>
      );
    case 'adblock':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </Svg>
      );
    case 'incognito':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z" />
          <Circle cx="9" cy="10.5" r="1" fill={color} />
          <Circle cx="15" cy="10.5" r="1" fill={color} />
          <Path d="M12 17a5 5 0 0 0 3.87-1.87 1 1 0 0 0-1.48-1.34 3 3 0 0 1-4.78 0 1 1 0 0 0-1.48 1.34A5 5 0 0 0 12 17z" />
        </Svg>
      );
    case 'share':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Circle cx="18" cy="5" r="3" />
          <Circle cx="6" cy="12" r="3" />
          <Circle cx="18" cy="19" r="3" />
          <Path d="M8.59 13.51l5.83 3.4M14.42 7.09l-5.83 3.4" />
        </Svg>
      );
    case 'add_bookmark':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M12 5v14M5 12h14" />
        </Svg>
      );
    case 'desktop':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Rect x="2" y="3" width="20" height="14" rx="2" />
          <Path d="M8 21h8M12 17v4" />
        </Svg>
      );
    case 'my_info':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <Circle cx="12" cy="7" r="4" />
        </Svg>
      );
    case 'settings':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Circle cx="12" cy="12" r="3" />
          <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </Svg>
      );
    default:
      return null;
  }
};

// ============================================================================
// COMPONENT MAIN MODULE ENTRY
// ============================================================================
export default function App() {
  const [tabs, setTabs] = useState([
    { id: '1', url: 'https://google.com', title: 'Google', loading: false, canGoBack: false, canGoForward: false }
  ]);
  const [activeTabId, setActiveTabId] = useState('1');
  const [inputUrl, setInputUrl] = useState('https://google.com');
  const [showTabSwitcher, setShowTabSwitcher] = useState(false);
  const [progress, setProgress] = useState(0);

  const [isAiEnabled, setIsAiEnabled] = useState(true); 
  const [isMenuVisible, setIsMenuVisible] = useState(false); 
  const [currentModal, setCurrentModal] = useState(null); 
  const [activeSubTab, setActiveSubTab] = useState('bookmarks'); 

  const [bookmarks, setBookmarks] = useState([]);
  const [history, setHistory] = useState([]);
  const [downloads, setDownloads] = useState([
    { id: 'd1', name: 'Sample_Document.pdf', size: '2.4 MB', date: '04/07/2026', status: 'Completed' },
    { id: 'd2', name: 'Setup_Package.apk', size: '45.1 MB', date: '04/07/2026', status: 'Completed' }
  ]);
  const [isNightMode, setIsNightMode] = useState(false);
  const [isAdBlockOn, setIsAdBlockOn] = useState(true);
  const [isIncognito, setIsIncognito] = useState(false);
  const [isDesktopMode, setIsDesktopMode] = useState(false);

  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);

  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const slideAnimation = useRef(new Animated.Value(350)).current;
  const toastFadeAnim = useRef(new Animated.Value(0)).current;
  const webViewRefs = useRef({});

  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];

  const showBrowserToast = (messageText) => {
    setToastMessage(messageText);
    setShowToast(true);
    Animated.timing(toastFadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    setTimeout(() => {
      Animated.timing(toastFadeAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => {
        setShowToast(false);
      });
    }, 2200);
  };

  useEffect(() => {
    const backAction = () => {
      if (showAiPanel) { setShowAiPanel(false); return true; }
      if (currentModal) { setCurrentModal(null); return true; }
      if (showTabSwitcher) { setShowTabSwitcher(false); return true; }
      if (isMenuVisible) { toggleBottomMenu(false); return true; }
      if (activeTab && activeTab.canGoBack && webViewRefs.current[activeTabId]) {
        webViewRefs.current[activeTabId].goBack();
        return true;
      }
      if (tabs.length > 1) { closeTab(activeTabId); return true; }
      return false;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [showAiPanel, currentModal, showTabSwitcher, isMenuVisible, activeTabId, tabs]);

  useEffect(() => { initializeLocalDatabase(); }, []);

  const initializeLocalDatabase = async () => {
    try {
      const storedBookmarks = await AsyncStorage.getItem('@vault_bookmarks');
      const storedHistory = await AsyncStorage.getItem('@vault_history');
      const storedDownloads = await AsyncStorage.getItem('@vault_downloads');
      const storedAiConfig = await AsyncStorage.getItem('@vault_ai_enabled');
      const storedTheme = await AsyncStorage.getItem('@vault_night_mode');
      
      if (storedBookmarks) setBookmarks(JSON.parse(storedBookmarks));
      if (storedHistory) setHistory(JSON.parse(storedHistory));
      if (storedDownloads) setDownloads(JSON.parse(storedDownloads));
      if (storedAiConfig) setIsAiEnabled(JSON.parse(storedAiConfig));
      if (storedTheme) setIsNightMode(JSON.parse(storedTheme));
    } catch (error) {
      console.warn("Storage exception dynamic baseline handler:", error);
    }
  };

  const toggleBottomMenu = (openState) => {
    if (openState) {
      setIsMenuVisible(true);
      Animated.timing(slideAnimation, { toValue: 0, duration: 250, useNativeDriver: true }).start();
    } else {
      Animated.timing(slideAnimation, { toValue: 350, duration: 200, useNativeDriver: true }).start(() => setIsMenuVisible(false));
    }
  };

  const navigateToUrl = (rawTargetUrl) => {
    if (!rawTargetUrl) return;
    let target = rawTargetUrl.trim();
    if (!/^https?:\/\//i.test(target)) {
      if (target.includes('.') && !target.includes(' ')) {
        target = 'https://' + target;
      } else {
        target = `https://www.google.com/search?q=${encodeURIComponent(target)}`;
      }
    }
    setInputUrl(target);
    updateTabState(activeTabId, { url: target });
    toggleBottomMenu(false);
  };

  const updateTabState = (targetId, mutatedState) => {
    setTabs(prev => prev.map(currentTab => currentTab.id === targetId ? { ...currentTab, ...mutatedState } : currentTab));
  };

  const createNewTab = (fallbackUrl = 'https://google.com') => {
    const allocatedId = Date.now().toString();
    const runtimeTabPayload = { id: allocatedId, url: fallbackUrl, title: 'New Tab', loading: false, canGoBack: false, canGoForward: false };
    setTabs([...tabs, runtimeTabPayload]);
    setActiveTabId(allocatedId);
    setInputUrl(fallbackUrl);
    setShowTabSwitcher(false);
  };

  const closeTab = (idToClose) => {
    if (tabs.length === 1) {
      updateTabState(idToClose, { url: 'https://google.com', title: 'Google' });
      setInputUrl('https://google.com');
      setShowTabSwitcher(false);
      return;
    }
    const executionIndex = tabs.findIndex(t => t.id === idToClose);
    const postFilterTabs = tabs.filter(t => t.id !== idToClose);
    setTabs(postFilterTabs);
    delete webViewRefs.current[idToClose];
    if (activeTabId === idToClose) {
      const activeFallbackIndex = executionIndex > 0 ? executionIndex - 1 : 0;
      setActiveTabId(postFilterTabs[activeFallbackIndex].id);
      setInputUrl(postFilterTabs[activeFallbackIndex].url);
    }
  };

  const triggerBookmarkCommit = async () => {
    const schemaPayload = { id: Date.now().toString(), title: activeTab.title || 'Untitled Page', url: activeTab.url };
    const mutationSet = [schemaPayload, ...bookmarks];
    setBookmarks(mutationSet);
    await AsyncStorage.setItem('@vault_bookmarks', JSON.stringify(mutationSet));
    showBrowserToast("Bookmark successfully recorded");
    toggleBottomMenu(false);
  };

  const commitHistoryNode = async (computedTitle, computedUrl) => {
    if (isIncognito) return;
    const historyPayload = { id: Date.now().toString(), title: computedTitle || computedUrl, url: computedUrl, time: new Date().toLocaleTimeString() };
    const mutationSet = [historyPayload, ...history.slice(0, 250)];
    setHistory(mutationSet);
    await AsyncStorage.setItem('@vault_history', JSON.stringify(mutationSet));
  };

  const wipeHistoryCollection = async () => {
    setHistory([]);
    await AsyncStorage.removeItem('@vault_history');
    showBrowserToast("History completely purged");
  };

  const executeCloudAiGatewayRequest = async (operationMode) => {
    setAiLoading(true);
    setShowAiPanel(true);
    setAiResponse('');
    let contextualInstructions = operationMode === 'summary' ? `Summary from this web asset: ${activeTab.url}` : `Query: ${aiPrompt}. Context: ${activeTab.url}`;
    try {
      const remoteResponse = await fetch('https://api.groq.com/openapi/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer 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`
        },
        body: JSON.stringify({ model: "llama-3.3-70b-versatile", messages: [{ role: "user", content: contextualInstructions }], temperature: 0.4, max_tokens: 1024 })
      });
      const unmarshalledJson = await remoteResponse.json();
      setAiResponse(unmarshalledJson.choices[0].message.content || "Empty.");
    } catch (err) {
      setAiResponse("Connection error.");
    } finally {
      setAiLoading(false);
    }
  };

  // --- DYNAMIC CORE NAVIGATION MATRIX BINDINGS ---
  const ActionItemsSchema = [
    { 
      id: 'night', 
      label: 'Night mode', 
      iconType: 'night', 
      isActive: isNightMode,
      action: async () => {
        const nextMode = !isNightMode;
        setIsNightMode(nextMode);
        await AsyncStorage.setItem('@vault_night_mode', JSON.stringify(nextMode));
        showBrowserToast(nextMode ? "Night mode is on" : "Night mode is off");
        toggleBottomMenu(false);
      } 
    },
    { id: 'reload', label: 'Reload', iconType: 'reload', isActive: false, action: () => { webViewRefs.current[activeTabId]?.reload(); toggleBottomMenu(false); } },
    { id: 'bookmarks', label: 'Bookmarks', iconType: 'bookmarks', isActive: false, action: () => { setCurrentModal('history_bookmark'); setActiveSubTab('bookmarks'); toggleBottomMenu(false); } },
    { id: 'history', label: 'History', iconType: 'history', isActive: false, action: () => { setCurrentModal('history_bookmark'); setActiveSubTab('history'); toggleBottomMenu(false); } },
    { id: 'downloads', label: 'Downloads', iconType: 'downloads', isActive: false, action: () => { setCurrentModal('downloads'); toggleBottomMenu(false); } },
    { 
      id: 'adblock', 
      label: 'Ad blocking', 
      iconType: 'adblock', 
      isActive: isAdBlockOn,
      action: () => {
        const nextState = !isAdBlockOn;
        setIsAdBlockOn(nextState);
        showBrowserToast(nextState ? "Ad blocking is on" : "Ad blocking is off");
        toggleBottomMenu(false);
      } 
    },
    { 
      id: 'incognito', 
      label: 'Incognito', 
      iconType: 'incognito', 
      isActive: isIncognito,
      action: () => {
        const nextState = !isIncognito;
        setIsIncognito(nextState);
        showBrowserToast(nextState ? "You've gone incognito" : "Incognito is off");
        toggleBottomMenu(false);
      } 
    },
    { id: 'share', label: 'Share', iconType: 'share', isActive: false, action: () => { Share.share({ url: activeTab.url }); toggleBottomMenu(false); } },
    { id: 'add_bookmark', label: 'Add bookmark', iconType: 'add_bookmark', isActive: false, action: triggerBookmarkCommit },
    { 
      id: 'desktop', 
      label: 'Desktop site', 
      iconType: 'desktop', 
      isActive: isDesktopMode,
      action: () => {
        const nextState = !isDesktopMode;
        setIsDesktopMode(nextState);
        showBrowserToast(nextState ? "Desktop mode active" : "Mobile layout restored");
        toggleBottomMenu(false);
      } 
    },
    { id: 'my_info', label: 'My info', iconType: 'my_info', isActive: false, action: () => { Alert.alert("Profile", "Developer active node."); toggleBottomMenu(false); } },
    { id: 'settings', label: 'Settings', iconType: 'settings', isActive: false, action: () => { setCurrentModal('settings'); toggleBottomMenu(false); } },
  ];

  const primarySlideCollection = ActionItemsSchema.slice(0, 8);
  const secondarySlideCollection = ActionItemsSchema.slice(8, 12);

  return (
    <SafeAreaView style={[layoutStyles.appShell, isNightMode && layoutStyles.nightModeShellBG]}>
      <StatusBar barStyle={isNightMode ? "light-content" : "dark-content"} backgroundColor={isNightMode ? "#121212" : "#ffffff"} />

      {/* --- APPLICATION NAVBAR PANEL --- */}
      <View style={[layoutStyles.navbarContainerPanel, isNightMode && layoutStyles.nightComponentPanel]}>
        <TouchableOpacity style={layoutStyles.navbarIconButtonAsset} onPress={() => createNewTab()}>
          <Text style={{ fontSize: 18 }}>🏠</Text>
        </TouchableOpacity>

        <View style={layoutStyles.inputAreaWrapperField}>
          <TextInput
            style={[layoutStyles.inputFieldCoreElement, isNightMode && { color: '#ffffff' }]}
            value={inputUrl}
            onChangeText={setInputUrl}
            onSubmitEditing={() => navigateToUrl(inputUrl)}
            selectTextOnFocus
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          {progress > 0 && progress < 1 && (
            <View style={[layoutStyles.loadingTrackProgress, { width: `${progress * 100}%` }]} />
          )}
        </View>

        <TouchableOpacity style={layoutStyles.navbarIconButtonAsset} onPress={() => setShowTabSwitcher(true)}>
          <View style={layoutStyles.tabsNumberIndicatorBadge}><Text style={layoutStyles.tabsCounterTextString}>{tabs.length}</Text></View>
        </TouchableOpacity>
      </View>

      {/* --- RUNTIME CANVAS ENGINE --- */}
      <View style={layoutStyles.webviewCoreLayoutContainerBody}>
        {tabs.map((runningTabInstance) => {
          const frameSelectionFlag = runningTabInstance.id === activeTabId;
          return (
            <View key={runningTabInstance.id} style={[layoutStyles.webviewFrameStructuralContainer, { display: frameSelectionFlag ? 'flex' : 'none' }]}>
              <WebView
                ref={nativeRefNode => { if (nativeRefNode) webViewRefs.current[runningTabInstance.id] = nativeRefNode; }}
                source={{ uri: runningTabInstance.url }}
                userAgent={isDesktopMode ? "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" : undefined}
                onLoadStart={() => updateTabState(runningTabInstance.id, { loading: true })}
                onLoadEnd={(syntheticEvent) => {
                  updateTabState(runningTabInstance.id, { loading: false, title: syntheticEvent.nativeEvent.title, url: syntheticEvent.nativeEvent.url });
                  if (frameSelectionFlag) setInputUrl(syntheticEvent.nativeEvent.url);
                  commitHistoryNode(syntheticEvent.nativeEvent.title, syntheticEvent.nativeEvent.url);
                }}
                onNavigationStateChange={(navigationMetricsState) => {
                  updateTabState(runningTabInstance.id, { canGoBack: navigationMetricsState.canGoBack, canGoForward: navigationMetricsState.canGoForward, url: navigationMetricsState.url });
                  if (frameSelectionFlag) setInputUrl(navigationMetricsState.url);
                }}
                onLoadProgress={(computedProgressEvent) => frameSelectionFlag && setProgress(computedProgressEvent.nativeEvent.progress)}
                style={isNightMode ? layoutStyles.nightModeInjectedStyleWebViewAlpha : null}
              />
            </View>
          );
        })}
      </View>

      {/* --- RUNTIME ANIMATED FADE TOAST OVERLAY (VIA STYLE) --- */}
      {showToast && (
        <Animated.View style={[layoutStyles.globalFloatingToastContainerBox, { opacity: toastFadeAnim }]}>
          <Text style={layoutStyles.globalToastMessageTextLabel}>{toastMessage}</Text>
        </Animated.View>
      )}

      {/* --- DYNAMIC ROBOT ANCHOR CONTROLLER --- */}
      {isAiEnabled && !showTabSwitcher && !currentModal && !showAiPanel && (
        <TouchableOpacity style={layoutStyles.floatingAssistantInteractiveActionCircleNode} onPress={() => executeCloudAiGatewayRequest('summary')}>
          <Text style={{ fontSize: 24 }}>🤖</Text>
        </TouchableOpacity>
      )}

      {/* --- BASE DECK TOOLBAR PANEL --- */}
      <View style={[layoutStyles.dockActionToolbarSystemPanel, isNightMode && layoutStyles.nightComponentPanel]}>
        <TouchableOpacity disabled={!activeTab.canGoBack} onPress={() => webViewRefs.current[activeTabId]?.goBack()}>
          <Text style={[layoutStyles.dockEmojiControlLabel, !activeTab.canGoBack && layoutStyles.dockControlAssetDisabledState]}>◀</Text>
        </TouchableOpacity>
        <TouchableOpacity disabled={!activeTab.canGoForward} onPress={() => webViewRefs.current[activeTabId]?.goForward()}>
          <Text style={[layoutStyles.dockEmojiControlLabel, !activeTab.canGoForward && layoutStyles.dockControlAssetDisabledState]}>▶</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => toggleBottomMenu(!isMenuVisible)}>
          <Text style={layoutStyles.dockEmojiControlLabel}>☰</Text>
        </TouchableOpacity>
      </View>

      {/* --- HORIZONTAL SYMMETRIC GRID SHEET --- */}
      {isMenuVisible && (
        <Animated.View style={[layoutStyles.menuSheetStructureAbsoluteWrapper, isNightMode && layoutStyles.nightComponentPanel, { transform: [{ translateY: slideAnimation }] }]}>
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} snapToInterval={SCREEN_WIDTH} decelerationRate="fast">
            {/* SLIDE 1: Via Clean Minimalist Vector Assets Grid */}
            <View style={[layoutStyles.paginatedSlideRenderContainerPage, { width: SCREEN_WIDTH }]}>
              <View style={layoutStyles.symmetricMatrixBalancedFlexGridRow}>
                {primarySlideCollection.map((gridItemNode) => (
                  <TouchableOpacity key={gridItemNode.id} style={layoutStyles.interactiveCellGridBlockItem} onPress={gridItemNode.action}>
                    <View style={[
                      layoutStyles.emojiAssetContainerPlateBox, 
                      isNightMode && { backgroundColor: '#333333', borderColor: '#444' },
                      gridItemNode.isActive && layoutStyles.blueHighlightedIconPlateBg
                    ]}>
                      <ViaIcon type={gridItemNode.iconType} color={gridItemNode.isActive ? '#4f46e5' : (isNightMode ? '#aaa' : '#475569')} size={22} />
                    </View>
                    <Text style={[
                      layoutStyles.gridLabelTextStringDescription, 
                      isNightMode && { color: '#cccccc' },
                      gridItemNode.isActive && layoutStyles.blueHighlightedTextLabel
                    ]} numberOfLines={1}>
                      {gridItemNode.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* SLIDE 2: Remainder Workspace Nodes Expansion */}
            <View style={[layoutStyles.paginatedSlideRenderContainerPage, { width: SCREEN_WIDTH }]}>
              <View style={layoutStyles.symmetricMatrixBalancedFlexGridRowAlternativeGapLayout}>
                {secondarySlideCollection.map((gridItemNode) => (
                  <TouchableOpacity key={gridItemNode.id} style={layoutStyles.interactiveCellGridBlockItem} onPress={gridItemNode.action}>
                    <View style={[
                      layoutStyles.emojiAssetContainerPlateBox, 
                      isNightMode && { backgroundColor: '#333333', borderColor: '#444' },
                      gridItemNode.isActive && layoutStyles.blueHighlightedIconPlateBg
                    ]}>
                      <ViaIcon type={gridItemNode.iconType} color={gridItemNode.isActive ? '#4f46e5' : (isNightMode ? '#aaa' : '#475569')} size={22} />
                    </View>
                    <Text style={[
                      layoutStyles.gridLabelTextStringDescription, 
                      isNightMode && { color: '#cccccc' },
                      gridItemNode.isActive && layoutStyles.blueHighlightedTextLabel
                    ]} numberOfLines={1}>
                      {gridItemNode.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>

          <View style={layoutStyles.sliderProgressBulletTrackBarRow}>
            <View style={layoutStyles.bulletNodeIndicatorActive} />
            <View style={layoutStyles.bulletNodeIndicatorInactive} />
          </View>
        </Animated.View>
      )}

      {/* --- ALL WINDOW SYSTEMS SWITCHERS OVERLAYS --- */}
      {showTabSwitcher && (
        <View style={[layoutStyles.fullscreenSystemOverlayContainerBlock, isNightMode && layoutStyles.nightModeShellBG]}>
          <View style={[layoutStyles.overlayNavbarHeaderDashboardPanel, isNightMode && layoutStyles.nightComponentPanel]}>
            <Text style={[layoutStyles.overlayHeaderTitleTextString, isNightMode && { color: '#ffffff' }]}>Tab Matrix Engine</Text>
            <TouchableOpacity style={layoutStyles.createNewWorkspaceActionTextButtonAsset} onPress={() => createNewTab()}>
              <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '700' }}>+ Blank Node</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={tabs}
            numColumns={2}
            keyExtractor={item => item.id}
            contentContainerStyle={{ padding: 12 }}
            renderItem={({ item }) => (
              <View style={[layoutStyles.workspaceItemCardGridPlate, item.id === activeTabId && layoutStyles.activeWorkspaceBorderTrackColorIndicator, isNightMode && { backgroundColor: '#1e1e1e' }]}>
                <View style={layoutStyles.workspaceItemCardHeaderFlexBlockRow}>
                  <Text style={[layoutStyles.workspaceCardTitleTextStringLabel, isNightMode && { color: '#ffffff' }]} numberOfLines={1}>{item.title}</Text>
                  <TouchableOpacity style={layoutStyles.workspaceCardCloseInteractiveNodeAsset} onPress={() => closeTab(item.id)}>
                    <Text style={{ color: '#94a3b8', fontSize: 14, fontWeight: '700' }}>✕</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={layoutStyles.workspaceCardInteractiveClickAreaContainer} onPress={() => { setActiveTabId(item.id); setInputUrl(item.url); setShowTabSwitcher(false); }}>
                  <Text style={layoutStyles.workspaceCardContentUrlTextStringDescription} numberOfLines={4}>{item.url}</Text>
                </TouchableOpacity>
              </View>
            )}
          />
          <TouchableOpacity style={layoutStyles.closeFullscreenSystemOverlayBtnFooter} onPress={() => setShowTabSwitcher(false)}>
            <Text style={layoutStyles.closeSystemFooterBtnLabelString}>Resume Session Execution</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* --- COMBINED HISTORY & BOOKMARKS SYSTEM WINDOW --- */}
      {currentModal === 'history_bookmark' && (
        <View style={[layoutStyles.fullscreenSystemOverlayContainerBlock, isNightMode && layoutStyles.nightModeShellBG]}>
          <View style={[layoutStyles.modalTwinSubTabsHeaderNavigationBarFlexRow, isNightMode && layoutStyles.nightComponentPanel]}>
            <TouchableOpacity style={[layoutStyles.modalTabSelectorItemBtnElement, activeSubTab === 'bookmarks' && layoutStyles.modalTabSelectorItemBtnElementActiveBorderBorder]} onPress={() => setActiveSubTab('bookmarks')}>
              <Text style={[layoutStyles.modalSubTabLabelTextAssetString, activeSubTab === 'bookmarks' && layoutStyles.modalSubTabLabelTextAssetStringActiveTextMode, isNightMode && activeSubTab !== 'bookmarks' && { color: '#a0aec0' }]}>Bookmarks</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[layoutStyles.modalTabSelectorItemBtnElement, activeSubTab === 'history' && layoutStyles.modalTabSelectorItemBtnElementActiveBorderBorder]} onPress={() => setActiveSubTab('history')}>
              <Text style={[layoutStyles.modalSubTabLabelTextAssetString, activeSubTab === 'history' && layoutStyles.modalSubTabLabelTextAssetStringActiveTextMode, isNightMode && activeSubTab !== 'history' && { color: '#a0aec0' }]}>History</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={layoutStyles.modalScrollBodyCoreRenderingContentAreaScrollLayout}>
            {activeSubTab === 'bookmarks' ? (
              bookmarks.length === 0 ? <Text style={layoutStyles.emptyStateIllustrationTextStringLabel}>No entries locked inside bookmarks catalog node.</Text> :
              bookmarks.map(b => (
                <TouchableOpacity key={b.id} style={layoutStyles.dataRowRecordInteractiveListItemLogsBlock} onPress={() => { navigateToUrl(b.url); setCurrentModal(null); }}>
                  <Text style={[layoutStyles.dataRowRecordPrimaryHeadlineTitleLabelText, isNightMode && { color: '#ffffff' }]} numberOfLines={1}>{b.title}</Text>
                  <Text style={layoutStyles.dataRowRecordSecondaryUrlDescriptionText} numberOfLines={1}>{b.url}</Text>
                </TouchableOpacity>
              ))
            ) : (
              <View>
                {history.length > 0 && (
                  <TouchableOpacity style={layoutStyles.actionButtonTriggerWipeOperationsHandler} onPress={wipeHistoryCollection}>
                    <Text style={{ color: '#ef4444', fontWeight: '700', fontSize: 14 }}>Purge Storage Log Database</Text>
                  </TouchableOpacity>
                )}
                {history.length === 0 ? <Text style={layoutStyles.emptyStateIllustrationTextStringLabel}>No history records detected.</Text> :
                history.map(h => (
                  <TouchableOpacity key={h.id} style={layoutStyles.dataRowRecordInteractiveListItemLogsBlock} onPress={() => { navigateToUrl(h.url); setCurrentModal(null); }}>
                    <Text style={[layoutStyles.dataRowRecordPrimaryHeadlineTitleLabelText, isNightMode && { color: '#ffffff' }]} numberOfLines={1}>{h.title}</Text>
                    <Text style={layoutStyles.dataRowRecordSecondaryUrlDescriptionText} numberOfLines={1}>{h.url} • {h.time}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </ScrollView>
          <TouchableOpacity style={layoutStyles.closeFullscreenSystemOverlayBtnFooter} onPress={() => setCurrentModal(null)}>
            <Text style={layoutStyles.closeSystemFooterBtnLabelString}>Close Data Matrix Panel</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* --- STANDALONE DOWNLOADS MANAGEMENT SUB SYSTEM --- */}
      {currentModal === 'downloads' && (
        <View style={[layoutStyles.fullscreenSystemOverlayContainerBlock, isNightMode && layoutStyles.nightModeShellBG]}>
          <View style={[layoutStyles.modalSingleHeaderTitleNavbarElementBlock, isNightMode && layoutStyles.nightComponentPanel]}>
            <Text style={[layoutStyles.modalSingleNavbarHeaderHeadlineTitleLabelString, isNightMode && { color: '#ffffff' }]}>Downloads Hub</Text>
          </View>
          <ScrollView style={layoutStyles.modalScrollBodyCoreRenderingContentAreaScrollLayout}>
            {downloads.map(d => (
              <View key={d.id} style={layoutStyles.dataRowRecordInteractiveListItemLogsBlock}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={[layoutStyles.dataRowRecordPrimaryHeadlineTitleLabelText, isNightMode && { color: '#ffffff' }], { flex: 1, marginRight: 8 }} numberOfLines={1}>{d.name}</Text>
                  <Text style={{ color: '#10b981', fontWeight: '700', fontSize: 13 }}>{d.size}</Text>
                </View>
                <Text style={layoutStyles.dataRowRecordSecondaryUrlDescriptionText}>Logs Status: {d.status} • Write Stamp: {d.date}</Text>
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity style={layoutStyles.closeFullscreenSystemOverlayBtnFooter} onPress={() => setCurrentModal(null)}>
            <Text style={layoutStyles.closeSystemFooterBtnLabelString}>Close Storage Cluster</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* --- USER SYSTEM CONTROL SETTINGS PANEL --- */}
      {currentModal === 'settings' && (
        <View style={[layoutStyles.fullscreenSystemOverlayContainerBlock, isNightMode && layoutStyles.nightModeShellBG]}>
          <View style={[layoutStyles.modalSingleHeaderTitleNavbarElementBlock, isNightMode && layoutStyles.nightComponentPanel]}>
            <Text style={[layoutStyles.modalSingleNavbarHeaderHeadlineTitleLabelString, isNightMode && { color: '#ffffff' }]}>Configuration Settings</Text>
          </View>
          <View style={layoutStyles.settingsMenuInnerOperationalContainerLayoutSectionBlock}>
            <View style={layoutStyles.settingsPanelInteractiveToggleConfigurationRowItem}>
              <View style={{ flex: 1, marginRight: 16 }}>
                <Text style={[layoutStyles.settingsToggleItemPrimaryHeadlineLabelTextString, isNightMode && { color: '#ffffff' }]}>Show AI Floating Portal</Text>
                <Text style={layoutStyles.settingsToggleItemSecondarySubDescriptionTextString}>Inject LLaMA dynamic assistant viewport anchor matrix tracks</Text>
              </View>
              <Switch
                value={isAiEnabled}
                onValueChange={async (updatedSwitchToggleValueFlag) => {
                  setIsAiEnabled(updatedSwitchToggleValueFlag);
                  await AsyncStorage.setItem('@vault_ai_enabled', JSON.stringify(updatedSwitchToggleValueFlag));
                }}
              />
            </View>
          </View>
          <TouchableOpacity style={layoutStyles.closeFullscreenSystemOverlayBtnFooter} onPress={() => setCurrentModal(null)}>
            <Text style={layoutStyles.closeSystemFooterBtnLabelString}>Save Settings Parameters</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* --- COGNITIVE CORE LLAMA ASSISTANT BOTTOM SHEET PANEL --- */}
      {showAiPanel && (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[layoutStyles.aiEngineFloatingPanelBottomSheetResponseContainerBlockBox, isNightMode && { backgroundColor: '#1e1e1e', borderTopColor: '#333333' }]}>
          <View style={layoutStyles.aiEnginePanelHeaderRowTitleBarActionsLayoutFlexBlock}>
            <Text style={[layoutStyles.aiEngineHeadlineTitleStringLabelText, isNightMode && { color: '#ffffff' }]}>Groq LLaMA Core Node Assistant</Text>
            <TouchableOpacity style={layoutStyles.aiEngineCloseActionAnchorInteractNode} onPress={() => setShowAiPanel(false)}>
              <Text style={{ color: '#ef4444', fontWeight: '800', fontSize: 14 }}>Dismiss</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1, padding: 16 }}>
            {aiLoading ? (
              <View style={layoutStyles.aiEngineLoaderIndicatorCentralSpinnerWrapperContainer}>
                <ActivityIndicator size="large" color="#4f46e5" />
                <Text style={[{ marginTop: 16, color: '#64748b', fontWeight: '500' }, isNightMode && { color: '#a0aec0' }]}>Computing vectors parsing map...</Text>
              </View>
            ) : (
              <Text style={[layoutStyles.aiEngineOutputMarkdownResponseContentStringProseBody, isNightMode && { color: '#e2e8f0' }]}>{aiResponse}</Text>
            )}
          </ScrollView>
          <View style={layoutStyles.aiEngineInputInteractiveFooterCommandRowControlBlock}>
            <TextInput
              style={[layoutStyles.aiEngineInputControlTextEntryBoxFieldField, isNightMode && { color: '#ffffff', backgroundColor: '#2d2d2d', borderColor: '#444444' }]}
              placeholder="Query current operational DOM content context..."
              value={aiPrompt}
              onChangeText={setAiPrompt}
              placeholderTextColor="#94a3b8"
            />
            <TouchableOpacity style={layoutStyles.aiEngineSubmitPromptInteractiveActionNodeBtnAsset} onPress={() => executeCloudAiGatewayRequest('query')}>
              <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 13 }}>Execute</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

// ============================================================================
// SYSTEM PRODUCTION MINIMAL SPECIFICATION DESIGN STYLESHEET
// ============================================================================
const layoutStyles = StyleSheet.create({
  appShell: { flex: 1, backgroundColor: '#f8fafc' },
  nightModeShellBG: { backgroundColor: '#121212' },
  nightComponentPanel: { backgroundColor: '#1e1e1e', borderBottomColor: '#2d2d2d', borderTopColor: '#2d2d2d' },
  nightModeInjectedStyleWebViewAlpha: { opacity: 0.9, backgroundColor: '#121212' },

  navbarContainerPanel: { height: 65, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', gap: 10, paddingTop: 5 },
  navbarIconButtonAsset: { width: 42, height: 42, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f1f5f9', borderRadius: 21 },
  inputAreaWrapperField: { flex: 1, height: 42, backgroundColor: '#f1f5f9', borderRadius: 21, paddingHorizontal: 16, justifyContent: 'center', position: 'relative', overflow: 'hidden' },
  inputFieldCoreElement: { flex: 1, fontSize: 14, color: '#1e293b', paddingVertical: 0 },
  loadingTrackProgress: { position: 'absolute', bottom: 0, left: 0, height: 3, backgroundColor: '#4f46e5' },
  tabsNumberIndicatorBadge: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: '#475569', justifyContent: 'center', alignItems: 'center' },
  tabsCounterTextString: { fontSize: 12, fontWeight: '800', color: '#475569' },

  webviewCoreLayoutContainerBody: { flex: 1, backgroundColor: '#cbd5e1' },
  webviewFrameStructuralContainer: { flex: 1 },

  floatingAssistantInteractiveActionCircleNode: { position: 'absolute', right: 24, bottom: 80, backgroundColor: '#ffffff', width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', elevation: 8, zIndex: 99999 },
  globalFloatingToastContainerBox: { position: 'absolute', bottom: 120, left: SCREEN_WIDTH * 0.15, right: SCREEN_WIDTH * 0.15, backgroundColor: 'rgba(45, 55, 72, 0.94)', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 25, zIndex: 9999999, elevation: 12 },
  globalToastMessageTextLabel: { color: '#ffffff', fontSize: 14, fontWeight: '600', textAlign: 'center' },

  dockActionToolbarSystemPanel: { height: 56, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', backgroundColor: '#ffffff', borderTopWidth: 1, borderTopColor: '#e2e8f0', zIndex: 999 },
  dockEmojiControlLabel: { fontSize: 24, color: '#334155' },
  dockControlAssetDisabledState: { color: '#cbd5e1' },

  menuSheetStructureAbsoluteWrapper: { backgroundColor: '#ffffff', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingVertical: 20, position: 'absolute', bottom: 56, left: 0, right: 0, elevation: 24, zIndex: 99999, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  paginatedSlideRenderContainerPage: { paddingHorizontal: 20 },
  symmetricMatrixBalancedFlexGridRow: { flexDirection: 'row', flexWrap: 'wrap', width: '100%', justifyContent: 'space-between' },
  symmetricMatrixBalancedFlexGridRowAlternativeGapLayout: { flexDirection: 'row', flexWrap: 'wrap', width: '100%', justifyContent: 'flex-start', gap: 14 },
  interactiveCellGridBlockItem: { width: '22%', alignItems: 'center', marginVertical: 12 },
  emojiAssetContainerPlateBox: { width: 52, height: 52, borderRadius: 16, backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center', marginBottom: 8, borderWidth: 1, borderColor: '#f1f5f9' },
  gridLabelTextStringDescription: { fontSize: 11, color: '#64748b', fontWeight: '600', textAlign: 'center' },
  sliderProgressBulletTrackBarRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 14 },
  bulletNodeIndicatorActive: { width: 16, height: 6, borderRadius: 3, backgroundColor: '#4f46e5', marginHorizontal: 3 },
  bulletNodeIndicatorInactive: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#cbd5e1', marginHorizontal: 3 },

  blueHighlightedIconPlateBg: { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' },
  blueHighlightedTextLabel: { color: '#3b82f6', fontWeight: '700' },

  fullscreenSystemOverlayContainerBlock: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: '#ffffff', zIndex: 999999, justifyContent: 'space-between' },
  overlayNavbarHeaderDashboardPanel: { height: 70, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingTop: 15 },
  overlayHeaderTitleTextString: { fontSize: 18, fontWeight: '800', color: '#1e293b' },
  createNewWorkspaceActionTextButtonAsset: { backgroundColor: '#4f46e5', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  closeFullscreenSystemOverlayBtnFooter: { height: 58, backgroundColor: '#4f46e5', justifyContent: 'center', alignItems: 'center' },
  closeSystemFooterBtnLabelString: { color: '#ffffff', fontWeight: '700', fontSize: 16 },

  workspaceItemCardGridPlate: { flex: 0.5, height: 140, backgroundColor: '#f8fafc', margin: 8, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#e2e8f0', justifyContent: 'space-between' },
  activeWorkspaceBorderTrackColorIndicator: { borderColor: '#4f46e5', borderWidth: 2.5 },
  workspaceItemCardHeaderFlexBlockRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  workspaceCardTitleTextStringLabel: { fontSize: 14, fontWeight: '700', color: '#334155', flex: 1, marginRight: 6 },
  workspaceCardCloseInteractiveNodeAsset: { padding: 4 },
  workspaceCardInteractiveClickAreaContainer: { flex: 1, paddingTop: 10 },
  workspaceCardContentUrlTextStringDescription: { fontSize: 11, color: '#64748b', lineHeight: 15 },

  modalTwinSubTabsHeaderNavigationBarFlexRow: { flexDirection: 'row', height: 65, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', backgroundColor: '#f8fafc', paddingTop: 15 },
  modalTabSelectorItemBtnElement: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  modalTabSelectorItemBtnElementActiveBorderBorder: { borderBottomWidth: 3, borderBottomColor: '#4f46e5' },
  modalSubTabLabelTextAssetString: { fontSize: 16, fontWeight: '700', color: '#64748b' },
  modalSubTabLabelTextAssetStringActiveTextMode: { color: '#4f46e5' },
  modalScrollBodyCoreRenderingContentAreaScrollLayout: { flex: 1, paddingHorizontal: 18, paddingTop: 10 },
  emptyStateIllustrationTextStringLabel: { textAlign: 'center', color: '#94a3b8', marginTop: 60, fontSize: 14, fontWeight: '500' },
  actionButtonTriggerWipeOperationsHandler: { padding: 14, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', marginBottom: 10 },

  dataRowRecordInteractiveListItemLogsBlock: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  dataRowRecordPrimaryHeadlineTitleLabelText: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  dataRowRecordSecondaryUrlDescriptionText: { fontSize: 12, color: '#94a3b8', marginTop: 4, lineHeight: 16 },

  modalSingleHeaderTitleNavbarElementBlock: { height: 70, justifyContent: 'center', paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingTop: 15 },
  modalSingleNavbarHeaderHeadlineTitleLabelString: { fontSize: 19, fontWeight: '800', color: '#1e293b' },

  settingsMenuInnerOperationalContainerLayoutSectionBlock: { flex: 1, paddingHorizontal: 18, paddingTop: 12 },
  settingsPanelInteractiveToggleConfigurationRowItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  settingsToggleItemPrimaryHeadlineLabelTextString: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  settingsToggleItemSecondarySubDescriptionTextString: { fontSize: 13, color: '#64748b', marginTop: 3, lineHeight: 17 },

  aiEngineFloatingPanelBottomSheetResponseContainerBlockBox: { position: 'absolute', bottom: 0, left: 0, right: 0, height: SCREEN_HEIGHT * 0.68, backgroundColor: '#ffffff', borderTopLeftRadius: 28, borderTopRightRadius: 28, elevation: 24, zIndex: 99999999, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  aiEnginePanelHeaderRowTitleBarActionsLayoutFlexBlock: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  aiEngineHeadlineTitleStringLabelText: { fontSize: 16, fontWeight: '800', color: '#1e293b' },
  aiEngineCloseActionAnchorInteractNode: { padding: 4 },
  aiEngineLoaderIndicatorCentralSpinnerWrapperContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 },
  aiEngineOutputMarkdownResponseContentStringProseBody: { fontSize: 15, color: '#334155', lineHeight: 24, fontWeight: '400' },
  aiEngineInputInteractiveFooterCommandRowControlBlock: { flexDirection: 'row', padding: 14, borderTopWidth: 1, borderTopColor: '#e2e8f0', gap: 10, alignItems: 'center', backgroundColor: '#f8fafc', paddingBottom: Platform.OS === 'ios' ? 24 : 14 },
  aiEngineInputControlTextEntryBoxFieldField: { flex: 1, height: 42, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 21, paddingHorizontal: 16, color: '#1e293b', backgroundColor: '#ffffff', fontSize: 14 },
  aiEngineSubmitPromptInteractiveActionNodeBtnAsset: { backgroundColor: '#4f46e5', paddingHorizontal: 20, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' }
});
