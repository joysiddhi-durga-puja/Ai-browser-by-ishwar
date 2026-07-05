import React, { useState, useRef, useEffect } from 'react';
import {
  SafeAreaView,
  StatusBar,
  View,
  Text,
  TouchableOpacity,
  BackHandler,
  Alert,
  Share,
  Animated
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ScreenCapture from 'expo-screen-capture';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

const SAF = FileSystem.StorageAccessFramework;
const PUBLIC_FOLDER_KEY = 'aiBrowserPublicFolderUri';

// Reads whatever folder the user picked in Settings > Download settings.
// If none picked yet, prompts once on first download and remembers it.
const getPublicFolderUri = async () => {
  const saved = await AsyncStorage.getItem(PUBLIC_FOLDER_KEY);
  if (saved) return saved;
  return ensureAiBrowserFolder();
};

// User only picks the ROOT (internal storage or SD card) — we always
// create/reuse an "AI Browser" subfolder inside it, so the folder name
// itself never changes.
const ensureAiBrowserFolder = async () => {
  const perm = await SAF.requestDirectoryPermissionsAsync();
  if (!perm.granted) return null;
  const existing = await SAF.readDirectoryAsync(perm.directoryUri);
  const match = existing.find(uri => decodeURIComponent(uri).endsWith('/AI Browser'));
  const folderUri = match || await SAF.createFileAsync(perm.directoryUri, 'AI Browser', 'vnd.android.document/directory');
  await AsyncStorage.setItem(PUBLIC_FOLDER_KEY, folderUri);
  return folderUri;
};

const storageLabelFromUri = (uri) => (/\/primary[%:]/.test(uri) ? 'AI Browser (Phone storage)' : 'AI Browser (SD card)');

import { HOME_URL, GROQ_ENDPOINT, PAGE_QUESTION_SCAN_JS } from './constants';
import { startBackgroundAudio, stopBackgroundAudio, setBackgroundAudioPlaying, subscribeToBackgroundAudioActions } from './BackgroundAudioBridge';
import layoutStyles from './styles';
import ViaIcon from './ViaIcon';

import TopBar from './components/TopBar';
import BrowserTabsView from './components/BrowserTabsView';
import Toast from './components/Toast';
import BottomDock from './components/BottomDock';
import MenuSheet from './components/MenuSheet';
import TabSwitcherModal from './components/TabSwitcherModal';
import HistoryBookmarkModal from './components/HistoryBookmarkModal';
import DownloadsModal from './components/DownloadsModal';
import SettingsModal from './components/SettingsModal';
import ZipPusherModal from './components/ZipPusherModal';
import AiPanel from './components/AiPanel';

// ============================================================================
// COMPONENT MAIN MODULE ENTRY
// ============================================================================
export default function App() {
  const [tabs, setTabs] = useState([
    { id: '1', url: HOME_URL, title: 'Homepage', loading: false, canGoBack: false, canGoForward: false }
  ]);
  const [activeTabId, setActiveTabId] = useState('1');
  const [inputUrl, setInputUrl] = useState(HOME_URL);
  const [showTabSwitcher, setShowTabSwitcher] = useState(false);
  const [progress, setProgress] = useState(0);

  // Home screen inline-search state: when true, the "Homepage" label in the
  // navbar (and the pill on the home screen) swap into a live TextInput in
  // the exact same spot.
  const [isHomeSearchActive, setIsHomeSearchActive] = useState(false);
  const [homeSearchText, setHomeSearchText] = useState('');
  const homeSearchInputRef = useRef(null);

  const [isAiEnabled, setIsAiEnabled] = useState(true);
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [currentModal, setCurrentModal] = useState(null);
  const [activeSubTab, setActiveSubTab] = useState('bookmarks');

  const [bookmarks, setBookmarks] = useState([]);
  const [history, setHistory] = useState([]);
  const [downloads, setDownloads] = useState([]);
  const [isNightMode, setIsNightMode] = useState(false);
  const [isIncognito, setIsIncognito] = useState(false);
  const [isDesktopMode, setIsDesktopMode] = useState(false);

  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);

  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiMessages, setAiMessages] = useState([]);
  const [aiLoading, setAiLoading] = useState(false);
  const autoAnswerPendingTabId = useRef(null);

  // User-configurable AI credentials/model, set from the Settings modal.
  const [aiApiKey, setAiApiKey] = useState('');
  const [aiApiKeyDraft, setAiApiKeyDraft] = useState('');
  const [aiModel, setAiModel] = useState('llama-3.3-70b-versatile');

  // User-chosen public download folder (SD card or internal storage —
  // whatever the user picks in the system folder dialog).
  const [downloadFolderUri, setDownloadFolderUri] = useState(null);
  const [downloadFolderLabel, setDownloadFolderLabel] = useState('Not set — tap to choose');

  const slideAnimation = useRef(new Animated.Value(350)).current;
  const toastFadeAnim = useRef(new Animated.Value(0)).current;
  const webViewRefs = useRef({});
  const activeTabIdRef = useRef(activeTabId);
  useEffect(() => { activeTabIdRef.current = activeTabId; }, [activeTabId]);

  // Lockscreen/notification play-pause button has nothing of its own to
  // control — forward it into the actual <video> element playing in the
  // active tab's WebView.
  useEffect(() => {
    const unsubscribe = subscribeToBackgroundAudioActions((action) => {
      const webViewRef = webViewRefs.current[activeTabIdRef.current];
      if (!webViewRef) return;
      if (action === 'pause') {
        webViewRef.injectJavaScript("(function(){var v=document.querySelector('video'); if(v) v.pause();})(); true;");
      } else if (action === 'play') {
        webViewRef.injectJavaScript("(function(){var v=document.querySelector('video'); if(v) v.play();})(); true;");
      }
    });
    return unsubscribe;
  }, []);

  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];
  const isHomeActive = activeTab.url === HOME_URL;

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
      if (isHomeSearchActive) { setIsHomeSearchActive(false); return true; }
      if (activeTab && activeTab.canGoBack && webViewRefs.current[activeTabId]) {
        webViewRefs.current[activeTabId].goBack();
        return true;
      }
      if (tabs.length > 1) { closeTab(activeTabId); return true; }
      return false;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [showAiPanel, currentModal, showTabSwitcher, isMenuVisible, isHomeSearchActive, activeTabId, tabs]);

  useEffect(() => { initializeLocalDatabase(); }, []);

  useEffect(() => {
    AsyncStorage.getItem(PUBLIC_FOLDER_KEY).then(uri => {
      if (uri) {
        setDownloadFolderUri(uri);
        setDownloadFolderLabel(storageLabelFromUri(uri));
      }
    });
  }, []);

  const chooseDownloadFolder = async () => {
    if (Platform.OS !== 'android') {
      showBrowserToast("Folder picker is Android only");
      return;
    }
    const folderUri = await ensureAiBrowserFolder();
    if (!folderUri) return;
    setDownloadFolderUri(folderUri);
    setDownloadFolderLabel(storageLabelFromUri(folderUri));
    showBrowserToast("Download folder updated");
  };

  // Blocks screenshots/screen-recording while any incognito tab is open.
  useEffect(() => {
    const hasIncognitoTab = tabs.some(t => t.isIncognito);
    if (hasIncognitoTab) {
      ScreenCapture.preventScreenCaptureAsync();
    } else {
      ScreenCapture.allowScreenCaptureAsync();
    }
  }, [tabs]);

  const initializeLocalDatabase = async () => {
    try {
      const storedBookmarks = await AsyncStorage.getItem('@vault_bookmarks');
      const storedHistory = await AsyncStorage.getItem('@vault_history');
      const storedDownloads = await AsyncStorage.getItem('@vault_downloads');
      const storedAiConfig = await AsyncStorage.getItem('@vault_ai_enabled');
      const storedTheme = await AsyncStorage.getItem('@vault_night_mode');
      const storedAiApiKey = await AsyncStorage.getItem('@vault_ai_api_key');
      const storedAiModel = await AsyncStorage.getItem('@vault_ai_model');

      if (storedBookmarks) setBookmarks(JSON.parse(storedBookmarks));
      if (storedHistory) setHistory(JSON.parse(storedHistory));
      if (storedDownloads) setDownloads(JSON.parse(storedDownloads));
      if (storedAiConfig) setIsAiEnabled(JSON.parse(storedAiConfig));
      if (storedTheme) setIsNightMode(JSON.parse(storedTheme));
      if (storedAiApiKey) { setAiApiKey(storedAiApiKey); setAiApiKeyDraft(storedAiApiKey); }
      if (storedAiModel) setAiModel(storedAiModel);
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
    if (!rawTargetUrl || rawTargetUrl === HOME_URL) return;
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
    setIsHomeSearchActive(false);
    setHomeSearchText('');
    toggleBottomMenu(false);
  };

  const updateTabState = (targetId, mutatedState) => {
    setTabs(prev => prev.map(currentTab => currentTab.id === targetId ? { ...currentTab, ...mutatedState } : currentTab));
  };

  // Sends the active tab back to the built-in Homepage screen.
  const goHome = () => {
    updateTabState(activeTabId, { url: HOME_URL, title: 'Homepage', canGoBack: false, canGoForward: false });
    setInputUrl(HOME_URL);
    setIsHomeSearchActive(false);
    setHomeSearchText('');
    setShowTabSwitcher(false);
    toggleBottomMenu(false);
  };

  // Swaps the "Homepage" label (in the navbar and the center pill) into a
  // live search TextInput, in the exact same spot.
  const activateHomeSearch = () => {
    setHomeSearchText('');
    setIsHomeSearchActive(true);
    setTimeout(() => homeSearchInputRef.current?.focus(), 50);
  };

  const submitHomeSearch = () => {
    if (!homeSearchText.trim()) { setIsHomeSearchActive(false); return; }
    navigateToUrl(homeSearchText);
  };

  const createNewTab = (fallbackUrl = HOME_URL) => {
    const allocatedId = Date.now().toString();
    const runtimeTabPayload = { id: allocatedId, url: fallbackUrl, title: fallbackUrl === HOME_URL ? 'Homepage' : 'New Tab', loading: false, canGoBack: false, canGoForward: false, isIncognito: isIncognito };
    setTabs([...tabs, runtimeTabPayload]);
    setActiveTabId(allocatedId);
    setInputUrl(fallbackUrl);
    setIsHomeSearchActive(false);
    setShowTabSwitcher(false);
  };

  const closeTab = (idToClose) => {
    if (tabs.length === 1) {
      updateTabState(idToClose, { url: HOME_URL, title: 'Homepage' });
      setInputUrl(HOME_URL);
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

  // Closes every open tab at once (Chrome/Safari "Close All"), leaving a
  // single fresh Homepage tab behind so the browser never ends up tab-less.
  const closeAllTabs = () => {
    const freshId = Date.now().toString();
    webViewRefs.current = {};
    setTabs([{ id: freshId, url: HOME_URL, title: 'Homepage', loading: false, canGoBack: false, canGoForward: false, isIncognito: isIncognito }]);
    setActiveTabId(freshId);
    setInputUrl(HOME_URL);
    setShowTabSwitcher(false);
  };

  // Moves a tab from one position to another (drag-to-reorder in the tab switcher).
  const reorderTabs = (fromIndex, toIndex) => {
    setTabs(prevTabs => {
      if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= prevTabs.length || toIndex >= prevTabs.length) return prevTabs;
      const updated = [...prevTabs];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      return updated;
    });
  };

  // Closes every tab flagged incognito (called when incognito mode is turned off).
  const closeAllIncognitoTabs = () => {
    const remainingTabs = tabs.filter(t => !t.isIncognito);
    const closedIds = tabs.filter(t => t.isIncognito).map(t => t.id);
    closedIds.forEach(id => delete webViewRefs.current[id]);

    if (remainingTabs.length === 0) {
      const freshId = Date.now().toString();
      const freshTab = { id: freshId, url: HOME_URL, title: 'Homepage', loading: false, canGoBack: false, canGoForward: false, isIncognito: false };
      setTabs([freshTab]);
      setActiveTabId(freshId);
      setInputUrl(HOME_URL);
      return;
    }

    setTabs(remainingTabs);
    if (!remainingTabs.find(t => t.id === activeTabId)) {
      setActiveTabId(remainingTabs[0].id);
      setInputUrl(remainingTabs[0].url);
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

  const commitHistoryNode = async (computedTitle, computedUrl, tabIsIncognito) => {
    if (tabIsIncognito) return;
    const now = new Date();
    const dateLabel = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: '2-digit' });
    const historyPayload = { id: Date.now().toString(), title: computedTitle || computedUrl, url: computedUrl, time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), dateLabel };
    const mutationSet = [historyPayload, ...history.slice(0, 250)];
    setHistory(mutationSet);
    await AsyncStorage.setItem('@vault_history', JSON.stringify(mutationSet));
  };

  const wipeHistoryCollection = async () => {
    setHistory([]);
    await AsyncStorage.removeItem('@vault_history');
    showBrowserToast("History completely purged");
  };

  // ==========================================================================
  // REAL DOWNLOAD ENGINE
  // Uses expo-file-system's resumable downloader so we get genuine
  // byte-level progress callbacks (like Chrome's download notification),
  // saving into the app's private sandbox. Sharing.shareAsync is then used
  // to let the person save the finished file into Downloads/Drive/WhatsApp/
  // wherever they want, since writing straight into the public Downloads
  // folder needs extra native permissions this project doesn't request.
  // ==========================================================================
  const formatByteSize = (bytes) => {
    if (!bytes || bytes <= 0) return '0 KB';
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex++;
    }
    return `${value.toFixed(value < 10 && unitIndex > 0 ? 1 : 0)} ${units[unitIndex]}`;
  };

  const persistDownloadsSnapshot = async (snapshot) => {
    try { await AsyncStorage.setItem('@vault_downloads', JSON.stringify(snapshot)); } catch {}
  };

  const startFileDownload = async (fileUrl) => {
    const downloadId = Date.now().toString();
    let fileName = 'download';
    try {
      const cleanPath = decodeURIComponent(fileUrl.split('?')[0].split('#')[0]);
      const lastSegment = cleanPath.substring(cleanPath.lastIndexOf('/') + 1);
      if (lastSegment) fileName = lastSegment;
    } catch {}
    const destinationUri = `${FileSystem.documentDirectory}${downloadId}_${fileName}`;

    const newEntry = { id: downloadId, name: fileName, url: fileUrl, localUri: null, size: '0 KB', progress: 0, status: 'Downloading', date: new Date().toLocaleString() };
    setDownloads(prev => [newEntry, ...prev]);
    setCurrentModal('downloads');
    showBrowserToast(`Downloading ${fileName}`);

    const patchEntry = (patch) => {
      setDownloads(prev => prev.map(d => (d.id === downloadId ? { ...d, ...patch } : d)));
    };

    try {
      const downloadResumable = FileSystem.createDownloadResumable(
        fileUrl,
        destinationUri,
        {},
        ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
          const pct = totalBytesExpectedToWrite > 0 ? Math.min(100, Math.round((totalBytesWritten / totalBytesExpectedToWrite) * 100)) : 0;
          patchEntry({
            progress: pct,
            size: totalBytesExpectedToWrite > 0 ? `${formatByteSize(totalBytesWritten)} / ${formatByteSize(totalBytesExpectedToWrite)}` : formatByteSize(totalBytesWritten)
          });
        }
      );
      const result = await downloadResumable.downloadAsync();
      if (!result || !result.uri) throw new Error('empty download result');

      let finalUri = result.uri;
      if (Platform.OS === 'android') {
        try {
          const folderUri = await getPublicFolderUri();
          if (folderUri) {
            const mimeType = 'application/octet-stream';
            const targetFileUri = await SAF.createFileAsync(folderUri, fileName, mimeType);
            const base64Data = await FileSystem.readAsStringAsync(result.uri, { encoding: FileSystem.EncodingType.Base64 });
            await FileSystem.writeAsStringAsync(targetFileUri, base64Data, { encoding: FileSystem.EncodingType.Base64 });
            await FileSystem.deleteAsync(result.uri, { idempotent: true });
            finalUri = targetFileUri;
          }
        } catch {
          // permission denied / SAF failure — keep the private-sandbox copy
          // so the download still shows up in the in-app Downloads list.
        }
      }

      setDownloads(prev => {
        const next = prev.map(d => (d.id === downloadId ? { ...d, progress: 100, status: 'Completed', localUri: finalUri } : d));
        persistDownloadsSnapshot(next);
        return next;
      });
      showBrowserToast(`${fileName} downloaded`);
    } catch (error) {
      patchEntry({ status: 'Failed' });
      showBrowserToast(`Couldn't download ${fileName}`);
    }
  };

  const openDownloadedFile = async (entry) => {
    if (!entry.localUri) { showBrowserToast("File isn't ready yet"); return; }
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(entry.localUri);
    } else {
      showBrowserToast("Sharing isn't available on this device");
    }
  };

  const deleteDownloadEntry = async (id) => {
    const target = downloads.find(d => d.id === id);
    setDownloads(prev => {
      const next = prev.filter(d => d.id !== id);
      persistDownloadsSnapshot(next);
      return next;
    });
    if (target?.localUri) FileSystem.deleteAsync(target.localUri, { idempotent: true }).catch(() => {});
  };

  const clearAllDownloads = async () => {
    const toDelete = downloads.filter(d => d.localUri);
    setDownloads([]);
    await AsyncStorage.removeItem('@vault_downloads');
    toDelete.forEach(d => FileSystem.deleteAsync(d.localUri, { idempotent: true }).catch(() => {}));
  };

  const persistAiSettings = async () => {
    const trimmedKey = aiApiKeyDraft.trim();
    setAiApiKey(trimmedKey);
    await AsyncStorage.setItem('@vault_ai_api_key', trimmedKey);
    await AsyncStorage.setItem('@vault_ai_model', aiModel);
    showBrowserToast("AI settings saved");
    setCurrentModal(null);
  };

  const onToggleAiEnabled = async (updatedSwitchToggleValueFlag) => {
    setIsAiEnabled(updatedSwitchToggleValueFlag);
    await AsyncStorage.setItem('@vault_ai_enabled', JSON.stringify(updatedSwitchToggleValueFlag));
  };

  const executeCloudAiGatewayRequest = async () => {
    const promptText = aiPrompt.trim();
    if (!promptText) return;

    if (!aiApiKey) {
      setShowAiPanel(true);
      setAiMessages(prev => [...prev, { id: `ai-${Date.now()}`, role: 'ai', content: 'Groq API key set nahi hai abhi. Settings me jaake apni API key add karo.' }]);
      return;
    }

    const userMessage = { id: `user-${Date.now()}`, role: 'user', content: promptText };
    setAiMessages(prev => [...prev, userMessage]);
    setAiPrompt('');
    setAiLoading(true);
    setShowAiPanel(true);

    const systemInstructions = `You are a helpful assistant embedded in a mobile browser app. Keep answers concise and mobile-friendly. Current page: ${activeTab.url}. If the user's question naturally breaks into multiple short question/answer items (FAQs, quiz-style questions, a list of questions, etc.), respond ONLY as a markdown table with exactly these columns: | Sl No | Question | Answer |. Otherwise answer normally in short plain sentences.`;

    try {
      const remoteResponse = await fetch(GROQ_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${aiApiKey}`
        },
        body: JSON.stringify({
          model: aiModel,
          messages: [
            { role: 'system', content: systemInstructions },
            { role: 'user', content: promptText }
          ],
          temperature: 0.4,
          max_tokens: 1024
        })
      });
      const unmarshalledJson = await remoteResponse.json();
      let replyText;
      if (unmarshalledJson?.error) {
        replyText = `Groq error: ${unmarshalledJson.error.message || 'request failed'}`;
      } else {
        replyText = unmarshalledJson?.choices?.[0]?.message?.content || 'Empty.';
      }
      setAiMessages(prev => [...prev, { id: `ai-${Date.now()}`, role: 'ai', content: replyText }]);
    } catch (err) {
      setAiMessages(prev => [...prev, { id: `ai-${Date.now()}`, role: 'ai', content: 'Connection error aa gaya, dobara try karo.' }]);
    } finally {
      setAiLoading(false);
    }
  };

  // Fires on every WebView postMessage. The page question scanner
  // (PAGE_QUESTION_SCAN_JS) is the only sender right now — it runs
  // automatically after each page load (deciding whether the Auto Answer
  // button should show) and again on-demand right before an Auto Answer
  // request goes out (so the AI gets fresh page text).
  const handleWebViewMessage = (tabId, event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'AI_PAGE_SCAN') {
        updateTabState(tabId, {
          hasUnansweredQuestions: !!data.hasQuestions && data.unansweredCount > 0,
          scannedPageText: data.pageText || ''
        });
        if (autoAnswerPendingTabId.current === tabId) {
          autoAnswerPendingTabId.current = null;
          runAutoAnswerForTab(tabId, data.pageText || '');
        }
      } else if (data.type === 'media-play-state') {
        const tabForMedia = tabs.find(t => t.id === tabId);
        const mediaTitle = (tabForMedia && tabForMedia.title) || 'AI Browser';
        let mediaArtist = 'Playing in background';
        try { mediaArtist = new URL(tabForMedia?.url || '').hostname || mediaArtist; } catch (e) {}
        if (data.playing) {
          startBackgroundAudio(mediaTitle, mediaArtist);
        } else {
          // Keep the lockscreen/notification session alive but flipped to
          // "paused" rather than killing it outright — otherwise pressing
          // pause on the lockscreen would make its own resume button
          // vanish along with the notification.
          setBackgroundAudioPlaying(false);
        }
      } else if (data.type === 'sponsor-segment-skipped') {
        showBrowserToast("Sponsor Skipped");
      }
    } catch (e) { /* ignore malformed messages */ }
  };

  const runAutoAnswerForTab = async (tabId, pageText) => {
    if (!aiApiKey) { showBrowserToast("Pehle Settings me AI API key set karo"); return; }

    setAiMessages(prev => [...prev, { id: `user-${Date.now()}`, role: 'user', content: 'Auto Answer — is page ke sawalon ke jawab do' }]);
    setShowAiPanel(true);
    setAiLoading(true);

    const systemInstructions = `You are analyzing a web page's text to find questions and answer them.\nPage text:\n${pageText || '(no text extracted)'}\nFind any questions present in this text (FAQs, quiz questions, form questions, etc.) and answer each one accurately using the page content.\nRespond with ONLY valid JSON, no markdown, no extra text, in this exact format:\n[{"question":"...","answer":"concise answer"}]\nIf no questions are found, respond with exactly: []`;

    try {
      const remoteResponse = await fetch(GROQ_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${aiApiKey}`
        },
        body: JSON.stringify({
          model: aiModel,
          messages: [{ role: 'user', content: systemInstructions }],
          temperature: 0.3,
          max_tokens: 1200
        })
      });
      const unmarshalledJson = await remoteResponse.json();
      const raw = unmarshalledJson?.choices?.[0]?.message?.content || '[]';
      const cleaned = raw.replace(/```json|```/g, '').trim();
      let items = [];
      try {
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed)) items = parsed;
      } catch (e) { items = []; }

      if (items.length === 0) {
        setAiMessages(prev => [...prev, { id: `ai-${Date.now()}`, role: 'ai', content: 'Is page mein koi clear question nahi mila jiska jawab de saku.' }]);
      } else {
        setAiMessages(prev => [...prev, { id: `ai-${Date.now()}`, role: 'ai', qaTable: items }]);
      }
    } catch (err) {
      setAiMessages(prev => [...prev, { id: `ai-${Date.now()}`, role: 'ai', content: 'Connection error aa gaya, dobara try karo.' }]);
    } finally {
      setAiLoading(false);
    }
  };

  // Re-scans the active page for freshness right before asking the AI,
  // rather than relying on the scan cached at page-load time.
  const triggerAutoAnswer = () => {
    const webViewRef = webViewRefs.current[activeTabId];
    if (!webViewRef) return;
    autoAnswerPendingTabId.current = activeTabId;
    webViewRef.injectJavaScript(PAGE_QUESTION_SCAN_JS);
  };

  // --- DYNAMIC CORE NAVIGATION MATRIX BINDINGS ---
  const actionItemsSchema = [
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
      id: 'incognito',
      label: 'Incognito',
      iconType: 'incognito',
      isActive: isIncognito,
      action: () => {
        const nextState = !isIncognito;
        setIsIncognito(nextState);
        if (!nextState) {
          closeAllIncognitoTabs();
          showBrowserToast("Incognito closed — all private tabs cleared");
        } else {
          // Flag the CURRENT tab incognito right away — otherwise
          // preventScreenCaptureAsync() (App.js effect below) only
          // fires once a brand-new incognito tab is opened, leaving
          // screenshots possible right after toggling.
          updateTabState(activeTabId, { isIncognito: true });
          showBrowserToast("You've gone incognito");
        }
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
    { id: 'zip_pusher', label: 'ZIP → GitHub', iconType: 'zip_push', isActive: false, action: () => { setCurrentModal('zip_pusher'); toggleBottomMenu(false); } },
    { id: 'settings', label: 'Settings', iconType: 'settings', isActive: false, action: () => { setCurrentModal('settings'); toggleBottomMenu(false); } },
  ];

  return (
    <SafeAreaView style={[layoutStyles.appShell, isNightMode && layoutStyles.nightModeShellBG]}>
      <StatusBar barStyle={isNightMode ? "light-content" : "dark-content"} backgroundColor={isNightMode ? "#121212" : "#ffffff"} />

      <TopBar
        isHomeActive={isHomeActive}
        isNightMode={isNightMode}
        isHomeSearchActive={isHomeSearchActive}
        homeSearchText={homeSearchText}
        setHomeSearchText={setHomeSearchText}
        homeSearchInputRef={homeSearchInputRef}
        submitHomeSearch={submitHomeSearch}
        activateHomeSearch={activateHomeSearch}
        setIsHomeSearchActive={setIsHomeSearchActive}
        setShowTabSwitcher={setShowTabSwitcher}
        inputUrl={inputUrl}
        setInputUrl={setInputUrl}
        navigateToUrl={navigateToUrl}
        progress={progress}
        createNewTab={createNewTab}
        tabsCount={tabs.length}
        isIncognitoTab={activeTab.isIncognito}
      />

      <BrowserTabsView
        tabs={tabs}
        activeTabId={activeTabId}
        isNightMode={isNightMode}
        isDesktopMode={isDesktopMode}
        webViewRefs={webViewRefs}
        updateTabState={updateTabState}
        setInputUrl={setInputUrl}
        setProgress={setProgress}
        commitHistoryNode={commitHistoryNode}
        activateHomeSearch={activateHomeSearch}
        startFileDownload={startFileDownload}
        showTabSwitcher={showTabSwitcher}
        onWebViewMessage={handleWebViewMessage}
        navigateToUrl={navigateToUrl}
        createNewTab={createNewTab}
        showBrowserToast={showBrowserToast}
      />

      <Toast showToast={showToast} toastMessage={toastMessage} toastFadeAnim={toastFadeAnim} />

      {/* --- DYNAMIC ROBOT ANCHOR CONTROLLER --- */}
      {isAiEnabled && !showTabSwitcher && !currentModal && !showAiPanel && (
        <TouchableOpacity style={layoutStyles.floatingAssistantInteractiveActionCircleNode} onPress={() => setShowAiPanel(true)}>
          <ViaIcon type="ai_spark" size={26} color="#ffffff" />
        </TouchableOpacity>
      )}

      <BottomDock
        activeTab={activeTab}
        webViewRefs={webViewRefs}
        activeTabId={activeTabId}
        goHome={goHome}
        isNightMode={isNightMode}
        tabsCount={tabs.length}
        setShowTabSwitcher={setShowTabSwitcher}
        isMenuVisible={isMenuVisible}
        toggleBottomMenu={toggleBottomMenu}
      />

      <MenuSheet
        isMenuVisible={isMenuVisible}
        isNightMode={isNightMode}
        slideAnimation={slideAnimation}
        actionItemsSchema={actionItemsSchema}
        onRequestClose={() => toggleBottomMenu(false)}
      />

      <TabSwitcherModal
        visible={showTabSwitcher}
        tabs={tabs}
        activeTabId={activeTabId}
        isNightMode={isNightMode}
        createNewTab={createNewTab}
        closeTab={closeTab}
        setActiveTabId={setActiveTabId}
        setInputUrl={setInputUrl}
        setIsHomeSearchActive={setIsHomeSearchActive}
        setShowTabSwitcher={setShowTabSwitcher}
        closeAllTabs={closeAllTabs}
      />

      <HistoryBookmarkModal
        visible={currentModal === 'history_bookmark'}
        activeSubTab={activeSubTab}
        setActiveSubTab={setActiveSubTab}
        bookmarks={bookmarks}
        history={history}
        isNightMode={isNightMode}
        navigateToUrl={navigateToUrl}
        setCurrentModal={setCurrentModal}
        wipeHistoryCollection={wipeHistoryCollection}
      />

      <DownloadsModal
        visible={currentModal === 'downloads'}
        downloads={downloads}
        isNightMode={isNightMode}
        setCurrentModal={setCurrentModal}
        openDownloadedFile={openDownloadedFile}
        deleteDownloadEntry={deleteDownloadEntry}
        clearAllDownloads={clearAllDownloads}
      />

      <SettingsModal
        visible={currentModal === 'settings'}
        isNightMode={isNightMode}
        isAiEnabled={isAiEnabled}
        onToggleAiEnabled={onToggleAiEnabled}
        aiApiKeyDraft={aiApiKeyDraft}
        setAiApiKeyDraft={setAiApiKeyDraft}
        aiModel={aiModel}
        setAiModel={setAiModel}
        persistAiSettings={persistAiSettings}
        downloadFolderLabel={downloadFolderLabel}
        chooseDownloadFolder={chooseDownloadFolder}
        setCurrentModal={setCurrentModal}
      />

      <ZipPusherModal
        visible={currentModal === 'zip_pusher'}
        isNightMode={isNightMode}
        setCurrentModal={setCurrentModal}
        showToast={showBrowserToast}
      />

      <AiPanel
        visible={showAiPanel}
        isNightMode={isNightMode}
        aiLoading={aiLoading}
        aiMessages={aiMessages}
        aiPrompt={aiPrompt}
        setAiPrompt={setAiPrompt}
        executeCloudAiGatewayRequest={executeCloudAiGatewayRequest}
        setShowAiPanel={setShowAiPanel}
        showAutoAnswerButton={!!aiApiKey && !isHomeActive && !!activeTab.hasUnansweredQuestions}
        triggerAutoAnswer={triggerAutoAnswer}
      />
    </SafeAreaView>
  );
}
