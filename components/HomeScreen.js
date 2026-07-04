import React from 'react';
import { View, Image } from 'react-native';
import layoutStyles from '../styles';

export default function HomeScreen({ isNightMode }) {
  return (
    <View style={[layoutStyles.homeScreenCenterContainer, isNightMode && layoutStyles.nightModeShellBG]}>
      <Image source={require('../assets/logo.png')} style={layoutStyles.homeScreenLogoImage} resizeMode="contain" />
    </View>
  );
}
