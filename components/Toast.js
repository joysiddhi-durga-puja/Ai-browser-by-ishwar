import React from 'react';
import { Animated, Text } from 'react-native';
import layoutStyles from '../styles';

// --- RUNTIME ANIMATED FADE TOAST OVERLAY (VIA STYLE) ---
export default function Toast({ showToast, toastMessage, toastFadeAnim }) {
  if (!showToast) return null;
  return (
    <Animated.View style={[layoutStyles.globalFloatingToastContainerBox, { opacity: toastFadeAnim }]}>
      <Text style={layoutStyles.globalToastMessageTextLabel}>{toastMessage}</Text>
    </Animated.View>
  );
}
