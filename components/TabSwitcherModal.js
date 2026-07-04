import React, { useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Animated, PanResponder, Image, Dimensions, StyleSheet } from 'react-native';
import layoutStyles from '../styles';
import { HOME_URL } from '../constants';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = 12;
const GRID_PADDING = 14;
const CARD_WIDTH = (SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP) / 2;
const CARD_HEIGHT = CARD_WIDTH * 1.35;
const SWIPE_DISMISS_THRESHOLD = 90;
const TAP_MOVE_TOLERANCE = 6;

// --- CHROME / SAFARI STYLE TAB GRID CARD ---
// Two-column grid card: big thumbnail fills the tile, a small circular
// close button overlaps the top-right corner (Safari-style), and a thin
// title strip sits under the thumbnail. Flick the card sideways to dismiss
// it, exactly like Chrome/Safari's tab grid, or tap the X.
function TabCard({ item, isActive, isNightMode, onSelect, onClose }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(1)).current;
  const movedRef = useRef(false);

  const swipePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > TAP_MOVE_TOLERANCE || Math.abs(g.dy) > TAP_MOVE_TOLERANCE,
      onPanResponderGrant: () => {
        movedRef.current = false;
        Animated.spring(cardScale, { toValue: 0.97, useNativeDriver: true, friction: 6 }).start();
      },
      onPanResponderMove: (_, g) => {
        if (Math.abs(g.dx) > TAP_MOVE_TOLERANCE) movedRef.current = true;
        translateX.setValue(g.dx);
      },
      onPanResponderRelease: (_, g) => {
        Animated.spring(cardScale, { toValue: 1, useNativeDriver: true, friction: 6 }).start();
        const wasTap = !movedRef.current && Math.abs(g.dx) < TAP_MOVE_TOLERANCE && Math.abs(g.dy) < TAP_MOVE_TOLERANCE;
        if (wasTap) { onSelect(); return; }
        if (Math.abs(g.dx) > SWIPE_DISMISS_THRESHOLD) {
          Animated.timing(translateX, { toValue: g.dx > 0 ? SCREEN_WIDTH : -SCREEN_WIDTH, duration: 180, useNativeDriver: true })
            .start(() => onClose());
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true, friction: 7 }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(cardScale, { toValue: 1, useNativeDriver: true, friction: 6 }).start();
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true, friction: 7 }).start();
      }
    })
  ).current;

  const swipeOpacity = translateX.interpolate({
    inputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
    outputRange: [0.15, 1, 0.15],
    extrapolate: 'clamp'
  });

  return (
    <Animated.View
      style={[
        styles.cardWrapper,
        { transform: [{ translateX }, { scale: cardScale }], opacity: swipeOpacity }
      ]}
      {...swipePanResponder.panHandlers}
    >
      <View style={[
        styles.card,
        isActive && styles.cardActive,
        isNightMode && styles.cardNight,
        item.isIncognito && styles.cardIncognito
      ]}>
        <View style={styles.thumbnailArea}>
          {item.previewUri ? (
            <Image source={{ uri: item.previewUri }} style={styles.thumbnailImage} resizeMode="cover" />
          ) : (
            <View style={[styles.thumbnailPlaceholder, isNightMode && { backgroundColor: '#262626' }]}>
              <Text style={styles.thumbnailPlaceholderText}>{item.url === HOME_URL ? '🏠' : '🌐'}</Text>
            </View>
          )}
        </View>

        <View style={[styles.titleStrip, isNightMode && styles.titleStripNight]}>
          <Text style={[styles.cardTitle, isNightMode && { color: '#ffffff' }, item.isIncognito && { color: '#e9d5ff' }]} numberOfLines={1}>
            {item.isIncognito ? '🕶 ' : ''}{item.title || 'New Tab'}
          </Text>
        </View>
      </View>

      <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Text style={styles.closeBtnText}>✕</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// --- ALL WINDOW SYSTEMS SWITCHERS OVERLAYS ---
export default function TabSwitcherModal({
  visible,
  tabs,
  activeTabId,
  isNightMode,
  createNewTab,
  closeTab,
  setActiveTabId,
  setInputUrl,
  setIsHomeSearchActive,
  setShowTabSwitcher,
  closeAllTabs
}) {
  if (!visible) return null;

  const selectTab = (item) => {
    setActiveTabId(item.id);
    setInputUrl(item.url);
    setIsHomeSearchActive(false);
    setShowTabSwitcher(false);
  };

  return (
    <View style={[layoutStyles.fullscreenSystemOverlayContainerBlock, isNightMode && layoutStyles.nightModeShellBG]}>
      <View style={[styles.headerRow, isNightMode && layoutStyles.nightComponentPanel]}>
        <Text style={[styles.headerCount, isNightMode && { color: '#ffffff' }]}>
          {tabs.length} {tabs.length === 1 ? 'Tab' : 'Tabs'}
        </Text>
        <TouchableOpacity style={styles.doneBtn} onPress={() => setShowTabSwitcher(false)}>
          <Text style={styles.doneBtnText}>Done</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.gridContent}>
        {tabs.map((item) => (
          <TabCard
            key={item.id}
            item={item}
            isActive={item.id === activeTabId}
            isNightMode={isNightMode}
            onSelect={() => selectTab(item)}
            onClose={() => closeTab(item.id)}
          />
        ))}
      </ScrollView>

      <View style={[styles.bottomBar, isNightMode && layoutStyles.nightComponentPanel]}>
        <TouchableOpacity onPress={() => closeAllTabs ? closeAllTabs() : null} disabled={!closeAllTabs || tabs.length === 0}>
          <Text style={[styles.closeAllText, (!closeAllTabs || tabs.length === 0) && styles.closeAllTextDisabled]}>Close All</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.newTabBtn} onPress={() => createNewTab()}>
          <Text style={styles.newTabBtnPlus}>＋</Text>
          <Text style={styles.newTabBtnText}>New Tab</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    height: 56,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0'
  },
  headerCount: { fontSize: 17, fontWeight: '700', color: '#1e293b' },
  doneBtn: { paddingVertical: 6, paddingHorizontal: 4 },
  doneBtnText: { color: '#4f46e5', fontSize: 16, fontWeight: '700' },

  gridContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: GRID_PADDING,
    gap: GRID_GAP,
    paddingBottom: 24
  },
  cardWrapper: { width: CARD_WIDTH },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 16,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3
  },
  cardActive: { borderColor: '#4f46e5', borderWidth: 2.5 },
  cardNight: { backgroundColor: '#1e1e1e', borderColor: '#333333' },
  cardIncognito: { backgroundColor: '#2e1065', borderColor: '#a855f7' },

  thumbnailArea: { flex: 1, backgroundColor: '#e2e8f0' },
  thumbnailImage: { width: '100%', height: '100%' },
  thumbnailPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#eef2ff' },
  thumbnailPlaceholderText: { fontSize: 34 },

  titleStrip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9'
  },
  titleStripNight: { backgroundColor: '#1e1e1e', borderTopColor: '#2d2d2d' },
  cardTitle: { fontSize: 12.5, fontWeight: '600', color: '#334155' },

  closeBtn: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  closeBtnText: { color: '#64748b', fontSize: 12, fontWeight: '800' },

  bottomBar: {
    height: 64,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0'
  },
  closeAllText: { color: '#ef4444', fontSize: 15, fontWeight: '700' },
  closeAllTextDisabled: { color: '#cbd5e1' },
  newTabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4f46e5',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 22
  },
  newTabBtnPlus: { color: '#ffffff', fontSize: 16, fontWeight: '800', marginRight: 6 },
  newTabBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '700' }
});
