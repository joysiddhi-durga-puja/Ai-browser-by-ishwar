import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  FlatList,
  Modal,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Animated,
  Easing,
  StatusBar as RNStatusBar,
} from 'react-native';
import { WebView } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';

// ⚠️ Point this to your deployed backend (see api/ask.js in this project)
const AI_ENDPOINT = 'https://ai-browser-by-iswar.vercel.app/api/ask';
const GROQ_DIRECT_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

const HOME_URL = 'https://www.google.com';
const HISTORY_KEY = 'history_v1';
const BOOKMARKS_KEY = 'bookmarks_v1';
const AI_PROVIDER_KEY = 'ai_provider_v1';
const ADMIN_UNLOCK_KEY = 'ai_admin_unlocked_v1';
// ⚠️ Change this to your own secret. Only devices that enter this correctly
// can use the app's shared "Default" backend — everyone else must add their own key.
const ADMIN_PASSCODE = 'joysiddhi123';
const MAX_HISTORY = 200;
const TOP_PADDING = Platform.OS === 'android' ? (RNStatusBar.currentHeight || 24) : 0;

let tabIdCounter = 1;
const makeTab = (url = HOME_URL) => ({
  id: tabIdCounter++,
  url,
  title: url,
  canGoBack: false,
  canGoForward: false,
  loading: true,
});

const AI_MODES = [
  { key: 'ask', label: '💬 Ask', hint: 'Ask something about this page…' },
  { key: 'explain', label: '📖 Explain', hint: 'Explaining the page…' },
  { key: 'find_answers', label: '❓ Find Q&A', hint: 'Scanning page for questions…' },
];

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
  const [urlInput, setUrlInput] = useState(HOME_URL);
  const [showTabSwitcher, setShowTabSwitcher] = useState(false);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [aiMode, setAiMode] = useState('ask');
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiAnswer, setAiAnswer] = useState('');
  const [aiItems, setAiItems] = useState(null); // for find_answers structured results
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(false);
  const [bookmarks, setBookmarks] = useState([]);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

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

  // ---------- Persisted data on boot ----------
  useEffect(() => {
    (async () => {
      try {
        const storedBookmarks = await AsyncStorage.getItem(BOOKMARKS_KEY);
        if (storedBookmarks) setBookmarks(JSON.parse(storedBookmarks));
        const storedHistory = await AsyncStorage.getItem(HISTORY_KEY);
        if (storedHistory) setHistory(JSON.parse(storedHistory));
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

  // ---------- Tab helpers ----------
  const updateTab = (id, patch) => {
    setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };

  const addTab = (url) => {
    const newTab = makeTab(url);
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
    setUrlInput(newTab.url);
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
    if (tab) setUrlInput(tab.url);
    setShowTabSwitcher(false);
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
  const goHome = () => updateTab(activeTabId, { url: HOME_URL, loading: true });

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

  const [pendingAIAction, setPendingAIAction] = useState(null); // mode key or null

  const handleWebViewMessage = async (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'PAGE_TEXT' && pendingAIAction) {
        const mode = pendingAIAction;
        setPendingAIAction(null);
        await askAI({ mode, pageContext: data.text });
      }
    } catch (e) {
      // ignore non-JSON messages
    }
  };

  const runAIMode = (mode) => {
    setAiMode(mode);
    setShowAIPanel(true);
    setAiAnswer('');
    setAiItems(null);
    setAiError(false);
    setAiLoading(true);
    setPendingAIAction(mode);
    webviewRefs.current[activeTabId]?.injectJavaScript(EXTRACT_TEXT_JS);
  };

  const askAI = async ({ mode = 'ask', question = '', pageContext = '' }) => {
    setAiLoading(true);
    setAiError(false);
    setAiAnswer('');
    setAiItems(null);

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

      if (mode === 'find_answers') {
        setAiItems(Array.isArray(json.items) ? json.items : []);
      } else {
        setAiAnswer(json.answer || 'No response from AI.');
      }
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

  const submitAIQuestion = () => {
    if (!aiQuestion.trim()) return;
    setAiMode('ask');
    askAI({ mode: 'ask', question: aiQuestion.trim() });
  };

  const openAIPanelBlank = () => {
    setAiMode('ask');
    setAiAnswer('');
    setAiItems(null);
    setAiError(false);
    setShowAIPanel(true);
  };

  // ---------- Render ----------
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={{ height: TOP_PADDING, backgroundColor: '#fff' }} />

      {/* URL bar */}
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

      {/* Active WebView */}
      <View style={{ flex: 1 }}>
        {tabs.map((tab) => (
          <View key={tab.id} style={[StyleSheet.absoluteFill, { display: tab.id === activeTabId ? 'flex' : 'none' }]}>
            <WebView
              ref={(ref) => (webviewRefs.current[tab.id] = ref)}
              source={{ uri: tab.url }}
              onLoadStart={() => updateTab(tab.id, { loading: true })}
              onLoadEnd={() => {
                updateTab(tab.id, { loading: false });
                const t = tabs.find((x) => x.id === tab.id);
                addToHistory(t?.url, t?.title);
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
        ))}
      </View>

      {/* Bottom toolbar — Via-style polished nav */}
      <View style={styles.toolbarWrap}>
        <View style={styles.toolbar}>
          <TouchableOpacity onPress={goBack} disabled={!activeTab?.canGoBack} style={styles.toolBtn}>
            <Text style={[styles.toolBtnText, !activeTab?.canGoBack && styles.toolBtnDisabled]}>←</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={goForward} disabled={!activeTab?.canGoForward} style={styles.toolBtn}>
            <Text style={[styles.toolBtnText, !activeTab?.canGoForward && styles.toolBtnDisabled]}>→</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={reload} style={styles.toolBtn}>
            <Text style={styles.toolBtnText}>⟳</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowHistory(true)} style={styles.toolBtn}>
            <Text style={styles.toolBtnText}>🕘</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowBookmarks(true)} style={styles.toolBtn}>
            <Text style={styles.toolBtnText}>📑</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowTabSwitcher(true)} style={styles.toolBtn}>
            <View style={styles.tabCountBadge}>
              <Text style={styles.tabCountText}>{tabs.length}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => runAIMode('ask')} onLongPress={openAIPanelBlank} style={[styles.toolBtn, styles.aiBtn]}>
            <Text style={styles.aiBtnText}>✨ AI</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tab switcher modal */}
      <Modal visible={showTabSwitcher} animationType="slide" transparent onRequestClose={() => setShowTabSwitcher(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Tabs</Text>
            <FlatList
              data={tabs}
              keyExtractor={(t) => String(t.id)}
              renderItem={({ item }) => (
                <View style={[styles.tabRow, item.id === activeTabId && styles.tabRowActive]}>
                  <TouchableOpacity style={{ flex: 1 }} onPress={() => switchTab(item.id)}>
                    <Text numberOfLines={1} style={styles.tabRowText}>
                      {item.title || item.url}
                    </Text>
                    <Text numberOfLines={1} style={styles.tabRowSubtext}>
                      {item.url}
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
          </View>
        </View>
      </Modal>

      {/* Bookmarks modal */}
      <Modal visible={showBookmarks} animationType="slide" transparent onRequestClose={() => setShowBookmarks(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Bookmarks</Text>
            <FlatList
              data={bookmarks}
              keyExtractor={(b, i) => String(i)}
              renderItem={({ item }) => (
                <View style={styles.tabRow}>
                  <TouchableOpacity
                    style={{ flex: 1 }}
                    onPress={() => {
                      setUrlInput(item.url);
                      updateTab(activeTabId, { url: item.url, loading: true });
                      setShowBookmarks(false);
                    }}
                  >
                    <Text numberOfLines={1} style={styles.tabRowText}>
                      {item.title || item.url}
                    </Text>
                    <Text numberOfLines={1} style={styles.tabRowSubtext}>
                      {item.url}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => removeBookmark(item.url)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Text style={styles.closeX}>✕</Text>
                  </TouchableOpacity>
                </View>
              )}
              ListEmptyComponent={<Text style={styles.emptyText}>No bookmarks yet — tap ☆ on any page</Text>}
            />
            <TouchableOpacity onPress={() => setShowBookmarks(false)} style={styles.closeModalBtn}>
              <Text style={styles.closeModalBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* History modal */}
      <Modal visible={showHistory} animationType="slide" transparent onRequestClose={() => setShowHistory(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>History</Text>
            <FlatList
              data={history}
              keyExtractor={(h, i) => String(i) + h.ts}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.tabRow}
                  onPress={() => {
                    setUrlInput(item.url);
                    updateTab(activeTabId, { url: item.url, loading: true });
                    setShowHistory(false);
                  }}
                >
                  <Text numberOfLines={1} style={styles.tabRowText}>
                    {item.title || item.url}
                  </Text>
                  <Text numberOfLines={1} style={styles.tabRowSubtext}>
                    {new Date(item.ts).toLocaleString()}
                  </Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={styles.emptyText}>No history yet</Text>}
            />
            {history.length > 0 && (
              <TouchableOpacity onPress={clearHistory} style={styles.clearHistoryBtn}>
                <Text style={styles.clearHistoryText}>Clear History</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => setShowHistory(false)} style={styles.closeModalBtn}>
              <Text style={styles.closeModalBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* AI panel */}
      <Modal visible={showAIPanel} animationType="slide" transparent onRequestClose={() => setShowAIPanel(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.aiCard}>
            <View style={styles.aiHeaderRow}>
              <Text style={styles.modalTitle}>✨ Ask AI about this page</Text>
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

            {/* Mode chips */}
            <View style={styles.modeRow}>
              {AI_MODES.map((m) => (
                <TouchableOpacity
                  key={m.key}
                  onPress={() => runAIMode(m.key)}
                  style={[styles.modeChip, aiMode === m.key && styles.modeChipActive]}
                >
                  <Text style={[styles.modeChipText, aiMode === m.key && styles.modeChipTextActive]}>{m.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ flex: 1 }}>
              {aiLoading ? (
                <View style={styles.aiLoadingWrap}>
                  <ActivityIndicator size="large" color="#5B5FEF" />
                  <Text style={styles.aiLoadingText}>
                    {AI_MODES.find((m) => m.key === aiMode)?.hint || 'Thinking…'}
                  </Text>
                </View>
              ) : aiItems ? (
                <FlatList
                  data={aiItems}
                  keyExtractor={(item, i) => String(i)}
                  ListEmptyComponent={<Text style={styles.aiAnswer}>No questions found on this page.</Text>}
                  renderItem={({ item }) => (
                    <View style={styles.qaItem}>
                      <Text style={styles.qaQuestion}>Q: {item.question}</Text>
                      <Text style={styles.qaAnswer}>A: {item.answer}</Text>
                    </View>
                  )}
                />
              ) : (
                <Text style={[styles.aiAnswer, aiError && styles.aiAnswerError]}>
                  {aiAnswer || 'Pick a mode above, or type a question below.'}
                </Text>
              )}
            </View>

            <View style={styles.aiInputRow}>
              <TextInput
                style={styles.aiInput}
                value={aiQuestion}
                onChangeText={setAiQuestion}
                placeholder="Ask something about this page..."
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
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* AI Settings modal — None / Default (app key) / Custom key, Via-style */}
      <Modal visible={showAISettings} animationType="slide" transparent onRequestClose={() => setShowAISettings(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
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
          </View>
        </View>
      </Modal>

      {/* Admin passcode prompt — unlocks the shared "Default" backend on this device */}
      <Modal visible={showAdminPrompt} animationType="fade" transparent onRequestClose={() => setShowAdminPrompt(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
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
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
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
  aiCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 18,
    height: '72%',
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
});
