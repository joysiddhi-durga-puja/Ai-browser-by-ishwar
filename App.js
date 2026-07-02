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
} from 'react-native';
import { WebView } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';

// ⚠️ Point this to your deployed backend (see api/ask.js in this project)
const AI_ENDPOINT = 'https://ai-browser-by-iswar.vercel.app/api/ask';

const HOME_URL = 'https://www.google.com';
const HISTORY_KEY = 'history_v1';
const BOOKMARKS_KEY = 'bookmarks_v1';
const MAX_HISTORY = 200;

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
    const looksLikeUrl = /^https?:\/\//i.test(trimmed) || /^[\w-]+\.[a-z]{2,}(\/.*)?$/i.test(trimmed);
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
    try {
      const res = await fetch(AI_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, question, pageContext, pageUrl: activeTab?.url }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'AI error');
      if (mode === 'find_answers') {
        setAiItems(Array.isArray(json.items) ? json.items : []);
      } else {
        setAiAnswer(json.answer || 'No response from AI.');
      }
    } catch (err) {
      setAiError(true);
      setAiAnswer('Could not reach the AI backend. Check AI_ENDPOINT in App.js and your network connection.');
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

      {/* Bottom toolbar */}
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
          <Text style={styles.toolBtnText}>✨ AI</Text>
        </TouchableOpacity>
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
            <Text style={styles.modalTitle}>✨ Ask AI about this page</Text>

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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  urlBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderColor: '#e2e2e2',
    backgroundColor: '#fff',
  },
  homeBtn: { paddingHorizontal: 6, paddingVertical: 6 },
  homeBtnText: { fontSize: 18, color: '#5B5FEF' },
  urlInput: {
    flex: 1,
    backgroundColor: '#f1f1f1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
    color: '#111',
  },
  starBtn: { paddingHorizontal: 8, paddingVertical: 6 },
  starBtnText: { fontSize: 20, color: '#c9c9c9' },
  starActive: { color: '#f5a623' },
  goBtn: {
    marginLeft: 4,
    backgroundColor: '#5B5FEF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
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
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderColor: '#e2e2e2',
    backgroundColor: '#fafafa',
  },
  toolBtn: { paddingHorizontal: 8, paddingVertical: 4, alignItems: 'center', justifyContent: 'center' },
  toolBtnText: { fontSize: 18, color: '#222' },
  toolBtnDisabled: { color: '#ccc' },
  tabCountBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#222',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tabCountText: { fontSize: 12, fontWeight: '700', color: '#222' },
  aiBtn: { backgroundColor: '#EDE9FE', borderRadius: 8, paddingHorizontal: 10 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    maxHeight: '75%',
  },
  aiCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    height: '72%',
  },
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
  newTabBtn: { marginTop: 10, paddingVertical: 10, alignItems: 'center', backgroundColor: '#5B5FEF', borderRadius: 8 },
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
});
