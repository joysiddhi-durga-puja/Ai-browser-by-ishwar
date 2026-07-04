import React from 'react';
import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import layoutStyles from '../styles';
import { HOME_URL } from '../constants';

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
  setShowTabSwitcher
}) {
  if (!visible) return null;
  return (
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
          <View style={[layoutStyles.workspaceItemCardGridPlate, item.id === activeTabId && layoutStyles.activeWorkspaceBorderTrackColorIndicator, isNightMode && { backgroundColor: '#1e1e1e' }, item.isIncognito && { backgroundColor: '#2e1065', borderColor: '#a855f7' }]}>
            <View style={layoutStyles.workspaceItemCardHeaderFlexBlockRow}>
              <Text style={[layoutStyles.workspaceCardTitleTextStringLabel, isNightMode && { color: '#ffffff' }, item.isIncognito && { color: '#e9d5ff' }]} numberOfLines={1}>{item.isIncognito ? '🕶 ' : ''}{item.title}</Text>
              <TouchableOpacity style={layoutStyles.workspaceCardCloseInteractiveNodeAsset} onPress={() => closeTab(item.id)}>
                <Text style={{ color: '#94a3b8', fontSize: 14, fontWeight: '700' }}>✕</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={layoutStyles.workspaceCardInteractiveClickAreaContainer} onPress={() => { setActiveTabId(item.id); setInputUrl(item.url); setIsHomeSearchActive(false); setShowTabSwitcher(false); }}>
              <Text style={layoutStyles.workspaceCardContentUrlTextStringDescription} numberOfLines={4}>{item.url === HOME_URL ? 'Homepage' : item.url}</Text>
            </TouchableOpacity>
          </View>
        )}
      />
      <TouchableOpacity style={layoutStyles.closeFullscreenSystemOverlayBtnFooter} onPress={() => setShowTabSwitcher(false)}>
        <Text style={layoutStyles.closeSystemFooterBtnLabelString}>Resume Session Execution</Text>
      </TouchableOpacity>
    </View>
  );
}
