import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  FlatList,
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
// ⚠️ Needs: expo install expo-clipboard expo-file-system expo-sharing expo-screen-capture

// ⚠️ Point this to your deployed backend (see api/ask.js in this project)
const AI_ENDPOINT = 'https://ai-browser-by-iswar.vercel.app/api/ask';
const GROQ_DIRECT_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

const HOME_URL = 'https://www.google.com';
// Sentinel "url" that means: show the native Homepage screen instead of a WebView.
const HOME_MARKER = 'app://home';
const HISTORY_KEY = 'history_v1';
const BOOKMARKS_KEY = 'bookmarks_v1';
const DOWNLOADS_KEY = 'downloads_v1';
const AI_PROVIDER_KEY = 'ai_provider_v1';
const ADMIN_UNLOCK_KEY = 'ai_admin_unlocked_v1';
// ⚠️ Change this to your own secret. Only devices that enter this correctly
// can use the app's shared "Default" backend — everyone else must add their own key.
const ADMIN_PASSCODE = 'joysiddhi123';
const MAX_HISTORY = 200;
const TOP_PADDING = Platform.OS === 'android' ? (RNStatusBar.currentHeight || 24) : 0;
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

let tabIdCounter = 1;
const makeTab = (url = HOME_MARKER, opts = {}) => ({
  id: tabIdCounter++,
  url,
  title: url === HOME_MARKER ? 'Homepage' : url,
  canGoBack: false,
  canGoForward: false,
  loading: url !== HOME_MARKER,
  isIncognito: !!opts.incognito,
});

// Grid menu items shown when the hamburger (☰) button is tapped — Via-style bottom sheet.
const MENU_ITEMS_DEF = [
  { key: 'night', icon: '🌙', label: 'Night mode' },
  { key: 'reload', icon: '⟳', label: 'Reload' },
  { key: 'bookmarks', icon: '📑', label: 'Bookmarks' },
  { key: 'history', icon: '🕘', label: 'History' },
  { key: 'downloads', icon: '⬇️', label: 'Downloads' },
  { key: 'incognito', icon: '🕵️', label: 'Incognito' },
  { key: 'share', icon: '🔗', label: 'Share' },
  { key: 'addBookmark', icon: '⭐', label: 'Add bookmark' },
  { key: 'desktop', icon: '🖥️', label: 'Desktop site' },
  { key: 'settings', icon: '⚙️', label: 'Settings' },
];

// AI is only triggered from the floating 🔍 button now (see floatingMenu modal below),
// so there's no mode-picker chip row anymore — just 'explain' (auto) and 'ask' (free text).
const AI_MODES = {
  ask: { hint: 'Thinking…' },
  explain: { hint: 'Explaining the page…' },
};

// Builds the same style of prompt the backend (api/ask.js) uses, so a
// user-supplied Groq key produces consistent results when calling Groq directly.
function buildMessages(mode, question, pageContext, pageUrl) {
  const context = (pageContext || '').slice(0, 6000);
  if (mode === 'explain') {
    return [
      { role: 'system', content: 'You explain web pages in a clear, mobile-friendly way for a general audience.' },
      {
        role: 'user',
        content: `Page URL: ${pageUrl || ''}\n\nPage content:\n${context}\n\nExplain what this page is about in a detailed, mobile-friendly breakdown.`,
      },
    ];
  }
  if (mode === 'find_answers') {
    return [
      {
        role: 'system',
        content:
          'You scan web page text for FAQs, quiz questions, or form questions and answer each one. Respond ONLY with a JSON array like [{"question":"...","answer":"..."}]. No prose, no markdown fences.',
      },
      { role: 'user', content: `Page URL: ${pageUrl || ''}\n\nPage content:\n${context}` },
    ];
  }
  // ask
  return [
    { role: 'system', content: 'You answer questions about the current web page the user is viewing, using the provided page text as context.' },
    {
      role: 'user',
      content: `Page URL: ${pageUrl || ''}\n\nPage content:\n${context}\n\nQuestion: ${question || 'Summarize this page briefly.'}`,
    },
  ];
}

async function callGroqDirect(apiKey, mode, question, pageContext, pageUrl) {
  const messages = buildMessages(mode, question, pageContext, pageUrl);
  const res = await fetch(GROQ_DIRECT_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages,
      temperature: 0.4,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message || 'Groq request failed');
  const content = json?.choices?.[0]?.message?.content || '';
  if (mode === 'find_answers') {
    const cleaned = content.replace(/```json|```/g, '').trim();
    try {
      return { items: JSON.parse(cleaned) };
    } catch (e) {
      return { items: [] };
    }
  }
  return { answer: content };
}

export default function App() {
  const [tabs, setTabs] = useState([makeTab()]);
  const [activeTabId, setActiveTabId] = useState(tabs[0].id);
  const [urlInput, setUrlInput] = useState('');
  const [showTabSwitcher, setShowTabSwitcher] = useState(false);
  // Hamburger grid menu (Via-style bottom sheet)
  const [showMenu, setShowMenu] = useState(false);
  const [nightMode, setNightMode] = useState(false);
  const [desktopMode, setDesktopMode] = useState(false);
  // Homepage — just a search box, no clutter
  const [homeSearchInput, setHomeSearchInput] = useState('');
  // When true, "Homepage" label is replaced by a focused URL/search input bar
  const [homeUrlBarActive, setHomeUrlBarActive] = useState(false);
  // Floating draggable "inspect" button — works anywhere, over any page
  const [showFloatingMenu, setShowFloatingMenu] = useState(false);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [aiMode, setAiMode] = useState('ask');
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiAnswer, setAiAnswer] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(false);
  const [bookmarks, setBookmarks] = useState([]);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [downloads, setDownloads] = useState([]);
  const [showDownloads, setShowDownloads] = useState(false);
  // Unified "Library" page (Bookmarks / History / Saved pages tabs) — replaces the
  // three separate bottom-sheet modals with one full-page slide-in view.
  const [librarySearch, setLibrarySearch] = useState('');
  const [libraryMounted, setLibraryMounted] = useState(false);
  const libraryPanelAnim = useRef(new Animated.Value(SCREEN_W)).current;

  // ---------- AI provider settings ----------
  const [aiProvider, setAiProvider] = useState({ mode: 'none', apiKey: '' }); // 'default' | 'custom' | 'none'
  const [showAISettings, setShowAISettings] = useState(false);
  const [customKeyInput, setCustomKeyInput] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminPrompt, setShowAdminPrompt] = useState(false);
  const [adminPasscodeInput, setAdminPasscodeInput] = useState('');
  const [adminError, setAdminError] = useState(false);

  const webviewRefs = useRef({}); // { [tabId]: WebView ref }
  const progressAnim = useRef(new Animated.Value(0)).current;

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const isBookmarked = activeTab && bookmarks.some((b) => b.url === activeTab.url);

  const showLibrary = showBookmarks || showHistory || showDownloads;
  const libraryTab = showBookmarks ? 'bookmarks' : showDownloads ? 'downloads' : 'history';
  const closeLibrary = () => {
    setShowBookmarks(false);
    setShowHistory(false);
    setShowDownloads(false);
    setLibrarySearch('');
  };
  const switchLibraryTab = (tab) => {
    setShowBookmarks(tab === 'bookmarks');
    setShowHistory(tab === 'history');
    setShowDownloads(tab === 'downloads');
    setLibrarySearch('');
  };

  // Smooth slide-in-from-right animation for the Library page (kept mounted a
  // moment longer on close so the exit animation is visible).
  useEffect(() => {
    if (showLibrary) {
      setLibraryMounted(true);
      requestAnimationFrame(() => {
        Animated.timing(libraryPanelAnim, {
          toValue: 0,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      });
    } else if (libraryMounted) {
      Animated.timing(libraryPanelAnim, {
        toValue: SCREEN_W,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => setLibraryMounted(false));
    }
  }, [showLibrary]);

  const formatDateLabel = (ts) => {
    const d = new Date(ts);
    const today = new Date();
    const yest = new Date();
    yest.setDate(today.getDate() - 1);
    const sameDay = (a, b) =>
      a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    if (sameDay(d, today)) return 'Today';
    if (sameDay(d, yest)) return 'Yesterday';
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: '2-digit' });
  };

  // Builds a flat [{type:'header'|'item', ...}] list for the active library tab,
  // grouped by date (History/Downloads) and filtered by the search box.
  const buildLibraryRows = () => {
    const q = librarySearch.trim().toLowerCase();
    const matches = (title, url) =>
      !q || (title || '').toLowerCase().includes(q) || (url || '').toLowerCase().includes(q);

    if (libraryTab === 'bookmarks') {
      return bookmarks.filter((b) => matches(b.title, b.url)).map((b, i) => ({ type: 'item', kind: 'bookmarks', key: `b${i}`, data: b }));
    }

    const source = libraryTab === 'downloads' ? downloads : history;
    const filtered = source.filter((d) => matches(d.title || d.name, d.url));
    const rows = [];
    let lastLabel = null;
    filtered.forEach((item, i) => {
      const label = formatDateLabel(item.ts);
      if (label !== lastLabel) {
        rows.push({ type: 'header', key: `h${i}`, label });
        lastLabel = label;
      }
      rows.push({ type: 'item', kind: libraryTab, key: `i${i}`, data: item });
    });
    return rows;
  };

  // ---------- Block screenshots/screen-recording while an incognito tab is active ----------
  useEffect(() => {
    if (activeTab?.isIncognito) {
      ScreenCapture.preventScreenCaptureAsync().catch(() => {});
    } else {
      ScreenCapture.allowScreenCaptureAsync().catch(() => {});
    }
  }, [activeTab?.isIncognito]);

  // ---------- Persisted data on boot ----------
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
        const adminUnlocked = storedAdmin === 'true';
        setIsAdmin(adminUnlocked);

        const storedProvider = await AsyncStorage.getItem(AI_PROVIDER_KEY);
        if (storedProvider) {
          const parsed = JSON.parse(storedProvider);
          // Safety: if this device isn't admin-unlocked, never allow 'default' mode
          // even if it was somehow saved before (e.g. app reinstalled data restore).
          if (parsed.mode === 'default' && !adminUnlocked) {
            setAiProvider({ mode: 'none', apiKey: parsed.apiKey || '' });
          } else {
            setAiProvider(parsed);
          }
          setCustomKeyInput(parsed.apiKey || '');
        }
      } catch (e) {
        // ignore corrupt storage
      }
    })();
  }, []);

  // ---------- Loading progress bar ----------
  useEffect(() => {
    if (activeTab?.loading) {
      progressAnim.setValue(0);
      Animated.timing(progressAnim, {
        toValue: 0.8,
        duration: 1400,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }).start();
    } else {
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      }).start(() => progressAnim.setValue(0));
    }
  }, [activeTab?.loading, activeTabId]);

  // ---------- Hardware back button (Android) ----------
  // Fixes: pressing back used to close the whole app instead of going to the
  // previous page, and never asked for confirmation before exiting.
  useEffect(() => {
    const backAction = () => {
      // Close any open modal/sheet first
      if (showMenu) { setShowMenu(false); return true; }
      if (showFloatingMenu) { setShowFloatingMenu(false); return true; }
      if (showAdminPrompt) { setShowAdminPrompt(false); return true; }
      if (showAISettings) { setShowAISettings(false); return true; }
      if (showAIPanel) { setShowAIPanel(false); return true; }
      if (showTabSwitcher) { setShowTabSwitcher(false); return true; }
      if (showLibrary) { closeLibrary(); return true; }

      // On a real webpage with history → go back inside the page
      if (activeTab && activeTab.url !== HOME_MARKER && activeTab.canGoBack) {
        webviewRefs.current[activeTabId]?.goBack();
        return true;
      }

      // On a webpage with no more history → drop back to the Homepage
      if (activeTab && activeTab.url !== HOME_MARKER) {
        goHome();
        return true;
      }

      // Already on Homepage, more than one tab open → close this tab
      if (tabs.length > 1) {
        closeTab(activeTabId);
        return true;
      }

      // Homepage + only tab left → confirm before exiting
      Alert.alert('Exit AI Browser?', 'Kya aap app band karna chahte hain?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Exit', style: 'destructive', onPress: () => BackHandler.exitApp() },
      ]);
      return true;
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => sub.remove();
  }, [
    activeTab,
    activeTabId,
    tabs,
    showMenu,
    showFloatingMenu,
    showAdminPrompt,
    showAISettings,
    showAIPanel,
    showTabSwitcher,
    showLibrary,
  ]);

  // ---------- Tab helpers ----------
  const updateTab = (id, patch) => {
    setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };

  const addTab = (url = HOME_MARKER, opts = {}) => {
    const newTab = makeTab(url, opts);
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
    setUrlInput(newTab.url === HOME_MARKER ? '' : newTab.url);
    setShowTabSwitcher(false);
  };

  const closeTab = (id) => {
    setTabs((prev) => {
      const filtered = prev.filter((t) => t.id !== id);
      if (filtered.length === 0) {
        const fresh = makeTab();
        setActiveTabId(fresh.id);
        setUrlInput(fresh.url);
        return [fresh];
      }
      if (id === activeTabId) {
        const next = filtered[filtered.length - 1];
        setActiveTabId(next.id);
        setUrlInput(next.url);
      }
      return filtered;
    });
    delete webviewRefs.current[id];
  };

  const switchTab = (id) => {
    setActiveTabId(id);
    const tab = tabs.find((t) => t.id === id);
    if (tab) setUrlInput(tab.url === HOME_MARKER ? '' : tab.url);
    setShowTabSwitcher(false);
    // Re-apply night mode to whichever tab we just switched into, since each
    // WebView's DOM is independent — the injected style only lives on the tab it
    // was injected into.
    if (tab && tab.url !== HOME_MARKER) {
      setTimeout(() => {
        webviewRefs.current[id]?.injectJavaScript(buildNightModeJS(nightMode));
      }, 50);
    }
  };

  // ---------- Navigation ----------
  const normalizeUrl = (input) => {
    const trimmed = input.trim();
    if (!trimmed) return HOME_URL;
    const looksLikeUrl = /^https?:\/\//i.test(trimmed) || /^([\w-]+\.)+[a-z]{2,}(:\d+)?(\/.*)?$/i.test(trimmed);
    if (looksLikeUrl) {
      return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    }
    return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
  };

  const navigate = () => {
    const finalUrl = normalizeUrl(urlInput);
    updateTab(activeTabId, { url: finalUrl, loading: true });
  };

  const goBack = () => webviewRefs.current[activeTabId]?.goBack();
  const goForward = () => webviewRefs.current[activeTabId]?.goForward();
  const reload = () => webviewRefs.current[activeTabId]?.reload();
  const goHome = () => {
    updateTab(activeTabId, { url: HOME_MARKER, loading: false, title: 'Homepage' });
    setUrlInput('');
  };

  // ---------- Bookmarks ----------
  const persistBookmarks = async (updated) => {
    setBookmarks(updated);
    await AsyncStorage.setItem(BOOKMARKS_KEY, JSON.stringify(updated));
  };

  const toggleBookmark = async () => {
    if (!activeTab) return;
    if (isBookmarked) {
      await persistBookmarks(bookmarks.filter((b) => b.url !== activeTab.url));
    } else {
      await persistBookmarks([{ url: activeTab.url, title: activeTab.title }, ...bookmarks]);
    }
  };

  const removeBookmark = async (url) => {
    await persistBookmarks(bookmarks.filter((b) => b.url !== url));
  };

  // ---------- History ----------
  const addToHistory = useCallback(
    async (url, title) => {
      if (!url || url === 'about:blank') return;
      setHistory((prev) => {
        if (prev[0]?.url === url) return prev; // avoid dup consecutive entries
        const updated = [{ url, title: title || url, ts: Date.now() }, ...prev].slice(0, MAX_HISTORY);
        AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated)).catch(() => {});
        return updated;
      });
    },
    []
  );

  const clearHistory = async () => {
    setHistory([]);
    await AsyncStorage.removeItem(HISTORY_KEY);
  };

  // ---------- Homepage search ----------
  const openHomeSearch = () => {
    if (!homeSearchInput.trim()) return;
    const finalUrl = normalizeUrl(homeSearchInput);
    updateTab(activeTabId, { url: finalUrl, loading: true });
    setUrlInput(finalUrl);
    setHomeSearchInput('');
    setHomeUrlBarActive(false);
  };

  // ---------- Night mode / Desktop site / Share (hamburger menu actions) ----------
  // Deterministic add/remove (instead of a DOM-presence "toggle") so it can be safely
  // re-injected on every page load, tab switch, etc. without ever getting out of sync
  // with the nightMode state.
  const buildNightModeJS = (on) => {
    const applyBlock = on
      ? "if (!s) { s = document.createElement('style'); s.id = '__ai_browser_night'; " +
        "s.innerHTML = 'html{filter:invert(1) hue-rotate(180deg) !important;background:#111 !important;} " +
        "img,video,picture,iframe,canvas{filter:invert(1) hue-rotate(180deg) !important;}'; " +
        "document.head.appendChild(s); }"
      : "if (s) { s.remove(); }";
    return (
      "(function() { var s = document.getElementById('__ai_browser_night'); " + applyBlock + " })(); true;"
    );
  };

  const toggleNightMode = () => {
    setNightMode((prev) => {
      const next = !prev;
      if (activeTab && activeTab.url !== HOME_MARKER) {
        webviewRefs.current[activeTabId]?.injectJavaScript(buildNightModeJS(next));
      }
      return next;
    });
  };

  // Changing the `userAgent` prop alone doesn't reliably re-request the page on
  // Android — the WebView needs to be fully remounted for the new User-Agent to
  // actually take effect. We do that by keying the WebView on desktopMode (see the
  // `key` prop below), so just flipping the state here is enough.
  const toggleDesktopMode = () => {
    setDesktopMode((v) => !v);
  };

  const shareCurrentPage = async () => {
    if (!activeTab || activeTab.url === HOME_MARKER) return;
    try {
      await Share.share({ message: activeTab.url, title: activeTab.title || activeTab.url });
    } catch (e) {
      // ignore
    }
  };

  const openIncognitoTab = () => addTab(HOME_MARKER, { incognito: true });

  // ---------- Floating "inspect" button — copy page text / find answers anywhere ----------
  const COPY_TEXT_JS = `
    (function() {
      const text = document.body ? document.body.innerText.slice(0, 6000) : '';
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'COPY_TEXT', text }));
    })();
    true;
  `;

  const copyPageText = () => {
    if (!activeTab || activeTab.url === HOME_MARKER) {
      Alert.alert('Nothing to copy', 'Open a webpage first, then use this button.');
      return;
    }
    webviewRefs.current[activeTabId]?.injectJavaScript(COPY_TEXT_JS);
  };

  // ---------- Downloads ----------
  // Fires from WebView's onFileDownload (Android only). Pulls the file into the
  // app's own sandbox storage, then the user can open/share it (Save to Downloads,
  // Drive, WhatsApp, etc.) via the system share sheet — no extra permissions needed.
  const persistDownloads = async (updated) => {
    setDownloads(updated);
    await AsyncStorage.setItem(DOWNLOADS_KEY, JSON.stringify(updated));
  };

  const startDownload = async (url) => {
    if (!url) return;
    let filename = 'file';
    try {
      filename = decodeURIComponent(url.split('/').pop().split('?')[0]) || `download_${Date.now()}`;
    } catch (e) {
      filename = `download_${Date.now()}`;
    }
    const dest = FileSystem.documentDirectory + filename;
    try {
      const { uri } = await FileSystem.downloadAsync(url, dest);
      const entry = { name: filename, uri, url, ts: Date.now() };
      const updated = [entry, ...downloads];
      await persistDownloads(updated);
      Alert.alert('Download complete ✅', filename, [
        { text: 'Later', style: 'cancel' },
        { text: 'Open / Save', onPress: () => openDownload(entry) },
      ]);
    } catch (e) {
      Alert.alert('Download failed', `Could not download ${filename}.`);
    }
  };

  const openDownload = async (entry) => {
    try {
      const available = await Sharing.isAvailableAsync();
      if (available) {
        await Sharing.shareAsync(entry.uri);
      } else {
        Alert.alert('Sharing unavailable on this device', entry.uri);
      }
    } catch (e) {
      Alert.alert('Could not open this file');
    }
  };

  const deleteDownload = async (entry) => {
    try {
      await FileSystem.deleteAsync(entry.uri, { idempotent: true });
    } catch (e) {
      // ignore
    }
    await persistDownloads(downloads.filter((d) => d.uri !== entry.uri));
  };

  const floatingPos = useRef(new Animated.ValueXY({ x: SCREEN_W - 66, y: SCREEN_H - 260 })).current;
  const floatingDragging = useRef(false);
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (evt, gesture) => Math.abs(gesture.dx) > 4 || Math.abs(gesture.dy) > 4,
      onPanResponderGrant: () => {
        floatingDragging.current = false;
        floatingPos.setOffset({ x: floatingPos.x._value, y: floatingPos.y._value });
        floatingPos.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: (evt, gesture) => {
        if (Math.abs(gesture.dx) > 4 || Math.abs(gesture.dy) > 4) floatingDragging.current = true;
        Animated.event([null, { dx: floatingPos.x, dy: floatingPos.y }], { useNativeDriver: false })(evt, gesture);
      },
      onPanResponderRelease: () => {
        floatingPos.flattenOffset();
        if (!floatingDragging.current) setShowFloatingMenu(true);
      },
    })
  ).current;

  // ---------- AI provider settings persistence ----------
  const saveAIProvider = async (next) => {
    setAiProvider(next);
    await AsyncStorage.setItem(AI_PROVIDER_KEY, JSON.stringify(next));
  };

  const selectProviderMode = async (mode) => {
    if (mode === 'default' && !isAdmin) {
      // Locked — only admin-unlocked devices can use the shared backend.
      setShowAdminPrompt(true);
      return;
    }
    if (mode === 'custom') {
      await saveAIProvider({ mode: 'custom', apiKey: customKeyInput.trim() });
    } else {
      await saveAIProvider({ mode, apiKey: aiProvider.apiKey || '' });
    }
  };

  const saveCustomKey = async () => {
    await saveAIProvider({ mode: 'custom', apiKey: customKeyInput.trim() });
    setShowAISettings(false);
  };

  const submitAdminPasscode = async () => {
    if (adminPasscodeInput.trim() === ADMIN_PASSCODE) {
      await AsyncStorage.setItem(ADMIN_UNLOCK_KEY, 'true');
      setIsAdmin(true);
      setAdminError(false);
      setAdminPasscodeInput('');
      setShowAdminPrompt(false);
      await saveAIProvider({ mode: 'default', apiKey: aiProvider.apiKey || '' });
    } else {
      setAdminError(true);
    }
  };

  // ---------- AI panel ----------
  // Injected JS pulls visible text from the page so we can send context to Groq
  const EXTRACT_TEXT_JS = `
    (function() {
      const text = document.body ? document.body.innerText.slice(0, 6000) : '';
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'PAGE_TEXT', text, title: document.title }));
    })();
    true;
  `;

  const [pendingAIAction, setPendingAIAction] = useState(null); // { mode, question } or null

  const handleWebViewMessage = async (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'PAGE_TEXT' && pendingAIAction) {
        const { mode, question } = pendingAIAction;
        setPendingAIAction(null);
        await askAI({ mode, question, pageContext: data.text });
      }
      if (data.type === 'COPY_TEXT') {
        await Clipboard.setStringAsync(data.text || '');
        Alert.alert('Copied ✅', 'Page text copied to clipboard.');
      }
    } catch (e) {
      // ignore non-JSON messages
    }
  };

  // Auto-run mode (currently only 'explain') — extracts the page text first, then asks.
  const runAIMode = (mode) => {
    if (!activeTab || activeTab.url === HOME_MARKER) {
      Alert.alert('Open a page first', 'This works while you\u2019re viewing a webpage.');
      return;
    }
    setAiMode(mode);
    setShowAIPanel(true);
    setAiAnswer('');
    setAiError(false);
    setAiLoading(true);
    setPendingAIAction({ mode, question: '' });
    webviewRefs.current[activeTabId]?.injectJavaScript(EXTRACT_TEXT_JS);
  };

  const askAI = async ({ mode = 'ask', question = '', pageContext = '' }) => {
    setAiLoading(true);
    setAiError(false);
    setAiAnswer('');

    if (aiProvider.mode === 'none') {
      setAiError(true);
      setAiAnswer('AI is turned off. Enable it from AI Settings (⚙️) — choose Default or add your own API key.');
      setAiLoading(false);
      return;
    }

    try {
      let json;
      if (aiProvider.mode === 'custom' && aiProvider.apiKey) {
        json = await callGroqDirect(aiProvider.apiKey, mode, question, pageContext, activeTab?.url);
      } else {
        const res = await fetch(AI_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode, question, pageContext, pageUrl: activeTab?.url }),
        });
        json = await res.json();
        if (!res.ok) throw new Error(json.error || 'AI error');
      }
      setAiAnswer(json.answer || 'No response from AI.');
    } catch (err) {
      setAiError(true);
      setAiAnswer(
        aiProvider.mode === 'custom'
          ? 'Could not reach Groq with your API key. Check the key in AI Settings.'
          : "Could not reach the AI backend. Check AI_ENDPOINT in App.js and your network connection."
      );
    } finally {
      setAiLoading(false);
    }
  };

  // Free-form "Ask AI" — always pulls fresh page text first (if a real page is open)
  // so the answer is grounded in what's actually on screen right now.
  const submitAIQuestion = () => {
    const q = aiQuestion.trim();
    if (!q) return;
    setAiMode('ask');
    setShowAIPanel(true);
    setAiAnswer('');
    setAiError(false);
    setAiLoading(true);
    setAiQuestion('');
    if (activeTab && activeTab.url !== HOME_MARKER) {
      setPendingAIAction({ mode: 'ask', question: q });
      webviewRefs.current[activeTabId]?.injectJavaScript(EXTRACT_TEXT_JS);
    } else {
      askAI({ mode: 'ask', question: q, pageContext: '' });
    }
  };

  const openAIPanelBlank = () => {
    setAiMode('ask');
    setAiAnswer('');
    setAiError(false);
    setShowAIPanel(true);
  };

  // ---------- Render ----------
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={{ height: TOP_PADDING, backgroundColor: activeTab?.isIncognito ? '#1a1a1a' : '#fff' }} />

      {/* Incognito indicator — always visible while an incognito tab is active */}
      {activeTab?.isIncognito && (
        <View style={styles.incognitoBanner}>
          <Text style={styles.incognitoBannerText}>🕵️ Incognito — screenshots blocked</Text>
        </View>
      )}

      {/* URL bar — hidden on Homepage, only shown while browsing a real page */}
      {activeTab?.url !== HOME_MARKER && (
        <View style={styles.urlBar}>
          <TouchableOpacity onPress={goHome} style={styles.homeBtn}>
            <Text style={styles.homeBtnText}>⌂</Text>
          </TouchableOpacity>
          <TextInput
            style={styles.urlInput}
            value={urlInput}
            onChangeText={setUrlInput}
            onSubmitEditing={navigate}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholder="Search or type a URL"
            placeholderTextColor="#9a9a9a"
            returnKeyType="go"
          />
          <TouchableOpacity onPress={toggleBookmark} style={styles.starBtn}>
            <Text style={[styles.starBtnText, isBookmarked && styles.starActive]}>
              {isBookmarked ? '★' : '☆'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={navigate} style={styles.goBtn}>
            <Text style={styles.goBtnText}>Go</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <Animated.View
          style={[
            styles.progressFill,
            {
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
              opacity: activeTab?.loading ? 1 : progressAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
            },
          ]}
        />
      </View>

      {/* Active WebView (or native Homepage for HOME_MARKER tabs) */}
      <View style={{ flex: 1 }}>
        {tabs.map((tab) =>
          tab.url === HOME_MARKER ? (
            <View
              key={tab.id}
              style={[StyleSheet.absoluteFill, { display: tab.id === activeTabId ? 'flex' : 'none' }]}
            >
              <View style={[styles.homeScreen, nightMode && styles.homeScreenNight]}>
                {homeUrlBarActive ? (
                  <View style={[styles.homeUrlBar, nightMode && styles.homeUrlBarNight]}>
                    <Ionicons name="search-outline" size={20} color={nightMode ? '#aaa' : '#666'} />
                    <TextInput
                      autoFocus
                      style={[styles.homeUrlBarInput, nightMode && styles.homeSearchInputNight]}
                      value={homeSearchInput}
                      onChangeText={setHomeSearchInput}
                      onSubmitEditing={openHomeSearch}
                      placeholder="Search or type a URL"
                      placeholderTextColor="#9a9a9a"
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="go"
                    />
                    <TouchableOpacity
                      onPress={() => {
                        setHomeUrlBarActive(false);
                        setHomeSearchInput('');
                      }}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons name="close" size={22} color={nightMode ? '#aaa' : '#666'} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                    <View style={styles.homeHeaderRow}>
                      <TouchableOpacity onPress={() => setHomeUrlBarActive(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Text style={[styles.homeHeaderTitle, nightMode && styles.homeBrandNight]}>Homepage</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.homeCenterWrap}>
                      <View style={styles.homeLogoWrap}>
                        <Text
                          style={[styles.homeBrand, nightMode && styles.homeBrandNight]}
                          numberOfLines={1}
                          adjustsFontSizeToFit
                        >
                          AI Browser by Ishwar
                        </Text>
                      </View>

                      <View style={[styles.homeSearchRow, nightMode && styles.homeSearchInputNight]}>
                        <TextInput
                          style={[styles.homeSearchInputInner, nightMode && { color: '#fff' }]}
                          value={homeSearchInput}
                          onChangeText={setHomeSearchInput}
                          onSubmitEditing={openHomeSearch}
                          placeholder="Search or type a URL"
                          placeholderTextColor={nightMode ? '#888' : '#9a9a9a'}
                          autoCapitalize="none"
                          autoCorrect={false}
                          returnKeyType="go"
                        />
                        <TouchableOpacity style={styles.homeGoBtnInner} onPress={openHomeSearch}>
                          <Text style={styles.homeGoBtnText}>Go</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </>
                )}
              </View>
            </View>
          ) : (
            <View
              key={tab.id}
              style={[StyleSheet.absoluteFill, { display: tab.id === activeTabId ? 'flex' : 'none' }]}
            >
              <WebView
                // Keying on desktopMode forces a full remount when the user toggles
                // Desktop/Mobile site — Android WebView won't reliably re-request the
                // page with a new User-Agent header otherwise.
                key={`wv-${tab.id}-${desktopMode ? 'desktop' : 'mobile'}`}
                ref={(ref) => (webviewRefs.current[tab.id] = ref)}
                source={{ uri: tab.url }}
                userAgent={desktopMode ? DESKTOP_UA : undefined}
                incognito={tab.isIncognito}
                onFileDownload={
                  Platform.OS === 'android'
                    ? ({ nativeEvent }) => startDownload(nativeEvent.downloadUrl)
                    : undefined
                }
                onLoadStart={() => updateTab(tab.id, { loading: true })}
                onLoadEnd={() => {
                  updateTab(tab.id, { loading: false });
                  const t = tabs.find((x) => x.id === tab.id);
                  if (!t?.isIncognito) addToHistory(t?.url, t?.title);
                  // Re-apply night mode on every fresh page load — a newly loaded page
                  // has a clean DOM, so the previously injected style is gone.
                  if (nightMode && tab.id === activeTabId) {
                    webviewRefs.current[tab.id]?.injectJavaScript(buildNightModeJS(true));
                  }
                }}
                onNavigationStateChange={(navState) => {
                  updateTab(tab.id, {
                    url: navState.url,
                    title: navState.title || navState.url,
                    canGoBack: navState.canGoBack,
                    canGoForward: navState.canGoForward,
                  });
                  if (tab.id === activeTabId) setUrlInput(navState.url);
                }}
                onMessage={handleWebViewMessage}
                startInLoadingState
                renderLoading={() => (
                  <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color="#5B5FEF" />
                  </View>
                )}
                renderError={() => (
                  <View style={styles.loadingOverlay}>
                    <Text style={styles.errorText}>⚠️ Couldn't load this page</Text>
                    <TouchableOpacity onPress={reload} style={styles.retryBtn}>
                      <Text style={styles.retryBtnText}>Retry</Text>
                    </TouchableOpacity>
                  </View>
                )}
              />
            </View>
          )
        )}
      </View>

      {/* Floating draggable button — drag anywhere, tap to copy/find text on screen */}
      <Animated.View
        style={[styles.floatingBtn, { transform: floatingPos.getTranslateTransform() }]}
        {...panResponder.panHandlers}
      >
        <Text style={styles.floatingBtnText}>🔍</Text>
      </Animated.View>

      {/* Bottom toolbar — clean 5-icon layout: Back / Forward / Home / Tabs / Menu */}
      <View style={styles.toolbarWrap}>
        <View style={styles.toolbar}>
          <TouchableOpacity onPress={goBack} disabled={!activeTab?.canGoBack} style={styles.toolBtn}>
            <Ionicons
              name="chevron-back-outline"
              size={26}
              color={activeTab?.canGoBack ? '#333' : '#d0d0d0'}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={goForward} disabled={!activeTab?.canGoForward} style={styles.toolBtn}>
            <Ionicons
              name="chevron-forward-outline"
              size={26}
              color={activeTab?.canGoForward ? '#333' : '#d0d0d0'}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={goHome} style={styles.toolBtn}>
            <Ionicons name="home-outline" size={24} color="#333" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowTabSwitcher(true)} style={styles.toolBtn}>
            <View style={styles.tabCountBadge}>
              <Text style={styles.tabCountText}>{tabs.length}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowMenu(true)} style={styles.toolBtn}>
            <Ionicons name="menu-outline" size={26} color="#333" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Hamburger grid menu — Via-style bottom sheet, tap outside to close */}
      <Modal visible={showMenu} animationType="fade" transparent onRequestClose={() => setShowMenu(false)}>
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setShowMenu(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.menuSheet} onPress={() => {}}>
            <View style={styles.menuGrid}>
              {MENU_ITEMS_DEF.map((item) => (
                <TouchableOpacity
                  key={item.key}
                  style={styles.menuItem}
                  onPress={() => {
                    setShowMenu(false);
                    if (item.key === 'night') toggleNightMode();
                    else if (item.key === 'reload') reload();
                    else if (item.key === 'bookmarks') setShowBookmarks(true);
                    else if (item.key === 'history') setShowHistory(true);
                    else if (item.key === 'downloads') setShowDownloads(true);
                    else if (item.key === 'incognito') openIncognitoTab();
                    else if (item.key === 'share') shareCurrentPage();
                    else if (item.key === 'addBookmark') toggleBookmark();
                    else if (item.key === 'desktop') toggleDesktopMode();
                    else if (item.key === 'settings') {
                      setCustomKeyInput(aiProvider.apiKey || '');
                      setShowAISettings(true);
                    }
                  }}
                >
                  <Text style={styles.menuIcon}>
                    {item.key === 'night' && nightMode ? '☀️' : item.key === 'desktop' && desktopMode ? '📱' : item.icon}
                  </Text>
                  <Text style={styles.menuLabel}>
                    {item.key === 'night' && nightMode
                      ? 'Day mode'
                      : item.key === 'desktop' && desktopMode
                      ? 'Mobile site'
                      : item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.menuCloseChevron} onPress={() => setShowMenu(false)}>
              <Text style={{ fontSize: 18, color: '#999' }}>⌄</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Floating button quick menu */}
      <Modal
        visible={showFloatingMenu}
        animationType="fade"
        transparent
        onRequestClose={() => setShowFloatingMenu(false)}
      >
        <TouchableOpacity
          style={styles.floatingMenuOverlay}
          activeOpacity={1}
          onPress={() => setShowFloatingMenu(false)}
        >
          <View style={styles.floatingMenuCard}>
            <TouchableOpacity
              style={styles.floatingMenuItem}
              onPress={() => {
                setShowFloatingMenu(false);
                copyPageText();
              }}
            >
              <Text style={styles.floatingMenuText}>📋 Copy page text</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.floatingMenuItem}
              onPress={() => {
                setShowFloatingMenu(false);
                runAIMode('explain');
              }}
            >
              <Text style={styles.floatingMenuText}>📖 Explain this page</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.floatingMenuItem}
              onPress={() => {
                setShowFloatingMenu(false);
                openAIPanelBlank();
              }}
            >
              <Text style={styles.floatingMenuText}>✨ Ask AI</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Tab switcher modal */}
      <Modal visible={showTabSwitcher} animationType="slide" transparent onRequestClose={() => setShowTabSwitcher(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowTabSwitcher(false)}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}} style={styles.modalCard}>
            <Text style={styles.modalTitle}>Tabs</Text>
            <FlatList
              data={tabs}
              keyExtractor={(t) => String(t.id)}
              renderItem={({ item }) => (
                <View style={[styles.tabRow, item.id === activeTabId && styles.tabRowActive]}>
                  <TouchableOpacity style={{ flex: 1 }} onPress={() => switchTab(item.id)}>
                    <Text numberOfLines={1} style={styles.tabRowText}>
                      {item.isIncognito ? '🕵️ ' : ''}{item.title || item.url}
                    </Text>
                    <Text numberOfLines={1} style={styles.tabRowSubtext}>
                      {item.isIncognito ? 'Incognito' : item.url}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => closeTab(item.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Text style={styles.closeX}>✕</Text>
                  </TouchableOpacity>
                </View>
              )}
            />
            <TouchableOpacity onPress={() => addTab()} style={styles.newTabBtn}>
              <Text style={styles.newTabBtnText}>+ New Tab</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowTabSwitcher(false)} style={styles.closeModalBtn}>
              <Text style={styles.closeModalBtnText}>Close</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Library page — Bookmarks / History / Saved pages tabs, full-page slide-in from the right */}
      {libraryMounted && (
        <Modal visible={libraryMounted} animationType="none" transparent onRequestClose={closeLibrary}>
          <Animated.View
            style={[
              styles.libraryPage,
              nightMode && styles.libraryPageNight,
              { transform: [{ translateX: libraryPanelAnim }] },
            ]}
          >
            <View style={styles.libraryHeaderRow}>
              <TouchableOpacity onPress={closeLibrary} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="chevron-back" size={26} color={nightMode ? '#eee' : '#333'} />
              </TouchableOpacity>
              <View style={styles.libraryTabsRow}>
                {[
                  { key: 'bookmarks', label: 'Bookmarks' },
                  { key: 'history', label: 'History' },
                  { key: 'downloads', label: 'Saved pages' },
                ].map((t) => (
                  <TouchableOpacity key={t.key} onPress={() => switchLibraryTab(t.key)} style={{ marginLeft: 22 }}>
                    <Text
                      style={[
                        styles.libraryTabText,
                        libraryTab === t.key && styles.libraryTabTextActive,
                        nightMode && !(libraryTab === t.key) && { color: '#888' },
                      ]}
                    >
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={[styles.librarySearchBar, nightMode && styles.homeSearchInputNight]}>
              <Ionicons name="search-outline" size={18} color={nightMode ? '#999' : '#888'} />
              <TextInput
                style={[styles.librarySearchInput, nightMode && { color: '#fff' }]}
                value={librarySearch}
                onChangeText={setLibrarySearch}
                placeholder="Search"
                placeholderTextColor={nightMode ? '#888' : '#9a9a9a'}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <FlatList
              data={buildLibraryRows()}
              keyExtractor={(row) => row.key}
              contentContainerStyle={{ paddingBottom: 20 }}
              renderItem={({ item: row }) => {
                if (row.type === 'header') {
                  return (
                    <Text style={[styles.libraryDateHeader, nightMode && { color: '#888' }]}>{row.label}</Text>
                  );
                }
                const item = row.data;
                const iconName =
                  row.kind === 'bookmarks' ? 'star' : row.kind === 'downloads' ? 'document-outline' : 'time-outline';
                const title = item.title || item.name || item.url;
                const subtitle = row.kind === 'downloads' || row.kind === 'history' ? item.url : item.url;
                const onOpen = () => {
                  if (row.kind === 'downloads') {
                    openDownload(item);
                    return;
                  }
                  setUrlInput(item.url);
                  updateTab(activeTabId, { url: item.url, loading: true });
                  closeLibrary();
                };
                const onRemove =
                  row.kind === 'bookmarks'
                    ? () => removeBookmark(item.url)
                    : row.kind === 'downloads'
                    ? () => deleteDownload(item)
                    : null;
                return (
                  <View style={styles.libraryRow}>
                    <View style={[styles.libraryRowIcon, nightMode && { backgroundColor: '#222' }]}>
                      <Ionicons name={iconName} size={16} color={nightMode ? '#aaa' : '#666'} />
                    </View>
                    <TouchableOpacity style={{ flex: 1 }} onPress={onOpen}>
                      <Text numberOfLines={1} style={[styles.tabRowText, nightMode && { color: '#eee' }]}>
                        {title}
                      </Text>
                      <Text numberOfLines={1} style={styles.tabRowSubtext}>
                        {subtitle}
                      </Text>
                    </TouchableOpacity>
                    {onRemove && (
                      <TouchableOpacity onPress={onRemove} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Text style={styles.closeX}>✕</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              }}
              ListEmptyComponent={
                <Text style={styles.emptyText}>
                  {libraryTab === 'bookmarks'
                    ? 'No bookmarks yet — tap ☆ on any page'
                    : libraryTab === 'downloads'
                    ? 'No downloads yet — files you download from a page will show up here'
                    : 'No history yet'}
                </Text>
              }
            />

            <View style={[styles.libraryBottomBar, nightMode && { borderColor: '#222' }]}>
              <TouchableOpacity onPress={closeLibrary}>
                <Text style={[styles.libraryBottomBtnText, nightMode && { color: '#eee' }]}>Close</Text>
              </TouchableOpacity>
              {libraryTab === 'history' && history.length > 0 && (
                <TouchableOpacity onPress={clearHistory}>
                  <Text style={[styles.libraryBottomBtnText, { color: '#d1453b' }]}>Delete all</Text>
                </TouchableOpacity>
              )}
            </View>
          </Animated.View>
        </Modal>
      )}

      {/* AI subpage — opens full-height from the floating 🔍 button (Explain / Ask AI).
          There's no separate "find answers" mode: the user just types whatever they
          want to know about the screen into the input below and Ask AI answers it. */}
      <Modal visible={showAIPanel} animationType="slide" transparent onRequestClose={() => setShowAIPanel(false)}>
        <TouchableOpacity
          style={styles.aiOverlay}
          activeOpacity={1}
          onPress={() => setShowAIPanel(false)}
        >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ width: '100%' }}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => {}} style={styles.aiCard}>
            <View style={styles.aiHeaderRow}>
              <Text style={styles.modalTitle}>
                {aiMode === 'explain' ? '📖 Explaining this page' : '✨ Ask AI'}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setCustomKeyInput(aiProvider.apiKey || '');
                  setShowAISettings(true);
                }}
                style={styles.settingsGearBtn}
              >
                <Text style={styles.settingsGearText}>⚙️</Text>
              </TouchableOpacity>
            </View>

            <View style={{ flex: 1 }}>
              {aiLoading ? (
                <View style={styles.aiLoadingWrap}>
                  <ActivityIndicator size="large" color="#5B5FEF" />
                  <Text style={styles.aiLoadingText}>{AI_MODES[aiMode]?.hint || 'Thinking…'}</Text>
                </View>
              ) : (
                <ScrollView
                  style={{ flex: 1 }}
                  contentContainerStyle={{ paddingBottom: 20 }}
                  showsVerticalScrollIndicator
                  keyboardShouldPersistTaps="handled"
                >
                  <Text style={[styles.aiAnswer, aiError && styles.aiAnswerError]}>
                    {aiAnswer || 'Ask anything about what\u2019s on screen right now — I\u2019ll read the page and answer.'}
                  </Text>
                </ScrollView>
              )}
            </View>

            <View style={styles.aiInputRow}>
              <TextInput
                style={styles.aiInput}
                value={aiQuestion}
                onChangeText={setAiQuestion}
                placeholder="Ask anything about this page..."
                placeholderTextColor="#9a9a9a"
                onSubmitEditing={submitAIQuestion}
                returnKeyType="send"
              />
              <TouchableOpacity onPress={submitAIQuestion} style={styles.goBtn}>
                <Text style={styles.goBtnText}>Ask</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={() => setShowAIPanel(false)} style={styles.closeModalBtn}>
              <Text style={styles.closeModalBtnText}>Close</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>

      {/* AI Settings modal — None / Default (app key) / Custom key, Via-style */}
      <Modal visible={showAISettings} animationType="slide" transparent onRequestClose={() => setShowAISettings(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowAISettings(false)}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}} style={styles.modalCard}>
            <Text style={styles.modalTitle}>AI service provider</Text>

            <TouchableOpacity style={styles.providerRow} onPress={() => selectProviderMode('none')}>
              <View style={[styles.radioOuter, aiProvider.mode === 'none' && styles.radioOuterActive]}>
                {aiProvider.mode === 'none' && <View style={styles.radioInner} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.providerLabel}>None</Text>
                <Text style={styles.providerSubtext}>Turn AI features off</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.providerRow} onPress={() => selectProviderMode('default')}>
              <View style={[styles.radioOuter, aiProvider.mode === 'default' && styles.radioOuterActive]}>
                {aiProvider.mode === 'default' && <View style={styles.radioInner} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.providerLabel}>{isAdmin ? 'Default' : '🔒 Default'}</Text>
                <Text style={styles.providerSubtext}>
                  {isAdmin ? "Uses the app's built-in AI backend" : 'Locked — admin only'}
                </Text>
              </View>
            </TouchableOpacity>

            {!isAdmin && (
              <TouchableOpacity onPress={() => setShowAdminPrompt(true)} style={{ paddingVertical: 6 }}>
                <Text style={{ color: '#5B5FEF', fontSize: 13, fontWeight: '600' }}>Unlock Admin Access</Text>
              </TouchableOpacity>
            )}

            <View style={styles.providerRow}>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                onPress={() => aiProvider.mode === 'custom' || setShowAISettings(true)}
              >
                <View style={[styles.radioOuter, aiProvider.mode === 'custom' && styles.radioOuterActive]}>
                  {aiProvider.mode === 'custom' && <View style={styles.radioInner} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.providerLabel}>Custom (your own key)</Text>
                  <Text style={styles.providerSubtext}>Use your personal Groq API key</Text>
                </View>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.apiKeyInput}
              value={customKeyInput}
              onChangeText={setCustomKeyInput}
              placeholder="Paste your Groq API key here"
              placeholderTextColor="#9a9a9a"
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />

            <TouchableOpacity onPress={saveCustomKey} style={styles.newTabBtn}>
              <Text style={styles.newTabBtnText}>Save & Use Custom Key</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setShowAISettings(false)} style={styles.closeModalBtn}>
              <Text style={styles.closeModalBtnText}>Close</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Admin passcode prompt — unlocks the shared "Default" backend on this device */}
      <Modal visible={showAdminPrompt} animationType="fade" transparent onRequestClose={() => setShowAdminPrompt(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowAdminPrompt(false)}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}} style={styles.modalCard}>
            <Text style={styles.modalTitle}>Admin Access</Text>
            <Text style={styles.providerSubtext}>Enter the admin passcode to use the shared Default backend.</Text>
            <TextInput
              style={[styles.apiKeyInput, { marginTop: 14 }]}
              value={adminPasscodeInput}
              onChangeText={(t) => {
                setAdminPasscodeInput(t);
                setAdminError(false);
              }}
              placeholder="Passcode"
              placeholderTextColor="#9a9a9a"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={submitAdminPasscode}
            />
            {adminError && <Text style={{ color: '#d1453b', fontSize: 12, marginTop: 6 }}>Incorrect passcode.</Text>}
            <TouchableOpacity onPress={submitAdminPasscode} style={styles.newTabBtn}>
              <Text style={styles.newTabBtnText}>Unlock</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setShowAdminPrompt(false);
                setAdminPasscodeInput('');
                setAdminError(false);
              }}
              style={styles.closeModalBtn}
            >
              <Text style={styles.closeModalBtnText}>Cancel</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  incognitoBanner: {
    backgroundColor: '#1a1a1a',
    paddingVertical: 6,
    alignItems: 'center',
  },
  incognitoBannerText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  urlBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderColor: '#ececec',
  },
  homeBtn: { paddingHorizontal: 6, paddingVertical: 6 },
  homeBtnText: { fontSize: 18, color: '#5B5FEF' },
  urlInput: {
    flex: 1,
    backgroundColor: '#f1f1f3',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111',
  },
  starBtn: { paddingHorizontal: 8, paddingVertical: 6 },
  starBtnText: { fontSize: 20, color: '#c9c9c9' },
  starActive: { color: '#f5a623' },
  goBtn: {
    marginLeft: 6,
    backgroundColor: '#5B5FEF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  goBtnText: { color: '#fff', fontWeight: '600' },
  progressTrack: { height: 2, backgroundColor: 'transparent' },
  progressFill: { height: 2, backgroundColor: '#5B5FEF' },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  errorText: { fontSize: 15, color: '#666', marginBottom: 12 },
  retryBtn: { backgroundColor: '#5B5FEF', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 8 },
  retryBtnText: { color: '#fff', fontWeight: '600' },

  // Via-style bottom nav
  toolbarWrap: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderColor: '#ececec',
    ...Platform.select({
      android: { elevation: 12 },
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: -3 },
      },
    }),
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  toolBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolBtnText: { fontSize: 20, color: '#333' },
  toolBtnDisabled: { color: '#d0d0d0' },
  tabCountBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  tabCountText: { fontSize: 12, fontWeight: '700', color: '#333' },
  aiBtn: { backgroundColor: '#EDE9FE', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  aiBtnText: { fontSize: 14, fontWeight: '700', color: '#5B5FEF' },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 18,
    maxHeight: '78%',
  },

  // ---- Library page (Bookmarks / History / Saved pages) ----
  libraryPage: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: TOP_PADDING + 14,
  },
  libraryPageNight: { backgroundColor: '#111' },
  libraryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  libraryTabsRow: { flexDirection: 'row', marginLeft: 10 },
  libraryTabText: { fontSize: 17, color: '#999', fontWeight: '600' },
  libraryTabTextActive: { color: '#111' },
  librarySearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f1f3',
    borderRadius: 24,
    marginHorizontal: 16,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginBottom: 12,
  },
  librarySearchInput: { flex: 1, marginLeft: 8, paddingVertical: 10, fontSize: 15, color: '#111' },
  libraryDateHeader: {
    fontSize: 13,
    color: '#999',
    fontWeight: '600',
    paddingHorizontal: 16,
    marginTop: 10,
    marginBottom: 4,
  },
  libraryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  libraryRowIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#f1f1f3',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  libraryBottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: '#eee',
    paddingVertical: 14,
  },
  libraryBottomBtnText: { fontSize: 15, fontWeight: '600', color: '#5B5FEF' },
  // AI panel opens as a near-full-height "subpage" sliding up from the bottom
  aiOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  aiCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 18,
    width: '100%',
    height: '92%',
    ...Platform.select({
      android: { elevation: 14 },
      ios: { shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
    }),
  },
  aiHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  settingsGearBtn: { padding: 6 },
  settingsGearText: { fontSize: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 10, color: '#111' },
  modeRow: { flexDirection: 'row', marginBottom: 10 },
  modeChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#f1f1f1',
    marginRight: 8,
  },
  modeChipActive: { backgroundColor: '#5B5FEF' },
  modeChipText: { fontSize: 13, color: '#333', fontWeight: '600' },
  modeChipTextActive: { color: '#fff' },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  tabRowActive: { backgroundColor: '#F5F4FF' },
  tabRowText: { fontSize: 15, color: '#111' },
  tabRowSubtext: { fontSize: 12, color: '#999', marginTop: 2 },
  closeX: { fontSize: 16, color: '#999', paddingHorizontal: 8 },
  newTabBtn: { marginTop: 10, paddingVertical: 12, alignItems: 'center', backgroundColor: '#5B5FEF', borderRadius: 12 },
  newTabBtnText: { color: '#fff', fontWeight: '600' },
  closeModalBtn: { marginTop: 10, paddingVertical: 10, alignItems: 'center' },
  closeModalBtnText: { color: '#5B5FEF', fontWeight: '600' },
  clearHistoryBtn: { marginTop: 10, paddingVertical: 10, alignItems: 'center', backgroundColor: '#fdecec', borderRadius: 8 },
  clearHistoryText: { color: '#d1453b', fontWeight: '600' },
  aiAnswer: { fontSize: 15, lineHeight: 22, color: '#222' },
  aiAnswerError: { color: '#d1453b' },
  aiLoadingWrap: { alignItems: 'center', marginTop: 24 },
  aiLoadingText: { marginTop: 10, color: '#666', fontSize: 13 },
  qaItem: { marginBottom: 14, paddingBottom: 14, borderBottomWidth: 1, borderColor: '#eee' },
  qaQuestion: { fontSize: 14, fontWeight: '700', color: '#111', marginBottom: 4 },
  qaAnswer: { fontSize: 14, color: '#333', lineHeight: 20 },
  aiInputRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  aiInput: {
    flex: 1,
    backgroundColor: '#f1f1f1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
    color: '#111',
  },
  emptyText: { textAlign: 'center', color: '#999', marginTop: 20 },

  // AI Settings (provider) modal
  providerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#c9c9c9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  radioOuterActive: { borderColor: '#5B5FEF' },
  radioInner: { width: 11, height: 11, borderRadius: 6, backgroundColor: '#5B5FEF' },
  providerLabel: { fontSize: 16, color: '#111', fontWeight: '600' },
  providerSubtext: { fontSize: 12, color: '#999', marginTop: 2 },
  apiKeyInput: {
    backgroundColor: '#f1f1f1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#111',
    marginTop: 8,
  },

  // ---- Homepage (native, Via-style) ----
  homeScreen: { flex: 1, backgroundColor: '#fff', alignItems: 'center', paddingTop: 18, paddingHorizontal: 20 },
  homeScreenNight: { backgroundColor: '#111' },
  homeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 60,
  },
  homeHeaderTitle: { fontSize: 16, fontWeight: '600', color: '#333' },
  homeCenterWrap: { flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center' },
  homeUrlBar: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    backgroundColor: '#f1f1f3',
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginBottom: 60,
  },
  homeUrlBarNight: { backgroundColor: '#222' },
  homeUrlBarInput: {
    flex: 1,
    marginLeft: 8,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111',
  },
  homeLogoWrap: { alignItems: 'center', marginBottom: 32, width: '100%' },
  homeBrand: { fontSize: 18, fontWeight: '700', color: '#333', textAlign: 'center' },
  homeBrandNight: { color: '#eee' },
  homeSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    backgroundColor: '#f1f1f3',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#ececec',
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
  },
  homeSearchInputInner: {
    flex: 1,
    fontSize: 15,
    color: '#111',
    paddingVertical: 6,
  },
  homeSearchInputNight: { backgroundColor: '#222', borderColor: '#333', color: '#eee' },
  homeGoBtnInner: {
    backgroundColor: '#5B5FEF',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
  },
  homeGoBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },


  // ---- Hamburger grid menu ----
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  menuSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  menuGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  menuItem: { width: '20%', alignItems: 'center', marginBottom: 20 },
  menuIcon: { fontSize: 24, marginBottom: 6 },
  menuLabel: { fontSize: 11, color: '#333', textAlign: 'center' },
  menuCloseChevron: { alignItems: 'center', paddingVertical: 8 },

  // ---- Floating draggable "inspect" button ----
  floatingBtn: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  floatingBtnText: { fontSize: 30 },
  floatingMenuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)' },
  floatingMenuCard: {
    position: 'absolute',
    right: 16,
    bottom: 220,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 6,
    minWidth: 220,
    ...Platform.select({
      android: { elevation: 8 },
      ios: { shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
    }),
  },
  floatingMenuItem: { paddingVertical: 12, paddingHorizontal: 16 },
  floatingMenuText: { fontSize: 14, color: '#222', fontWeight: '600' },
});
