import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Animated, Image } from 'react-native';
import layoutStyles, { SCREEN_WIDTH } from '../styles';
import ViaIcon from '../ViaIcon';

// Deterministic color per hostname so the letter-bubble fallback still looks
// consistent for the same site across sessions (used only when the real
// favicon image fails to load — no network, bad domain, etc).
const FAVICON_PALETTE = ['#4f46e5', '#0ea5e9', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];
const extractHost = (rawUrl) => {
  try { return new URL(rawUrl).hostname.replace(/^www\./, ''); } catch { return rawUrl || ''; }
};
const colorForHost = (host) => {
  let hash = 0;
  for (let i = 0; i < host.length; i++) hash = host.charCodeAt(i) + ((hash << 5) - hash);
  return FAVICON_PALETTE[Math.abs(hash) % FAVICON_PALETTE.length];
};

// Shows the site's real favicon (via Google's public favicon service, so no
// extra native library is needed) and silently falls back to a colored
// letter bubble if the image request fails for any reason.
function SiteBubbleIcon({ url, size = 34 }) {
  const host = extractHost(url);
  const letter = (host.charAt(0) || '?').toUpperCase();
  const [imageFailed, setImageFailed] = useState(!host);

  if (imageFailed) {
    return (
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colorForHost(host), justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: size * 0.42 }}>{letter}</Text>
      </View>
    );
  }

  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
      <Image
        source={{ uri: `https://www.google.com/s2/favicons?sz=64&domain=${host}` }}
        style={{ width: size * 0.6, height: size * 0.6 }}
        resizeMode="contain"
        onError={() => setImageFailed(true)}
      />
    </View>
  );
}

// --- COMBINED HISTORY & BOOKMARKS SYSTEM WINDOW ---
// Slides in from the right edge of the screen (like a native side-panel)
// instead of covering the whole screen instantly, and stays mounted a
// little longer on close so the exit animation can actually play out.
export default function HistoryBookmarkModal({
  visible,
  activeSubTab,
  setActiveSubTab,
  bookmarks,
  history,
  isNightMode,
  navigateToUrl,
  setCurrentModal,
  wipeHistoryCollection
}) {
  const slideX = useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const [mounted, setMounted] = useState(false);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    if (visible) {
      setMounted(true);
      setSearchText('');
      Animated.timing(slideX, { toValue: 0, duration: 260, useNativeDriver: true }).start();
    } else {
      Animated.timing(slideX, { toValue: SCREEN_WIDTH, duration: 220, useNativeDriver: true }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible]);

  const closePanel = () => setCurrentModal(null);

  const filteredBookmarks = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return bookmarks;
    return bookmarks.filter(b => (b.title || '').toLowerCase().includes(q) || (b.url || '').toLowerCase().includes(q));
  }, [bookmarks, searchText]);

  // Groups flat history array into { label: 'Wed, Jul 01', entries: [...] }
  // buckets, preserving the order entries already come in (newest first).
  const groupedHistory = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    const source = q ? history.filter(h => (h.title || '').toLowerCase().includes(q) || (h.url || '').toLowerCase().includes(q)) : history;
    const order = [];
    const buckets = {};
    source.forEach(h => {
      const label = h.dateLabel || 'Earlier';
      if (!buckets[label]) { buckets[label] = []; order.push(label); }
      buckets[label].push(h);
    });
    return order.map(label => ({ label, entries: buckets[label] }));
  }, [history, searchText]);

  if (!mounted) return null;

  return (
    <View style={layoutStyles.historyPanelBackdrop} pointerEvents="box-none">
      <TouchableOpacity style={layoutStyles.historyPanelBackdropTouchable} activeOpacity={1} onPress={closePanel} />
      <Animated.View style={[layoutStyles.historyPanelSlideContainer, isNightMode && layoutStyles.nightModeShellBG, { transform: [{ translateX: slideX }] }]}>

        <View style={[layoutStyles.historyPanelHeaderRow, isNightMode && layoutStyles.nightComponentPanel]}>
          <TouchableOpacity onPress={closePanel} style={[layoutStyles.historyPanelBackBtn, { width: 'auto', paddingHorizontal: 8, flexDirection: 'row' }]}>
            <ViaIcon type="back_chevron" size={22} color={isNightMode ? '#e2e8f0' : '#334155'} />
            <Text style={{ fontSize: 16, marginLeft: 2, color: isNightMode ? '#e2e8f0' : '#334155' }}>Back</Text>
          </TouchableOpacity>
          <View style={layoutStyles.historyPanelTabsRow}>
            <TouchableOpacity style={[layoutStyles.historyPanelTabBtn, activeSubTab === 'bookmarks' && layoutStyles.historyPanelTabBtnActive]} onPress={() => setActiveSubTab('bookmarks')}>
              <Text style={[layoutStyles.historyPanelTabLabel, activeSubTab === 'bookmarks' && layoutStyles.historyPanelTabLabelActive, isNightMode && activeSubTab === 'bookmarks' && { color: '#ffffff' }]}>Bookmarks</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[layoutStyles.historyPanelTabBtn, activeSubTab === 'history' && layoutStyles.historyPanelTabBtnActive]} onPress={() => setActiveSubTab('history')}>
              <Text style={[layoutStyles.historyPanelTabLabel, activeSubTab === 'history' && layoutStyles.historyPanelTabLabelActive, isNightMode && activeSubTab === 'history' && { color: '#ffffff' }]}>History</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[layoutStyles.historyPanelSearchWrapper, isNightMode && { backgroundColor: '#1e1e1e' }]}>
          <ViaIcon type="search" size={16} color="#94a3b8" />
          <TextInput
            style={[layoutStyles.historyPanelSearchInput, isNightMode && { color: '#ffffff' }]}
            placeholder="Search"
            placeholderTextColor="#94a3b8"
            value={searchText}
            onChangeText={setSearchText}
          />
        </View>

        <ScrollView style={layoutStyles.modalScrollBodyCoreRenderingContentAreaScrollLayout} keyboardShouldPersistTaps="handled">
          {activeSubTab === 'bookmarks' ? (
            filteredBookmarks.length === 0 ? (
              <Text style={layoutStyles.emptyStateIllustrationTextStringLabel}>No bookmarks saved yet.</Text>
            ) : filteredBookmarks.map(b => (
              <TouchableOpacity key={b.id} style={layoutStyles.historyPanelRow} onPress={() => { navigateToUrl(b.url); closePanel(); }}>
                <SiteBubbleIcon url={b.url} />
                <View style={layoutStyles.historyPanelRowTextCol}>
                  <Text style={[layoutStyles.dataRowRecordPrimaryHeadlineTitleLabelText, isNightMode && { color: '#ffffff' }]} numberOfLines={1}>{b.title}</Text>
                  <Text style={layoutStyles.dataRowRecordSecondaryUrlDescriptionText} numberOfLines={1}>{b.url}</Text>
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <View>
              {groupedHistory.length === 0 ? (
                <Text style={layoutStyles.emptyStateIllustrationTextStringLabel}>No browsing history yet.</Text>
              ) : groupedHistory.map(group => (
                <View key={group.label}>
                  <Text style={[layoutStyles.historyPanelDateHeader, isNightMode && { color: '#a0aec0' }]}>{group.label}</Text>
                  {group.entries.map(h => (
                    <TouchableOpacity key={h.id} style={layoutStyles.historyPanelRow} onPress={() => { navigateToUrl(h.url); closePanel(); }}>
                      <SiteBubbleIcon url={h.url} />
                      <View style={layoutStyles.historyPanelRowTextCol}>
                        <Text style={[layoutStyles.dataRowRecordPrimaryHeadlineTitleLabelText, isNightMode && { color: '#ffffff' }]} numberOfLines={1}>{h.title}</Text>
                        <Text style={layoutStyles.dataRowRecordSecondaryUrlDescriptionText} numberOfLines={1}>{h.url}{h.time ? ` • ${h.time}` : ''}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
            </View>
          )}
          <View style={{ height: 24 }} />
        </ScrollView>

        {activeSubTab === 'history' && history.length > 0 && (
          <View style={[layoutStyles.historyPanelFooterRow, isNightMode && layoutStyles.nightComponentPanel]}>
            <TouchableOpacity onPress={wipeHistoryCollection}>
              <Text style={layoutStyles.historyPanelFooterDeleteText}>Delete all</Text>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>
    </View>
  );
}
