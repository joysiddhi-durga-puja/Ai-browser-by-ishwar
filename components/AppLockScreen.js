import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import ViaIcon from '../ViaIcon';

// --- FULL-SCREEN BIOMETRIC LOCK OVERLAY ---
// Rendered above absolutely everything else (even modals) whenever the app
// is locked. There's no swipe-away/back-button escape from this screen on
// purpose — the hardware back handler in App.js already ignores back
// presses while this is showing.
export default function AppLockScreen({ isNightMode, attemptUnlock, unlockFailed }) {
  // Auto-fire the fingerprint prompt the instant this screen mounts (app
  // just opened, or just came back from background) so most of the time
  // the person never has to tap anything — they just see their own
  // fingerprint sheet pop up immediately.
  const hasAutoPrompted = useRef(false);
  useEffect(() => {
    if (hasAutoPrompted.current) return;
    hasAutoPrompted.current = true;
    attemptUnlock();
  }, []);

  const bg = isNightMode ? '#0f0f0f' : '#f8fafc';
  const textColor = isNightMode ? '#ffffff' : '#0f172a';
  const dimText = isNightMode ? '#94a3b8' : '#64748b';

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <View style={[styles.iconCircle, { backgroundColor: isNightMode ? '#1e1e1e' : '#e2e8f0' }]}>
        <ViaIcon type="fingerprint" size={44} color="#4f46e5" />
      </View>
      <Text style={[styles.title, { color: textColor }]}>AI Browser Locked</Text>
      <Text style={[styles.subtitle, { color: dimText }]}>
        {unlockFailed ? "Didn't match — try again" : 'Unlock with your fingerprint to continue'}
      </Text>
      <TouchableOpacity style={styles.unlockButton} onPress={attemptUnlock}>
        <ViaIcon type="fingerprint" size={18} color="#ffffff" />
        <Text style={styles.unlockButtonText}>Unlock</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 22
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    marginBottom: 6
  },
  subtitle: {
    fontSize: 13.5,
    textAlign: 'center',
    marginBottom: 28
  },
  unlockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#4f46e5',
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 12
  },
  unlockButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15
  }
});
