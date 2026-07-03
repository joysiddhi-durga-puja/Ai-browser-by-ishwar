import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  FlatList,
  Image,
  ScrollView,
  Modal,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Animated,
  Easing,
  Dimensions,
  PanResponder,
  Share,
  Alert,
  BackHandler,
  StatusBar as RNStatusBar,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as ScreenCapture from 'expo-screen-capture';
import * as MediaLibrary from 'expo-media-library';
import { captureRef } from 'react-native-view-shot';

const AI_ENDPOINT = 'https://ai-browser-by-iswar.vercel.app/api/ask';
const GROQ_DIRECT_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'openai/gpt-oss-20b';
const KNOWN_MODELS = [
  { id: 'openai/gpt-oss-20b', label: 'GPT-OSS 20B', hint: 'Fast, great default' },
  { id: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B', hint: 'Flagship, higher quality' },
  { id: 'meta-llama/llama-4-scout-17b-16e-instruct', label: 'Llama 4 Scout', hint: 'Fast, supports images' },
  { id: 'meta-llama/llama-4-maverick-17b-128e-instruct', label: 'Llama 4 Maverick', hint: 'Stronger reasoning' },
  { id: 'qwen/qwen3-32b', label: 'Qwen3 32B', hint: 'Good all-rounder' },
  { id: 'moonshotai/kimi-k2-instruct-0905', label: 'Kimi K2', hint: 'Large context' },
];

const HOME_URL = 'https://www.google.com';
const HOME_MARKER = 'app://home';
const HISTORY_KEY = 'history_v1';
const BOOKMARKS_KEY = 'bookmarks_v1';
const DOWNLOADS_KEY = 'downloads_v1';
const AI_PROVIDER_KEY = 'ai_provider_v1';
const ADMIN_UNLOCK_KEY = 'ai_admin_unlocked_v1';
const AUTOFILL_PROFILE_KEY = 'autofill_profile_v1';
const STORAGE_LOCATION_KEY = 'storage_location_v1';
const AD_BLOCKER_KEY = 'ad_block_v1';
const ADMIN_PASSCODE = 'joysiddhi123';
const MAX_HISTORY = 200;
const TOP_PADDING = Platform.OS === 'android' ? (RNStatusBar.currentHeight || 24) : 0;
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

let tabIdCounter = 1;
const makeTab = (url = HOME_MARKER, opts = {}) => ({
  id: tabIdCounter++,
  url,
  title: url === HOME_MARKER ? 'Homepage' : url,
  canGoBack: false,
  canGoForward: false,
  loading: url !== HOME_MARKER,
  isIncognito: !!opts.incognito,
  thumbnail: null,
});

const MENU_ITEMS_DEF = [
  { key: 'night', icon: '🌙', label: 'Night mode' },
  { key: 'reload', icon: '⟳', label: 'Reload' },
  { key: 'bookmarks', icon: '📑', label: 'Bookmarks' },
  { key: 'history', icon: '🕘', label: 'History' },
  { key: 'downloads', icon: '⬇️', label: 'Downloads' },
  { key: 'adblock', icon: '🛡️', label: 'Ad Block' },
  { key: 'incognito', icon: '🕵️', label: 'Incognito' },
  { key: 'share', icon: '🔗', label: 'Share' },
  { key: 'addBookmark', icon: '⭐', label: 'Add bookmark' },
  { key: 'desktop', icon: '🖥️', label: 'Desktop site' },
  { key: 'autofillInfo', icon: '🪪', label: 'My info' },
  { key: 'storageSettings', icon: '⚙️', label: 'Settings' }, 
];

const AI_MODES = {
  ask: { hint: 'Thinking…' },
  explain: { hint: 'Explaining the page…' },
  tldr: { hint: 'Summarizing…' },
};

function buildMessages(mode, question, pageContext, pageUrl) {
  const context = (pageContext || '').slice(0, 6000);
  if (mode === 'explain') {
    return [
      { role: 'system', content: 'You explain web pages in a clear, mobile-friendly way for a general audience.' },
      { role: 'user', content: `Page URL: ${pageUrl || ''}\n\nPage content:\n${context}\n\nExplain what this page is about in a detailed, mobile-friendly breakdown.` },
    ];
  }
  if (mode === 'tldr') {
    return [
      { role: 'system', content: 'You write extremely short TL;DR summaries of long web pages for a mobile reader, as 3-5 crisp bullet points, no preamble.' },
      { role: 'user', content: `Page URL: ${pageUrl || ''}\n\nPage content:\n${context}\n\nGive a TL;DR summary as 3-5 short bullet points.` },
    ];
  }
  return [
    { role: 'system', content: 'You answer questions about the current web page the user is viewing, using the provided page text as context.' },
    { role: 'user', content: `Page URL: ${pageUrl || ''}\n\nPage content:\n${context}\n\nQuestion: ${question || 'Summarize this page briefly.'}` },
  ];
}

async function callGroqDirect(apiKey, model, mode, question, pageContext, pageUrl) {
  const messages = buildMessages(mode, question, pageContext, pageUrl);
  const res = await fetch(GROQ_DIRECT_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: model || DEFAULT_MODEL, messages, temperature: 0.4 }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message || 'Groq request failed');
  return { answer: json?.choices?.[0]?.message?.content || '' };
}

export default function App() {
  const [tabs, setTabs] = useState([makeTab()]);
  const [activeTabId, setActiveTabId] = useState(tabs[0].id);
  const [urlInput, setUrlInput] = useState('');
  const [nightMode, setNightMode] = useState(false);
  const [desktopMode, setDesktopMode] = useState(false);
  const [homeSearchInput, setHomeSearchInput] = useState('');
  const [homeUrlBarActive, setHomeUrlBarActive] = useState(false);
  const [showFloatingMenu, setShowFloatingMenu] = useState(false);
  const [bookmarks, setBookmarks] = useState([]);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [downloads, setDownloads] = useState([]);
  const [showDownloads, setShowDownloads] = useState(false);
  const [librarySearch, setLibrarySearch] = useState('');
  const [libraryMounted, setLibraryMounted] = useState(false);
  const libraryPanelAnim = useRef(new Animated.Value(SCREEN_W)).current;

  // --- Core States for New Features ---
  const [storageLocation, setStorageLocation] = useState('phone'); 
  const [adBlockerEnabled, setAdBlockerEnabled] = useState(true);
  const [activeDownload, setActiveDownload] = useState(null);
  const downloadToastAnim = useRef(new Animated.Value(100)).current;

  // --- Modals Animation Drivers ---
  const [showTabSwitcher, setShowTabSwitcher] = useState(false);
  const [tabSwitcherMounted, setTabSwitcherMounted] = useState(false);
  const tabSwitcherAnim = useRef(new Animated.Value(SCREEN_H)).current;

  const [showMenu, setShowMenu] = useState(false);
  const [menuMounted, setMenuMounted] = useState(false);
  const menuAnim = useRef(new Animated.Value(SCREEN_H)).current;

  const [showStorageModal, setShowStorageModal] = useState(false);
  const [storageMounted, setStorageMounted] = useState(false);
  const storageAnim = useRef(new Animated.Value(SCREEN_H)).current;

  const [showAIPanel, setShowAIPanel] = useState(false);
  const [aiPanelMounted, setAiPanelMounted] = useState(false);
  const aiPanelAnim = useRef(new Animated.Value(SCREEN_H)).current;
  const [aiMode, setAiMode] = useState('ask');
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiAnswer, setAiAnswer] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(false);

  const [aiProvider, setAiProvider] = useState({ mode: 'none', apiKey: '', model: DEFAULT_MODEL });
  const [showAISettings, setShowAISettings] = useState(false);
  const [aiSettingsMounted, setAiSettingsMounted] = useState(false);
  const aiSettingsAnim = useRef(new Animated.Value(SCREEN_H)).current;
  const [customKeyInput, setCustomKeyInput] = useState('');
  const [customModelInput, setCustomModelInput] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminPrompt, setShowAdminPrompt] = useState(false);
  const [adminMounted, setAdminMounted] = useState(false);
  const adminAnim = useRef(new Animated.Value(SCREEN_H)).current;
  const [adminPasscodeInput, setAdminPasscodeInput] = useState('');
  const [adminError, setAdminError] = useState(false);

  const [autofillProfile, setAutofillProfile] = useState({
    fullName: '', email: '', phone: '', address: '', city: '', state: '', pincode: '', country: '',
  });
  const [showAutofillSettings, setShowAutofillSettings] = useState(false);
  const [autofillMounted, setAutofillMounted] = useState(false);
  const autofillAnim = useRef(new Animated.Value(SCREEN_H)).current;
  const [autofillDraft, setAutofillDraft] = useState(autofillProfile);

  const webviewRefs = useRef({});
  const viewShotRefs = useRef({});
  const progressAnim = useRef(new Animated.Value(0)).current;
  const [showTldrButton, setShowTldrButton] = useState(false);
  const [showFillFormButton, setShowFillFormButton] = useState(false);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const isBookmarked = activeTab && bookmarks.some((b) => b.url === activeTab.url);
  const showLibrary = showBookmarks || showHistory || showDownloads;
  const libraryTab = showBookmarks ? 'bookmarks' : showDownloads ? 'downloads' : 'history';

  const AD_BLOCK_JS = `
    (function() {
      var selectors = ['div[id^="google_ads"]', 'ins.adsbygoogle', 'div[class*="ad-box"]', 'div[class*="ad-container"]', 'div[class*="advertising"]', 'iframe[src*="doubleclick"]', 'div[id*="ad-slot"]', 'img[src*="banner"]', 'div[class*="native-ad"]'];
      function purgeAds() {
        selectors.forEach(function(sel) {
          var elements = document.querySelectorAll(sel);
          for (var i = 0; i < elements.length; i++) { elements[i].style.setProperty('display', 'none', 'important'); elements[i].remove(); }
        });
      }
      purgeAds(); setInterval(purgeAds, 1000);
    })(); true;
  `;

  const animateModal = (animDrive, toValue, duration, onComplete) => {
    Animated.timing(animDrive, {
      toValue,
      duration,
      easing: toValue === 0 ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(onComplete);
  };

  useEffect(() => {
    if (showTabSwitcher) { setTabSwitcherMounted(true); animateModal(tabSwitcherAnim, 0, 280); }
    else if (tabSwitcherMounted) { animateModal(tabSwitcherAnim, SCREEN_H, 240, () => setTabSwitcherMounted(false)); }
  }, [showTabSwitcher]);

  useEffect(() => {
    if (showMenu) { setMenuMounted(true); animateModal(menuAnim, 0, 280); }
    else if (menuMounted) { animateModal(menuAnim, SCREEN_H, 240, () => setMenuMounted(false)); }
  }, [showMenu]);

  useEffect(() => {
    if (showStorageModal) { setStorageMounted(true); animateModal(storageAnim, 0, 280); }
    else if (storageMounted) { animateModal(storageAnim, SCREEN_H, 240, () => setStorageMounted(false)); }
  }, [showStorageModal]);

  useEffect(() => {
    if (showAIPanel) { setAiPanelMounted(true); animateModal(aiPanelAnim, 0, 300); }
    else if (aiPanelMounted) { animateModal(aiPanelAnim, SCREEN_H, 250, () => setAiPanelMounted(false)); }
  }, [showAIPanel]);

  useEffect(() => {
    if (showAISettings) { setAiSettingsMounted(true); animateModal(aiSettingsAnim, 0, 280); }
    else if (aiSettingsMounted) { animateModal(aiSettingsAnim, SCREEN_H, 240, () => setAiSettingsMounted(false)); }
  }, [showAISettings]);

  useEffect(() => {
    if (showAutofillSettings) { setAutofillMounted(true); animateModal(autofillAnim, 0, 300); }
    else if (autofillMounted) { animateModal(autofillAnim, SCREEN_H, 250, () => setAutofillMounted(false)); }
  }, [showAutofillSettings]);

  useEffect(() => {
    if (showAdminPrompt) { setAdminMounted(true); animateModal(adminAnim, 0, 280); }
    else if (adminMounted) { animateModal(adminAnim, SCREEN_H, 240, () => setAdminMounted(false)); }
  }, [showAdminPrompt]);

  useEffect(() => {
    if (showLibrary) {
      setLibraryMounted(true);
      Animated.timing(libraryPanelAnim, { toValue: 0, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    } else if (libraryMounted) {
      Animated.timing(libraryPanelAnim, { toValue: SCREEN_W, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() => setLibraryMounted(false));
    }
  }, [showLibrary]);

  useEffect(() => {
    (async () => {
      try {
        const storedBookmarks = await AsyncStorage.getItem(BOOKMARKS_KEY);
        if (storedBookmarks) setBookmarks(JSON.parse(storedBookmarks));
        const storedHistory = await AsyncStorage.getItem(HISTORY_KEY);
        if (storedHistory) setHistory(JSON.parse(storedHistory));
        const storedDownloads = await AsyncStorage.getItem(DOWNLOADS_KEY);
        if (storedDownloads) setDownloads(JSON.parse(storedDownloads));
        const storedAdmin = await AsyncStorage.getItem(ADMIN_UNLOCK_KEY);
        setIsAdmin(storedAdmin === 'true');
        const storedLocation = await AsyncStorage.getItem(STORAGE_LOCATION_KEY);
        if (storedLocation) setStorageLocation(storedLocation);
        const storedAdBlock = await AsyncStorage.getItem(AD_BLOCKER_KEY);
        if (storedAdBlock !== null) setAdBlockerEnabled(storedAdBlock === 'true');
        const storedProvider = await AsyncStorage.getItem(AI_PROVIDER_KEY);
        if (storedProvider) {
          const parsed = JSON.parse(storedProvider);
          setAiProvider({ ...parsed, model: parsed.model || DEFAULT_MODEL });
        }
        const storedProfile = await AsyncStorage.getItem(AUTOFILL_PROFILE_KEY);
        if (storedProfile) setAutofillProfile(JSON.parse(storedProfile));
      } catch (e) {}
    })();
  }, []);

  const closeLibrary = () => { setShowBookmarks(false); setShowHistory(false); setShowDownloads(false); setLibrarySearch(''); };
  const switchLibraryTab = (tab) => { setShowBookmarks(tab === 'bookmarks'); setShowHistory(tab === 'history'); setShowDownloads(tab === 'downloads'); setLibrarySearch(''); };

  const formatDateLabel = (ts) => {
    const d = new Date(ts); const today = new Date(); const yest = new Date(); yest.setDate(today.getDate() - 1);
    const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    if (sameDay(d, today)) return 'Today'; if (sameDay(d, yest)) return 'Yesterday';
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: '2-digit' });
  };

  const buildLibraryRows = () => {
    const q = librarySearch.trim().toLowerCase();
    const matches = (title, url) => !q || (title || '').toLowerCase().includes(q) || (url || '').toLowerCase().includes(q);
    if (libraryTab === 'bookmarks') return bookmarks.filter((b) => matches(b.title, b.url)).map((b, i) => ({ type: 'item', kind: 'bookmarks', key: `b${i}`, data: b }));
    const source = libraryTab === 'downloads' ? downloads : history;
    const filtered = source.filter((d) => matches(d.title || d.name, d.url));
    const rows = []; let lastLabel = null;
    filtered.forEach((item, i) => {
      const label = formatDateLabel(item.ts);
      if (label !== lastLabel) { rows.push({ type: 'header', key: `h${i}`, label }); lastLabel = label; }
      rows.push({ type: 'item', kind: libraryTab, key: `i${i}`, data: item });
    });
    return rows;
  };

  useEffect(() => {
    if (activeTab?.isIncognito) ScreenCapture.preventScreenCaptureAsync().catch(() => {});
    else ScreenCapture.allowScreenCaptureAsync().catch(() => {});
  }, [activeTab?.isIncognito]);

  useEffect(() => {
    if (activeTab?.loading) {
      progressAnim.setValue(0);
      Animated.timing(progressAnim, { toValue: 0.8, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();
    } else {
      Animated.timing(progressAnim, { toValue: 1, duration: 200, useNativeDriver: false }).start(() => progressAnim.setValue(0));
    }
  }, [activeTab?.loading, activeTabId]);

  useEffect(() => {
    const backAction = () => {
      if (showMenu) { setShowMenu(false); return true; }
      if (showFloatingMenu) { setShowFloatingMenu(false); return true; }
      if (showAdminPrompt) { setShowAdminPrompt(false); return true; }
      if (showAutofillSettings) { setShowAutofillSettings(false); return true; }
      if (showAISettings) { setShowAISettings(false); return true; }
      if (showAIPanel) { setShowAIPanel(false); return true; }
      if (showTabSwitcher) { setShowTabSwitcher(false); return true; }
      if (showLibrary) { closeLibrary(); return true; }
      if (activeTab && activeTab.url !== HOME_MARKER && activeTab.canGoBack) { webviewRefs.current[activeTabId]?.goBack(); return true; }
      if (activeTab && activeTab.url !== HOME_MARKER) { goHome(); return true; }
      if (tabs.length > 1) { closeTab(activeTabId); return true; }
      Alert.alert('Exit AI Browser?', 'Kya aap app band karna chahte hain?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Exit', style: 'destructive', onPress: () => BackHandler.exitApp() },
      ]);
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => sub.remove();
  }, [activeTab, activeTabId, tabs, showMenu, showFloatingMenu, showAdminPrompt, showAutofillSettings, showAISettings, showAIPanel, showTabSwitcher, showLibrary]);

  const updateTab = (id, patch) => { setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t))); };
  
  const captureTabThumbnail = async (id) => {
    try {
      const node = viewShotRefs.current[id]; if (!node) return;
      const uri = await captureRef(node, { format: 'jpg', quality: 0.4, width: 300 });
      updateTab(id, { thumbnail: uri });
    } catch (e) {}
  };

  const addTab = (url = HOME_MARKER, opts = {}) => {
    const newTab = makeTab(url, opts); setTabs((prev) => [...prev, newTab]); setActiveTabId(newTab.id);
    setUrlInput(newTab.url === HOME_MARKER ? '' : newTab.url); setShowTabSwitcher(false);
  };

  const closeTab = (id) => {
    setTabs((prev) => {
      const filtered = prev.filter((t) => t.id !== id);
      if (filtered.length === 0) { const fresh = makeTab(); setActiveTabId(fresh.id); setUrlInput(fresh.url); return [fresh]; }
      if (id === activeTabId) { const next = filtered[filtered.length - 1]; setActiveTabId(next.id); setUrlInput(next.url); }
      return filtered;
    });
    delete webviewRefs.current[id]; delete viewShotRefs.current[id];
  };

  const handleAddNewTabSmoothly = () => { setShowTabSwitcher(false); setTimeout(() => { addTab(); }, 250); };
  const handleSwitchTabSmoothly = (id) => {
    if (activeTabId !== id) captureTabThumbnail(activeTabId);
    setShowTabSwitcher(false);
    setTimeout(() => {
      setActiveTabId(id); setShowTldrButton(false); const tab = tabs.find((t) => t.id === id);
      if (tab) setUrlInput(tab.url === HOME_MARKER ? '' : tab.url);
      if (tab && tab.url !== HOME_MARKER) { webviewRefs.current[id]?.injectJavaScript(buildNightModeJS(nightMode)); }
    }, 250);
  };

  const normalizeUrl = (input) => {
    const trimmed = input.trim(); if (!trimmed) return HOME_URL;
    const looksLikeUrl = /^https?:\/\//i.test(trimmed) || /^([\w-]+\.)+[a-z]{2,}(:\d+)?(\/.*)?$/i.test(trimmed);
    return looksLikeUrl ? (/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`) : `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
  };

  const navigate = () => { const finalUrl = normalizeUrl(urlInput); updateTab(activeTabId, { url: finalUrl, loading: true }); };
  const goBack = () => webviewRefs.current[activeTabId]?.goBack();
  const goForward = () => webviewRefs.current[activeTabId]?.goForward();
  const reload = () => webviewRefs.current[activeTabId]?.reload();
  const goHome = () => { updateTab(activeTabId, { url: HOME_MARKER, loading: false, title: 'Homepage' }); setUrlInput(''); };

  const persistBookmarks = async (updated) => { setBookmarks(updated); await AsyncStorage.setItem(BOOKMARKS_KEY, JSON.stringify(updated)); };
  const toggleBookmark = async () => {
    if (!activeTab) return;
    if (isBookmarked) await persistBookmarks(bookmarks.filter((b) => b.url !== activeTab.url));
    else await persistBookmarks([{ url: activeTab.url, title: activeTab.title }, ...bookmarks]);
  };
  const removeBookmark = async (url) => { await persistBookmarks(bookmarks.filter((b) => b.url !== url)); };

  const addToHistory = useCallback(async (url, title) => {
    if (!url || url === 'about:blank') return;
    setHistory((prev) => {
      if (prev[0]?.url === url) return prev;
      const updated = [{ url, title: title || url, ts: Date.now() }, ...prev].slice(0, MAX_HISTORY);
      AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated)).catch(() => {}); return updated;
    });
  }, []);
  const clearHistory = async () => { setHistory([]); await AsyncStorage.removeItem(HISTORY_KEY); };

  const openHomeSearch = () => {
    if (!homeSearchInput.trim()) return; const finalUrl = normalizeUrl(homeSearchInput);
    updateTab(activeTabId, { url: finalUrl, loading: true }); setUrlInput(finalUrl); setHomeSearchInput(''); setHomeUrlBarActive(false);
  };

  const buildNightModeJS = (on) => {
    const applyBlock = on ? "if (!s) { s = document.createElement('style'); s.id = '__ai_browser_night'; s.innerHTML = 'html{filter:invert(1) hue-rotate(180deg) !important;background:#111 !important;} img,video,picture,iframe,canvas{filter:invert(1) hue-rotate(180deg) !important;}'; document.head.appendChild(s); }" : "if (s) { s.remove(); }";
    return `(function() { var s = document.getElementById('__ai_browser_night'); ${applyBlock} })(); true;`;
  };

  const toggleNightMode = () => {
    setNightMode((prev) => {
      const next = !prev; if (activeTab && activeTab.url !== HOME_MARKER) webviewRefs.current[activeTabId]?.injectJavaScript(buildNightModeJS(next)); return next;
    });
  };

  const toggleAdBlockerHamburger = async () => {
    const nextState = !adBlockerEnabled; setAdBlockerEnabled(nextState);
    await AsyncStorage.setItem(AD_BLOCKER_KEY, String(nextState));
    if (activeTab && activeTab.url !== HOME_MARKER) {
      if (nextState) webviewRefs.current[activeTabId]?.injectJavaScript(AD_BLOCK_JS); else webviewRefs.current[activeTabId]?.reload();
    }
  };

  const handleTouchStart = (e) => { touchStartX.current = e.nativeEvent.pageX; touchStartY.current = e.nativeEvent.pageY; };
  const handleTouchEnd = (e) => {
    const deltaX = e.nativeEvent.pageX - touchStartX.current; const deltaY = e.nativeEvent.pageY - touchStartY.current;
    if (Math.abs(deltaX) > 100 && Math.abs(deltaY) < 60) {
      if (deltaX > 0 && activeTab?.canGoBack) webviewRefs.current[activeTabId]?.goBack();
      else if (deltaX < 0 && activeTab?.canGoForward) webviewRefs.current[activeTabId]?.goForward();
    }
  };

  const startDownload = async (url) => {
    if (!url) return; let filename = `download_${Date.now()}`;
    try { const parsedName = decodeURIComponent(url.split('/').pop().split('?')[0]); if (parsedName) filename = parsedName; } catch (e) {}
    const sandboxDest = FileSystem.documentDirectory + filename;
    Animated.timing(downloadToastAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();

    const callback = (downloadProgress) => {
      const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
      setActiveDownload((prev) => prev ? { ...prev, progress: Math.max(0, Math.min(1, progress)) } : null);
    };
    const resumable = FileSystem.createDownloadResumable(url, sandboxDest, {}, callback);
    setActiveDownload({ name: filename, progress: 0, resumableRef: resumable });

    try {
      const result = await resumable.downloadAsync();
      if (result) {
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status === 'granted') {
          if (Platform.OS === 'android') {
            try {
              let targetDirUri = storageLocation === 'sdcard' ? null : FileSystem.cacheDirectory;
              if (storageLocation === 'sdcard') {
                const safPermissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
                if (safPermissions.granted) targetDirUri = safPermissions.directoryUri;
              }
              if (targetDirUri) {
                const base64Data = await FileSystem.readAsStringAsync(result.uri, { encoding: FileSystem.EncodingType.Base64 });
                await FileSystem.StorageAccessFramework.createFileAsync(targetDirUri, `Ai browser/${filename}`, result.mimeType || 'application/octet-stream')
                  .then(async (safTargetFileUri) => { await FileSystem.writeAsStringAsync(safTargetFileUri, base64Data, { encoding: FileSystem.EncodingType.Base64 }); });
              }
            } catch (err) { await MediaLibrary.createAssetAsync(result.uri); }
          } else { await MediaLibrary.createAssetAsync(result.uri); }
        }
        const entry = { name: filename, uri: result.uri, url, ts: Date.now() };
        setDownloads([entry, ...downloads]); await AsyncStorage.setItem(DOWNLOADS_KEY, JSON.stringify([entry, ...downloads]));
        setActiveDownload((prev) => prev ? { ...prev, progress: 1 } : null);
        setTimeout(() => { Animated.timing(downloadToastAnim, { toValue: 100, duration: 300, useNativeDriver: true }).start(() => setActiveDownload(null)); }, 2500);
      }
    } catch (e) { setActiveDownload(null); }
  };

  const openDownload = async (entry) => { try { if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(entry.uri); } catch (e) {} };
  const deleteDownload = async (entry) => {
    try { await FileSystem.deleteAsync(entry.uri, { idempotent: true }); } catch (e) {}
    const updated = downloads.filter((d) => d.uri !== entry.uri); setDownloads(updated);
    await AsyncStorage.setItem(DOWNLOADS_KEY, JSON.stringify(updated));
  };

  const saveAIProvider = async (next) => { setAiProvider(next); await AsyncStorage.setItem(AI_PROVIDER_KEY, JSON.stringify(next)); };
  const selectProviderMode = async (mode) => {
    if (mode === 'default' && !isAdmin) { setShowAdminPrompt(true); return; }
    if (mode === 'custom') await saveAIProvider({ ...aiProvider, mode: 'custom', apiKey: customKeyInput.trim() });
    else await saveAIProvider({ ...aiProvider, mode, apiKey: aiProvider.apiKey || '' });
  };
  const saveCustomKey = async () => { await saveAIProvider({ ...aiProvider, mode: 'custom', apiKey: customKeyInput.trim() }); setShowAISettings(false); };
  const selectModel = async (modelId) => { setCustomModelInput(modelId); await saveAIProvider({ ...aiProvider, model: modelId }); };
  const saveCustomModel = async () => { if (!customModelInput.trim()) return; await saveAIProvider({ ...aiProvider, model: customModelInput.trim() }); Alert.alert('Model updated'); };

  const saveAutofillProfile = async () => { setAutofillProfile(autofillDraft); await AsyncStorage.setItem(AUTOFILL_PROFILE_KEY, JSON.stringify(autofillDraft)); setShowAutofillSettings(false); };

  const buildAutofillJS = (profile) => {
    const safe = JSON.stringify(profile || {});
    return `(function() {
      try {
        var profile = ${safe}; var filledCount = 0;
        var rules = [
          { key: 'email', value: profile.email, patterns: ['email', 'e-mail'], type: 'email' },
          { key: 'phone', value: profile.phone, patterns: ['phone', 'mobile', 'contact no', 'whatsapp'], type: 'tel' },
          { key: 'fullName', value: profile.fullName, patterns: ['fullname', 'full name', 'name'], exclude: ['username'] },
          { key: 'address', value: profile.address, patterns: ['address', 'street'] },
          { key: 'city', value: profile.city, patterns: ['city'] },
          { key: 'state', value: profile.state, patterns: ['state'] },
          { key: 'pincode', value: profile.pincode, patterns: ['pincode', 'zipcode'] },
          { key: 'country', value: profile.country, patterns: ['country'] },
        ];
        var hardBlock = ['answer', 'quiz', 'question', 'exam', 'otp', 'password'];
        var inputs = document.querySelectorAll('input:not([type=hidden]):not([type=password]):not([type=radio]):not([type=checkbox])');
        inputs.forEach(function(el) {
          if (el.value && el.value.trim().length > 0) return;
          var sig = ((el.name || '') + ' ' + (el.id || '') + ' ' + (el.placeholder || '')).toLowerCase();
          if (hardBlock.some(function(b) { return sig.indexOf(b) !== -1; })) return;
          for (var i = 0; i < rules.length; i++) {
            var rule = rules[i]; if (!rule.value) continue;
            if (rule.patterns.some(function(p) { return sig.indexOf(p) !== -1; })) { el.value = rule.value; filledCount++; break; }
          }
        });
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'AUTOFILL_DONE', count: filledCount }));
      } catch (e) {}
    })(); true;`;
  };

  const runAutofill = () => { webviewRefs.current[activeTabId]?.injectJavaScript(buildAutofillJS(autofillProfile)); };

  const submitAdminPasscode = async () => {
    if (adminPasscodeInput.trim() === ADMIN_PASSCODE) {
      await AsyncStorage.setItem(ADMIN_UNLOCK_KEY, 'true'); setIsAdmin(true); setAdminError(false); setAdminPasscodeInput(''); setShowAdminPrompt(false);
      await saveAIProvider({ ...aiProvider, mode: 'default', apiKey: aiProvider.apiKey || '' });
    } else { setAdminError(true); }
  };

  const EXTRACT_TEXT_JS = `(function() { const text = document.body ? document.body.innerText.slice(0, 6000) : ''; window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'PAGE_TEXT', text, title: document.title })); })(); true;`;
  const [pendingAIAction, setPendingAIAction] = useState(null);
  const TLDR_WATCH_JS = `(function() { if (window.__tldrWatchInstalled) return true; window.__tldrWatchInstalled = true; window.addEventListener('scroll', function() { var doc = document.documentElement; if ((window.scrollY/doc.scrollHeight) > 0.25) { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'SHOW_TLDR' })); } }, { passive: true }); })(); true;`;
  const FORM_DETECT_JS = `(function() { if (document.forms.length > 0 || document.querySelectorAll('input').length > 1) { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'FORM_DETECTED' })); } })(); true;`;

  const handleWebViewMessage = async (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'PAGE_TEXT' && pendingAIAction) { const { mode, question } = pendingAIAction; setPendingAIAction(null); await askAI({ mode, question, pageContext: data.text }); }
      if (data.type === 'COPY_TEXT') { await Clipboard.setStringAsync(data.text || ''); Alert.alert('Copied ✅'); }
      if (data.type === 'SHOW_TLDR') setShowTldrButton(true);
      if (data.type === 'FORM_DETECTED') setShowFillFormButton(true);
      if (data.type === 'AUTOFILL_DONE') Alert.alert('Autofill Done');
    } catch (e) {}
  };

  const runTldr = () => { setShowTldrButton(false); setAiMode('tldr'); setShowAIPanel(true); setAiLoading(true); setPendingAIAction({ mode: 'tldr', question: '' }); webviewRefs.current[activeTabId]?.injectJavaScript(EXTRACT_TEXT_JS); };
  const runAIMode = (mode) => { setAiMode(mode); setShowAIPanel(true); setAiLoading(true); setPendingAIAction({ mode, question: '' }); webviewRefs.current[activeTabId]?.injectJavaScript(EXTRACT_TEXT_JS); };

  const askAI = async ({ mode = 'ask', question = '', pageContext = '' }) => {
    setAiLoading(true); setAiError(false); setAiAnswer('');
    if (aiProvider.mode === 'none') { setAiAnswer('AI Turned Off'); setAiLoading(false); return; }
    try {
      let json; const model = aiProvider.model || DEFAULT_MODEL;
      if (aiProvider.mode === 'custom' && aiProvider.apiKey) json = await callGroqDirect(aiProvider.apiKey, model, mode, question, pageContext, activeTab?.url);
      else {
        const res = await fetch(AI_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode, question, pageContext, pageUrl: activeTab?.url, model }) });
        json = await res.json();
      }
      setAiAnswer(json.answer || 'No response.');
    } catch (err) { setAiError(true); } finally { setAiLoading(false); }
  };

  const submitAIQuestion = () => {
    const q = aiQuestion.trim(); if (!q) return; setAiMode('ask'); setShowAIPanel(true); setAiLoading(true); setAiQuestion('');
    if (activeTab && activeTab.url !== HOME_MARKER) { setPendingAIAction({ mode: 'ask', question: q }); webviewRefs.current[activeTabId]?.injectJavaScript(EXTRACT_TEXT_JS); }
    else askAI({ mode: 'ask', question: q, pageContext: '' });
  };

  const floatingPos = useRef(new Animated.ValueXY({ x: SCREEN_W - 66, y: SCREEN_H - 260 })).current;
  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderMove: Animated.event([null, { dx: floatingPos.x, dy: floatingPos.y }], { useNativeDriver: false }),
    onPanResponderRelease: () => {
      floatingPos.flattenOffset();
      let boundedX = Math.max(0, Math.min(SCREEN_W - 54, floatingPos.x._value));
      let boundedY = Math.max(TOP_PADDING, Math.min(SCREEN_H - 120, floatingPos.y._value));
      Animated.spring(floatingPos, { toValue: { x: boundedX, y: boundedY }, useNativeDriver: false }).start();
      setShowFloatingMenu(true);
    },
  })).current;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={{ height: TOP_PADDING, backgroundColor: activeTab?.isIncognito ? '#1a1a1a' : '#fff' }} />

      {activeTab?.url !== HOME_MARKER && (
        <View style={styles.urlBar}>
          <TouchableOpacity onPress={goHome} style={styles.homeBtn}><Text style={styles.homeBtnText}>⌂</Text></TouchableOpacity>
          <TextInput style={styles.urlInput} value={urlInput} onChangeText={setUrlInput} onSubmitEditing={navigate} autoCapitalize="none" autoCorrect={false} keyboardType="url" returnKeyType="go" />
          <TouchableOpacity onPress={toggleBookmark} style={styles.starBtn}><Text style={[styles.starBtnText, isBookmarked && styles.starActive]}>{isBookmarked ? '★' : '☆'}</Text></TouchableOpacity>
          <TouchableOpacity onPress={navigate} style={styles.goBtn}><Text style={styles.goBtnText}>Go</Text></TouchableOpacity>
        </View>
      )}

      <View style={{ flex: 1 }}>
        {tabs.map((tab) => {
          if (tab.id !== activeTabId) return null;
          return tab.url === HOME_MARKER ? (
            <View key={tab.id} style={StyleSheet.absoluteFill}>
              <View style={[styles.homeScreen, nightMode && styles.homeScreenNight]}>
                <View style={styles.homeHeaderRow}>
                  <TouchableOpacity onPress={() => setHomeUrlBarActive(true)}>
                    <Text style={[styles.homeHeaderTitle, nightMode && styles.homeBrandNight]}>Homepage</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.homeCenterWrap}>
                  <View style={[styles.homeSearchRow, nightMode && styles.homeSearchInputNight]}>
                    <TextInput style={[styles.homeSearchInputInner, nightMode && { color: '#fff' }]} value={homeSearchInput} onChangeText={setHomeSearchInput} onSubmitEditing={openHomeSearch} placeholder="Search or type URL" placeholderTextColor="#9a9a9a" />
                    <TouchableOpacity style={styles.homeGoBtnInner} onPress={openHomeSearch}><Ionicons name="search" size={20} color="#5B5FEF" /></TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          ) : (
            <View key={tab.id} style={StyleSheet.absoluteFill} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
              <WebView
                pullToRefreshEnabled={true}
                key={`wv-${tab.id}-${desktopMode ? 'desktop' : 'mobile'}`}
                ref={(ref) => (webviewRefs.current[tab.id] = ref)}
                source={{ uri: tab.url }}
                userAgent={desktopMode ? DESKTOP_UA : undefined}
                incognito={tab.isIncognito}
                onFileDownload={({ nativeEvent }) => startDownload(nativeEvent.downloadUrl)}
                onLoadEnd={() => {
                  if (adBlockerEnabled) webviewRefs.current[tab.id]?.injectJavaScript(AD_BLOCK_JS);
                  webviewRefs.current[tab.id]?.injectJavaScript(TLDR_WATCH_JS);
                  webviewRefs.current[tab.id]?.injectJavaScript(FORM_DETECT_JS);
                }}
                onNavigationStateChange={(navState) => {
                  updateTab(tab.id, { url: navState.url, title: navState.title || navState.url, canGoBack: navState.canGoBack, canGoForward: navState.canGoForward });
                  if (tab.id === activeTabId) setUrlInput(navState.url);
                }}
                onMessage={handleWebViewMessage}
              />
            </View>
          );
        })}
      </View>

      {/* --- Download Toast UI Overlay --- */}
      {activeDownload && (
        <View style={styles.chromeDownloadToast}>
          <View style={styles.downloadInfoRow}>
            <Ionicons name="download-cloud-outline" size={22} color="#5B5FEF" style={{ marginRight: 10 }} />
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={styles.downloadFileName}>{activeDownload.name}</Text>
              <Text style={styles.downloadProgressText}>
                {activeDownload.progress === 1 ? 'Saved inside "Ai browser" folder! 📁' : `Downloading... ${Math.round(activeDownload.progress * 100)}%`}
              </Text>
            </View>
          </View>
          <View style={styles.toastProgressBarTrack}><View style={[styles.toastProgressBarFill, { width: `${activeDownload.progress * 100}%` }]} /></View>
        </View>
      )}

      {/* Floating Buttons */}
      <Animated.View style={[styles.floatingBtn, { transform: floatingPos.getTranslateTransform() }]} {...panResponder.panHandlers}>
        <Text style={styles.floatingBtnText}>🔍</Text>
      </Animated.View>

      {showFillFormButton && (
        <TouchableOpacity style={[styles.tldrChip, { bottom: showTldrButton ? 150 : 90 }]} onPress={() => { setShowFillFormButton(false); runAutofill(); }} activeOpacity={0.85}>
          <Text style={styles.tldrChipText}>📝 Fill form</Text>
        </TouchableOpacity>
      )}

      {showTldrButton && (
        <TouchableOpacity style={styles.tldrChip} onPress={runTldr} activeOpacity={0.85}>
          <Text style={styles.tldrChipText}>⚡ TL;DR</Text>
        </TouchableOpacity>
      )}

      {/* Bottom Layout Toolbar */}
      <View style={styles.toolbarWrap}>
        <View style={styles.toolbar}>
          <TouchableOpacity onPress={goBack} disabled={!activeTab?.canGoBack} style={styles.toolBtn}><Ionicons name="chevron-back-outline" size={26} color={activeTab?.canGoBack ? '#333' : '#d0d0d0'} /></TouchableOpacity>
          <TouchableOpacity onPress={goForward} disabled={!activeTab?.canGoForward} style={styles.toolBtn}><Ionicons name="chevron-forward-outline" size={26} color={activeTab?.canGoForward ? '#333' : '#d0d0d0'} /></TouchableOpacity>
          <TouchableOpacity onPress={goHome} style={styles.toolBtn}><Ionicons name="home-outline" size={24} color="#333" /></TouchableOpacity>
          <TouchableOpacity onPress={() => setShowTabSwitcher(true)} style={styles.toolBtn}><View style={styles.tabCountBadge}><Text style={styles.tabCountText}>{tabs.length}</Text></View></TouchableOpacity>
          <TouchableOpacity onPress={() => setShowMenu(true)} style={styles.toolBtn}><Ionicons name="menu-outline" size={26} color="#333" /></TouchableOpacity>
        </View>
      </View>

      {/* --- ALL MODALS CONFIGURED WITH MACCHAN SMOOTH ANIMATIONS --- */}
      
      {/* 1. Tabs Switcher */}
      {tabSwitcherMounted && (
        <Modal visible={tabSwitcherMounted} animationType="none" transparent onRequestClose={() => setShowTabSwitcher(false)}>
          <View style={styles.modalOverlay}>
            <Animated.View style={[styles.modalCard, { transform: [{ translateY: tabSwitcherAnim }] }]}>
              <Text style={styles.modalTitle}>Tabs</Text>
              <FlatList
                data={tabs}
                keyExtractor={(t) => String(t.id)}
                numColumns={2}
                columnWrapperStyle={{ gap: 10 }}
                renderItem={({ item }) => (
                  <TouchableOpacity style={[styles.tabThumbCard, item.id === activeTabId && styles.tabThumbCardActive]} onPress={() => handleSwitchTabSmoothly(item.id)} activeOpacity={0.85}>
                    <View style={styles.tabThumbPreview}>
                      <Text style={styles.tabThumbPlaceholderIcon}>{item.url === HOME_MARKER ? '🏠' : item.isIncognito ? '🕵️' : '🌐'}</Text>
                      <TouchableOpacity onPress={() => closeTab(item.id)} style={styles.tabThumbCloseX}><Text style={styles.closeX}>✕</Text></TouchableOpacity>
                    </View>
                    <Text numberOfLines={1} style={styles.tabThumbTitle}>{item.isIncognito ? '🕵️ ' : ''}{item.title || item.url}</Text>
                  </TouchableOpacity>
                )}
              />
              <TouchableOpacity onPress={handleAddNewTabSmoothly} style={styles.newTabBtn}><Text style={styles.newTabBtnText}>+ New Tab</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => setShowTabSwitcher(false)} style={styles.closeModalBtn}><Text style={styles.closeModalBtnText}>Close</Text></TouchableOpacity>
            </Animated.View>
          </View>
        </Modal>
      )}

      {/* 2. Hamburger Menu Sheet */}
      {menuMounted && (
        <Modal visible={menuMounted} animationType="none" transparent onRequestClose={() => setShowMenu(false)}>
          <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setShowMenu(false)}>
            <Animated.View style={[styles.menuSheet, { transform: [{ translateY: menuAnim }] }]} onStartShouldSetResponder={() => true}>
              <View style={styles.menuGrid}>
                {MENU_ITEMS_DEF.map((item) => (
                  <TouchableOpacity key={item.key} style={styles.menuItem} onPress={() => {
                    setShowMenu(false);
                    setTimeout(() => {
                      if (item.key === 'night') toggleNightMode();
                      else if (item.key === 'reload') reload();
                      else if (item.key === 'bookmarks') setShowBookmarks(true);
                      else if (item.key === 'history') setShowHistory(true);
                      else if (item.key === 'downloads') setShowDownloads(true);
                      else if (item.key === 'incognito') setTabs(tabs.map(t => t.id === activeTabId ? {...t, isIncognito: !t.isIncognito} : t));
                      else if (item.key === 'share') shareCurrentPage();
                      else if (item.key === 'addBookmark') toggleBookmark();
                      else if (item.key === 'desktop') setDesktopMode(!desktopMode);
                      else if (item.key === 'autofillInfo') { setAutofillDraft(autofillProfile); setShowAutofillSettings(true); }
                      else if (item.key === 'storageSettings') setShowStorageModal(true); 
                    }, 200);
                  }}>
                    <Text style={[styles.menuIcon, item.key === 'adblock' && adBlockerEnabled && styles.menuIconActiveAdBlock]}>{item.icon}</Text>
                    <Text style={styles.menuLabel}>{item.key === 'adblock' ? `Ad Block: ${adBlockerEnabled ? 'ON' : 'OFF'}` : item.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Animated.View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* 3. Storage Settings */}
      {storageMounted && (
        <Modal visible={storageMounted} animationType="none" transparent onRequestClose={() => setShowStorageModal(false)}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowStorageModal(false)}>
            <Animated.View style={[styles.modalCard, { transform: [{ translateY: storageAnim }] }]} onStartShouldSetResponder={() => true}>
              <Text style={styles.modalTitle}>Storage Settings</Text>
              <TouchableOpacity style={styles.providerRow} onPress={() => { setStorageLocation('phone'); AsyncStorage.setItem(STORAGE_LOCATION_KEY, 'phone'); setShowStorageModal(false); }}>
                <View style={[styles.radioOuter, storageLocation === 'phone' && styles.radioOuterActive]}><View style={storageLocation === 'phone' && styles.radioInner} /></View>
                <View><Text style={styles.providerLabel}>Phone Memory (Internal Storage)</Text><Text style={styles.providerSubtext}>Path: Internal/Ai browser/</Text></View>
              </TouchableOpacity>
              <TouchableOpacity style={styles.providerRow} onPress={() => { setStorageLocation('sdcard'); AsyncStorage.setItem(STORAGE_LOCATION_KEY, 'sdcard'); setShowStorageModal(false); }}>
                <View style={[styles.radioOuter, storageLocation === 'sdcard' && styles.radioOuterActive]}><View style={storageLocation === 'sdcard' && styles.radioInner} /></View>
                <View><Text style={styles.providerLabel}>SD Card Memory (External Mounts)</Text><Text style={styles.providerSubtext}>Path: SDCard/Ai browser/</Text></View>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowStorageModal(false)} style={styles.closeModalBtn}><Text style={styles.closeModalBtnText}>Close</Text></TouchableOpacity>
            </Animated.View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* 4. AI Subpage Ask Pane */}
      {aiPanelMounted && (
        <Modal visible={aiPanelMounted} animationType="none" transparent onRequestClose={() => setShowAIPanel(false)}>
          <TouchableOpacity style={styles.aiOverlay} activeOpacity={1} onPress={() => setShowAIPanel(false)}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ width: '100%' }}>
              <Animated.View style={[styles.aiCard, { transform: [{ translateY: aiPanelAnim }] }]} onStartShouldSetResponder={() => true}>
                <View style={styles.aiHeaderRow}>
                  <Text style={styles.modalTitle}>{aiMode === 'explain' ? '📖 Explaining this page' : '✨ Ask AI'}</Text>
                  <TouchableOpacity onPress={() => { setCustomKeyInput(aiProvider.apiKey || ''); setCustomModelInput(aiProvider.model || DEFAULT_MODEL); setShowAISettings(true); }} style={styles.settingsGearBtn}><Text style={styles.settingsGearText}>⚙️</Text></TouchableOpacity>
                </View>
                <View style={{ flex: 1 }}>
                  {aiLoading ? ( <View style={styles.aiLoadingWrap}><ActivityIndicator size="large" color="#5B5FEF" /><Text style={styles.aiLoadingText}>{AI_MODES[aiMode]?.hint || 'Thinking…'}</Text></View> ) : (
                    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 20 }} keyboardShouldPersistTaps="handled"><Text style={[styles.aiAnswer, aiError && styles.aiAnswerError]}>{aiAnswer || 'Ask anything about what is on screen right now.'}</Text></ScrollView>
                  )}
                </View>
                <View style={styles.aiInputRow}>
                  <TextInput style={styles.aiInput} value={aiQuestion} onChangeText={setAiQuestion} placeholder="Ask anything about this page..." placeholderTextColor="#9a9a9a" onSubmitEditing={submitAIQuestion} returnKeyType="send" />
                  <TouchableOpacity onPress={submitAIQuestion} style={styles.goBtn}><Text style={styles.goBtnText}>Ask</Text></TouchableOpacity>
                </View>
                <TouchableOpacity onPress={() => setShowAIPanel(false)} style={styles.closeModalBtn}><Text style={styles.closeModalBtnText}>Close</Text></TouchableOpacity>
              </Animated.View>
            </KeyboardAvoidingView>
          </TouchableOpacity>
        </Modal>
      )}

      {/* 5. AI Service Provider Config Settings */}
      {aiSettingsMounted && (
        <Modal visible={aiSettingsMounted} animationType="none" transparent onRequestClose={() => setShowAISettings(false)}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowAISettings(false)}>
            <Animated.View style={[styles.modalCard, { transform: [{ translateY: aiSettingsAnim }] }]} onStartShouldSetResponder={() => true}>
              <Text style={styles.modalTitle}>AI service provider</Text>
              <ScrollView style={{ maxHeight: '85%' }}>
                <TouchableOpacity style={styles.providerRow} onPress={() => selectProviderMode('none')}>
                  <View style={[styles.radioOuter, aiProvider.mode === 'none' && styles.radioOuterActive]}>{aiProvider.mode === 'none' && <View style={styles.radioInner} />}</View>
                  <View><Text style={styles.providerLabel}>None</Text></View>
                </TouchableOpacity>
                <TouchableOpacity style={styles.providerRow} onPress={() => selectProviderMode('default')}>
                  <View style={[styles.radioOuter, aiProvider.mode === 'default' && styles.radioOuterActive]}>{aiProvider.mode === 'default' && <View style={styles.radioInner} />}</View>
                  <View><Text style={styles.providerLabel}>{isAdmin ? 'Default' : '🔒 Default'}</Text></View>
                </TouchableOpacity>
                <TextInput style={styles.apiKeyInput} value={customKeyInput} onChangeText={setCustomKeyInput} placeholder="Paste your Groq API key here" placeholderTextColor="#9a9a9a" secureTextEntry />
                <TouchableOpacity onPress={saveCustomKey} style={styles.newTabBtn}><Text style={styles.newTabBtnText}>Save Key</Text></TouchableOpacity>
              </ScrollView>
              <TouchableOpacity onPress={() => setShowAISettings(false)} style={styles.closeModalBtn}><Text style={styles.closeModalBtnText}>Close</Text></TouchableOpacity>
            </Animated.View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* 6. Autofill Draft Information Pane */}
      {autofillMounted && (
        <Modal visible={autofillMounted} animationType="none" transparent onRequestClose={() => setShowAutofillSettings(false)}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowAutofillSettings(false)}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%' }}>
              <Animated.View style={[styles.modalCard, { transform: [{ translateY: autofillAnim }] }]} onStartShouldSetResponder={() => true}>
                <Text style={styles.modalTitle}>My info (for Autofill)</Text>
                <ScrollView style={{ maxHeight: 300 }} keyboardShouldPersistTaps="handled">
                  <TextInput style={styles.apiKeyInput} value={autofillDraft.fullName} onChangeText={(t) => setAutofillDraft({...autofillDraft, fullName: t})} placeholder="Full name" />
                  <TextInput style={styles.apiKeyInput} value={autofillDraft.email} onChangeText={(t) => setAutofillDraft({...autofillDraft, email: t})} placeholder="Email" keyboardType="email-address" />
                  <TextInput style={styles.apiKeyInput} value={autofillDraft.phone} onChangeText={(t) => setAutofillDraft({...autofillDraft, phone: t})} placeholder="Phone number" keyboardType="phone-pad" />
                </ScrollView>
                <TouchableOpacity onPress={saveAutofillProfile} style={styles.newTabBtn}><Text style={styles.newTabBtnText}>Save Info</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => setShowAutofillSettings(false)} style={styles.closeModalBtn}><Text style={styles.closeModalBtnText}>Close</Text></TouchableOpacity>
              </Animated.View>
            </KeyboardAvoidingView>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Floating menu quick action options pane */}
      <Modal visible={showFloatingMenu} animationType="fade" transparent onRequestClose={() => setShowFloatingMenu(false)}>
        <TouchableOpacity style={styles.floatingMenuOverlay} activeOpacity={1} onPress={() => setShowFloatingMenu(false)}>
          <View style={styles.floatingMenuCard}>
            <TouchableOpacity style={styles.floatingMenuItem} onPress={() => { setShowFloatingMenu(false); Clipboard.setStringAsync(activeTab?.url || ''); Alert.alert('Copied link'); }}><Text style={styles.floatingMenuText}>📋 Copy link text</Text></TouchableOpacity>
            <TouchableOpacity style={styles.floatingMenuItem} onPress={() => { setShowFloatingMenu(false); runAIMode('explain'); }}><Text style={styles.floatingMenuText}>📖 Explain this page</Text></TouchableOpacity>
            <TouchableOpacity style={styles.floatingMenuItem} onPress={() => { setShowFloatingMenu(false); setShowAIPanel(true); }}><Text style={styles.floatingMenuText}>✨ Ask AI</Text></TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Library Panel Slide-In */}
      {libraryMounted && (
        <Modal visible={libraryMounted} animationType="none" transparent onRequestClose={closeLibrary}>
          <Animated.View style={[styles.libraryPage, nightMode && styles.libraryPageNight, { transform: [{ translateX: libraryPanelAnim }] }]}>
            <View style={styles.libraryHeaderRow}>
              <TouchableOpacity onPress={closeLibrary}><Ionicons name="chevron-back" size={26} color={nightMode ? '#eee' : '#333'} /></TouchableOpacity>
              <View style={styles.libraryTabsRow}>
                {[{ key: 'bookmarks', label: 'Bookmarks' }, { key: 'history', label: 'History' }, { key: 'downloads', label: 'Saved pages' }].map((t) => (
                  <TouchableOpacity key={t.key} onPress={() => switchLibraryTab(t.key)} style={{ marginLeft: 22 }}>
                    <Text style={[styles.libraryTabText, libraryTab === t.key && styles.libraryTabTextActive, nightMode && !(libraryTab === t.key) && { color: '#888' }]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <FlatList
              data={buildLibraryRows()}
              keyExtractor={(row) => row.key}
              renderItem={({ item: row }) => {
                if (row.type === 'header') return <Text style={styles.libraryDateHeader}>{row.label}</Text>;
                const item = row.data;
                return (
                  <View style={styles.libraryRow}>
                    <TouchableOpacity style={{ flex: 1 }} onPress={() => { if(row.kind === 'downloads') openDownload(item); else { setUrlInput(item.url); updateTab(activeTabId, { url: item.url, loading: true }); closeLibrary(); } }}>
                      <Text numberOfLines={1} style={styles.tabRowText}>{item.title || item.name || item.url}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => { if(row.kind==='bookmarks') removeBookmark(item.url); else if(row.kind==='downloads') deleteDownload(item); }}><Text style={styles.closeX}>✕</Text></TouchableOpacity>
                  </View>
                );
              }}
            />
          </Animated.View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  urlBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#ececec' },
  homeBtn: { paddingHorizontal: 6, paddingVertical: 6 },
  homeBtnText: { fontSize: 18, color: '#5B5FEF' },
  urlInput: { flex: 1, backgroundColor: '#f1f1f3', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, color: '#111' },
  starBtn: { paddingHorizontal: 8, paddingVertical: 6 },
  starBtnText: { fontSize: 20, color: '#c9c9c9' },
  starActive: { color: '#f5a623' },
  goBtn: { marginLeft: 6, backgroundColor: '#5B5FEF', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  goBtnText: { color: '#fff', fontWeight: '600' },
  toolbarWrap: { backgroundColor: '#fff', borderTopWidth: 1, borderColor: '#ececec' },
  toolbar: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingVertical: 12 },
  toolBtn: { minWidth: 40, alignItems: 'center' },
  tabCountBadge: { minWidth: 24, height: 24, borderRadius: 8, borderWidth: 1.5, borderColor: '#333', alignItems: 'center', justifyContent: 'center' },
  tabCountText: { fontSize: 12, fontWeight: '700' },
  homeScreen: { flex: 1, backgroundColor: '#fff', alignItems: 'center', paddingTop: 40, paddingHorizontal: 20 },
  homeScreenNight: { backgroundColor: '#111' },
  homeHeaderRow: { marginBottom: 40 },
  homeHeaderTitle: { fontSize: 18, fontWeight: '600' },
  homeCenterWrap: { width: '100%' },
  homeSearchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f1f3', borderRadius: 24, paddingHorizontal: 15, paddingVertical: 8 },
  homeSearchInputInner: { flex: 1, fontSize: 15 },
  homeSearchInputNight: { backgroundColor: '#222' },
  homeGoBtnInner: { padding: 5 },
  
  // Custom Smooth Sheets Structural System Styling Layout
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 18, maxHeight: '82%', width: '100%' },
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  menuSheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, width: '100%' },
  
  menuGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 15 },
  menuItem: { width: '20%', alignItems: 'center' },
  menuIcon: { fontSize: 24 },
  menuIconActiveAdBlock: { color: '#5B5FEF', transform: [{ scale: 1.1 }] },
  menuLabel: { fontSize: 11, color: '#333', marginTop: 5, textAlign: 'center' },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 15, color: '#111' },
  providerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderColor: '#f1f1f5' },
  radioOuter: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#c9c9c9', alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  radioOuterActive: { borderColor: '#5B5FEF' },
  radioInner: { width: 11, height: 11, borderRadius: 6, backgroundColor: '#5B5FEF' },
  providerLabel: { fontSize: 15, color: '#111', fontWeight: '600' },
  providerSubtext: { fontSize: 12, color: '#999', marginTop: 2 },
  closeModalBtn: { marginTop: 20, paddingVertical: 10, alignItems: 'center' },
  closeModalBtnText: { color: '#5B5FEF', fontWeight: '600' },
  apiKeyInput: { backgroundColor: '#f1f1f1', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, marginTop: 8 },
  tabThumbCard: { flex: 1, maxWidth: '48.5%', backgroundColor: '#F5F5F7', borderRadius: 14, padding: 6, borderWidth: 2, borderColor: 'transparent' },
  tabThumbCardActive: { borderColor: '#5B5FEF' },
  tabThumbPreview: { width: '100%', aspectRatio: 0.72, borderRadius: 10, overflow: 'hidden', backgroundColor: '#E4E4EC', justifyContent: 'center', alignItems: 'center' },
  tabThumbPlaceholderIcon: { fontSize: 34 },
  tabThumbCloseX: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 12, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  closeX: { fontSize: 16, color: '#999' },
  tabThumbTitle: { fontSize: 12, color: '#222', marginTop: 6, paddingHorizontal: 2 },
  newTabBtn: { marginTop: 10, paddingVertical: 12, alignItems: 'center', backgroundColor: '#5B5FEF', borderRadius: 12 },
  newTabBtnText: { color: '#fff', fontWeight: '600' },

  aiOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  aiCard: { backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18, width: '100%', height: '92%' },
  aiHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  settingsGearBtn: { padding: 6 }, settingsGearText: { fontSize: 20 },
  aiLoadingWrap: { alignItems: 'center', marginTop: 24 }, aiLoadingText: { marginTop: 10, color: '#666' },
  aiAnswer: { fontSize: 15, lineHeight: 22, color: '#222' }, aiAnswerError: { color: '#d1453b' },
  aiInputRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  aiInput: { flex: 1, backgroundColor: '#f1f1f1', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },

  floatingBtn: { position: 'absolute', width: 54, height: 54, borderRadius: 27, backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center', zIndex: 999 },
  floatingBtnText: { fontSize: 30 },
  tldrChip: { position: 'absolute', bottom: 90, alignSelf: 'center', backgroundColor: '#222', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 24, zIndex: 998 },
  tldrChipText: { color: '#fff', fontWeight: '700' },
  floatingMenuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)' },
  floatingMenuCard: { position: 'absolute', right: 16, bottom: 220, backgroundColor: '#fff', borderRadius: 14, paddingVertical: 6, minWidth: 220 },
  floatingMenuItem: { paddingVertical: 12, paddingHorizontal: 16 },
  floatingMenuText: { fontSize: 14, color: '#222', fontWeight: '600' },

  libraryPage: { flex: 1, backgroundColor: '#fff', paddingTop: 20 }, libraryPageNight: { backgroundColor: '#111' },
  libraryHeaderRow: { flexDirection: 'row', alignItems: 'center', padding: 15 }, libraryTabsRow: { flexDirection: 'row' },
  libraryTabText: { fontSize: 16, fontWeight: '600' }, libraryTabTextActive: { color: '#5B5FEF' },
  libraryRow: { flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderColor: '#eee' },
  tabRowText: { fontSize: 15 }, libraryDateHeader: { padding: 10, fontSize: 13, color: '#999' },

  chromeDownloadToast: { position: 'absolute', bottom: 70, left: 12, right: 12, backgroundColor: '#ffffff', borderRadius: 12, padding: 14, elevation: 8, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, zIndex: 1000, borderWidth: 1, borderColor: '#e8e8e8' },
  downloadInfoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  downloadFileName: { fontSize: 14, fontWeight: '600', color: '#222', marginBottom: 2 },
  downloadProgressText: { fontSize: 12, color: '#666' },
  toastProgressBarTrack: { height: 4, backgroundColor: '#eef2f6', borderRadius: 2, marginTop: 10, overflow: 'hidden' },
  toastProgressBarFill: { height: '100%', backgroundColor: '#5B5FEF' },
});
