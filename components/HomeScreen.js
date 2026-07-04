import React from 'react';
import { View, Image, TouchableOpacity } from 'react-native';
import layoutStyles from '../styles';

export default function HomeScreen({ isNightMode, activateHomeSearch }) {
  return (
    <View style={[layoutStyles.homeScreenCenterContainer, isNightMode && layoutStyles.nightModeShellBG]}>
      <Image source={require('../assets/logo.png')} style={layoutStyles.homeScreenLogoImage} resizeMode="contain" />
      <TouchableOpacity
        style={[layoutStyles.homeScreenCenterSearchPill, isNightMode && layoutStyles.homeScreenCenterSearchPillNight]}
        activeOpacity={0.8}
        onPress={activateHomeSearch}
      />
    </View>
  );
}
