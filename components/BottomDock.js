import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import ViaIcon from '../ViaIcon';
import layoutStyles from '../styles';

// --- BASE DECK TOOLBAR PANEL ---
export default function BottomDock({
  activeTab,
  webViewRefs,
  activeTabId,
  goHome,
  isNightMode,
  tabsCount,
  setShowTabSwitcher,
  isMenuVisible,
  toggleBottomMenu
}) {
  return (
    <View style={[layoutStyles.dockActionToolbarSystemPanel, isNightMode && layoutStyles.nightComponentPanel]}>
      <TouchableOpacity disabled={!activeTab.canGoBack} onPress={() => webViewRefs.current[activeTabId]?.goBack()}>
        <Text style={[layoutStyles.dockEmojiControlLabel, !activeTab.canGoBack && layoutStyles.dockControlAssetDisabledState]}>◀</Text>
      </TouchableOpacity>
      <TouchableOpacity disabled={!activeTab.canGoForward} onPress={() => webViewRefs.current[activeTabId]?.goForward()}>
        <Text style={[layoutStyles.dockEmojiControlLabel, !activeTab.canGoForward && layoutStyles.dockControlAssetDisabledState]}>▶</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={goHome}>
        <ViaIcon type="home" color={isNightMode ? '#e2e8f0' : '#334155'} size={24} />
      </TouchableOpacity>
      <TouchableOpacity onPress={() => setShowTabSwitcher(true)}>
        <View style={[layoutStyles.tabsNumberIndicatorBadge, isNightMode && { borderColor: '#e2e8f0' }]}>
          <Text style={[layoutStyles.tabsCounterTextString, isNightMode && { color: '#e2e8f0' }]}>{tabsCount}</Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => toggleBottomMenu(!isMenuVisible)}>
        <Text style={[layoutStyles.dockEmojiControlLabel, isNightMode && { color: '#e2e8f0' }]}>☰</Text>
      </TouchableOpacity>
    </View>
  );
}
