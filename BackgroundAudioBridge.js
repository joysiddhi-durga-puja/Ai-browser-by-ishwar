import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

const { BackgroundAudioModule } = NativeModules;

export function startBackgroundAudio(title, artist) {
  if (Platform.OS === 'android' && BackgroundAudioModule) {
    BackgroundAudioModule.start(title || 'AI Browser', artist || 'Playing in background');
  }
}

export function stopBackgroundAudio() {
  if (Platform.OS === 'android' && BackgroundAudioModule) {
    BackgroundAudioModule.stop();
  }
}

// Updates the title/subtitle shown on the lockscreen and notification
// without restarting the foreground service (call this whenever the video
// title changes, e.g. navigating to a new YouTube video mid-playback).
export function updateBackgroundAudioMetadata(title, artist) {
  if (Platform.OS === 'android' && BackgroundAudioModule) {
    BackgroundAudioModule.updateMetadata(title || 'AI Browser', artist || 'Playing in background');
  }
}

// Keeps the lockscreen play/pause icon in sync when the video is
// paused/resumed from inside the WebView itself (rather than from the
// lockscreen button, which already updates itself immediately).
export function setBackgroundAudioPlaying(isPlaying) {
  if (Platform.OS === 'android' && BackgroundAudioModule) {
    BackgroundAudioModule.setPlaying(isPlaying);
  }
}

// Subscribes to lockscreen/notification play/pause button presses. Returns
// an unsubscribe function. The callback receives 'play' or 'pause' - use it
// to inject `video.play()`/`video.pause()` into the currently active tab.
export function subscribeToBackgroundAudioActions(callback) {
  if (Platform.OS !== 'android' || !BackgroundAudioModule) return () => {};
  const emitter = new NativeEventEmitter(BackgroundAudioModule);
  const subscription = emitter.addListener('BackgroundAudioAction', callback);
  return () => subscription.remove();
}
