import React from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import ViaIcon from '../ViaIcon';
import layoutStyles from '../styles';

// --- APPLICATION NAVBAR PANEL ---
// Renders either the Homepage search-pill navbar, or the normal URL bar.
export default function TopBar({
  isHomeActive,
  isNightMode,
  isIncognitoTab,
  isHomeSearchActive,
  homeSearchText,
  setHomeSearchText,
  homeSearchInputRef,
  submitHomeSearch,
  activateHomeSearch,
  setIsHomeSearchActive,
  inputUrl,
  setInputUrl,
  navigateToUrl,
  progress,
  createNewTab,
  openQrScanner
}) {
  if (isHomeActive) {
    return (
      <View style={[layoutStyles.navbarContainerPanel, isNightMode && layoutStyles.nightComponentPanel, isIncognitoTab && { backgroundColor: '#2e1065' }]}>
        {isHomeSearchActive ? (
          <>
            <ViaIcon type="search" color={isNightMode ? '#94a3b8' : '#475569'} size={20} />
            <TextInput
              ref={homeSearchInputRef}
              style={[layoutStyles.homeNavbarInlineSearchInput, isNightMode && { color: '#ffffff' }]}
              placeholder="Search or type web address"
              placeholderTextColor="#94a3b8"
              value={homeSearchText}
              onChangeText={setHomeSearchText}
              onSubmitEditing={submitHomeSearch}
              autoFocus
              selectTextOnFocus
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity style={layoutStyles.navbarIconButtonAsset} onPress={() => setIsHomeSearchActive(false)}>
              <ViaIcon type="back_chevron" color={isNightMode ? '#cbd5e1' : '#475569'} size={20} />
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity style={[layoutStyles.homeNavbarLabelRow, { flex: 1 }]} activeOpacity={0.7} onPress={activateHomeSearch}>
              <ViaIcon type="search" color={isNightMode ? '#94a3b8' : '#475569'} size={20} />
              <Text style={[layoutStyles.homeNavbarLabelText, isNightMode && { color: '#e2e8f0' }]}>Homepage</Text>
            </TouchableOpacity>
            <TouchableOpacity style={layoutStyles.navbarIconButtonAsset} onPress={openQrScanner}>
              <ViaIcon type="qr_scan" color={isNightMode ? '#cbd5e1' : '#475569'} size={20} />
            </TouchableOpacity>
          </>
        )}
      </View>
    );
  }

  return (
    <View style={[layoutStyles.navbarContainerPanel, isNightMode && layoutStyles.nightComponentPanel, isIncognitoTab && { backgroundColor: '#2e1065' }]}>
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

      <TouchableOpacity style={layoutStyles.navbarIconButtonAsset} onPress={openQrScanner}>
        <ViaIcon type="qr_scan" color={isNightMode ? '#cbd5e1' : '#475569'} size={20} />
      </TouchableOpacity>
    </View>
  );
}
