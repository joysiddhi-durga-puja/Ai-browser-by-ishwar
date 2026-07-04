import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity } from 'react-native';
import ViaIcon from '../ViaIcon';
import layoutStyles from '../styles';

export default function HomeScreen({ isNightMode, navigateToUrl }) {
  const [centerSearchText, setCenterSearchText] = useState('');
  const iconTextColor = isNightMode ? '#ffffff' : '#000000';

  const submitCenterSearch = () => {
    if (!centerSearchText.trim()) return;
    navigateToUrl && navigateToUrl(centerSearchText);
    setCenterSearchText('');
  };

  return (
    <View style={[layoutStyles.homeScreenCenterContainer, isNightMode && layoutStyles.nightModeShellBG]}>
      <View style={[layoutStyles.homeScreenCenterSearchPill, isNightMode && layoutStyles.homeScreenCenterSearchPillNight]}>
        <TextInput
          style={[layoutStyles.homeScreenCenterSearchInput, { color: iconTextColor }]}
          placeholder="Search or type web address"
          placeholderTextColor="#94a3b8"
          value={centerSearchText}
          onChangeText={setCenterSearchText}
          onSubmitEditing={submitCenterSearch}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity onPress={submitCenterSearch} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <ViaIcon type="search" color={iconTextColor} size={20} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
