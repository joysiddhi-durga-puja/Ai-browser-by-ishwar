import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Animated } from 'react-native';
import layoutStyles, { SCREEN_WIDTH } from '../styles';
import ViaIcon from '../ViaIcon';

// --- STANDALONE DOWNLOADS MANAGEMENT SUB SYSTEM ---
// Same right-side slide-in shell as HistoryBookmarkModal, so both panels
// feel like one consistent system rather than two different modal styles.
// Downloads triggered from the WebView (see App.js:startFileDownload) land
// here live — the progress bar fills in real time as bytes come in, just
// like Chrome's download notification.
export default function DownloadsModal({ visible, downloads, isNightMode, setCurrentModal, openDownloadedFile, deleteDownloadEntry, clearAllDownloads }) {
  const slideX = useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(slideX, { toValue: 0, duration: 260, useNativeDriver: true }).start();
    } else {
      Animated.timing(slideX, { toValue: SCREEN_WIDTH, duration: 220, useNativeDriver: true }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible]);

  const closePanel = () => setCurrentModal(null);

  if (!mounted) return null;

  return (
    <View style={layoutStyles.historyPanelBackdrop} pointerEvents="box-none">
      <TouchableOpacity style={layoutStyles.historyPanelBackdropTouchable} activeOpacity={1} onPress={closePanel} />
      <Animated.View style={[layoutStyles.historyPanelSlideContainer, isNightMode && layoutStyles.nightModeShellBG, { transform: [{ translateX: slideX }] }]}>

        <View style={[layoutStyles.historyPanelHeaderRow, isNightMode && layoutStyles.nightComponentPanel]}>
          <TouchableOpacity onPress={closePanel} style={layoutStyles.historyPanelBackBtn}>
            <ViaIcon type="back_chevron" size={22} color={isNightMode ? '#e2e8f0' : '#334155'} />
          </TouchableOpacity>
          <View style={layoutStyles.downloadPanelTitleRow}>
            <Text style={[layoutStyles.downloadPanelTitleText, isNightMode && { color: '#ffffff' }]}>Downloads</Text>
          </View>
        </View>

        <ScrollView style={layoutStyles.modalScrollBodyCoreRenderingContentAreaScrollLayout}>
          {downloads.length === 0 ? (
            <Text style={layoutStyles.emptyStateIllustrationTextStringLabel}>Files you download from the browser will show up here.</Text>
          ) : downloads.map(d => {
            const isDownloading = d.status === 'Downloading';
            const isFailed = d.status === 'Failed';
            return (
              <TouchableOpacity
                key={d.id}
                style={layoutStyles.downloadRow}
                activeOpacity={isDownloading ? 1 : 0.6}
                onPress={() => { if (!isDownloading && !isFailed) openDownloadedFile(d); }}
              >
                <View style={layoutStyles.downloadRowIconPlate}>
                  <ViaIcon type="file" size={20} color={isFailed ? '#ef4444' : '#4f46e5'} />
                </View>
                <View style={layoutStyles.downloadRowTextCol}>
                  <Text style={[layoutStyles.downloadRowNameText, isNightMode && { color: '#ffffff' }]} numberOfLines={1}>{d.name}</Text>
                  <Text style={[layoutStyles.downloadRowMetaText, isFailed && layoutStyles.downloadRowMetaTextFailed]} numberOfLines={1}>
                    {isFailed ? 'Failed — tap trash to remove' : isDownloading ? `Downloading • ${d.size}` : `${d.status} • ${d.size} • ${d.date}`}
                  </Text>
                  {isDownloading && (
                    <View style={layoutStyles.downloadProgressTrack}>
                      <View style={[layoutStyles.downloadProgressFill, { width: `${d.progress || 0}%` }]} />
                    </View>
                  )}
                </View>
                {!isDownloading && (
                  <TouchableOpacity style={layoutStyles.downloadRowDeleteBtn} onPress={() => deleteDownloadEntry(d.id)}>
                    <ViaIcon type="trash" size={18} color="#94a3b8" />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            );
          })}
          <View style={{ height: 24 }} />
        </ScrollView>

        {downloads.length > 0 && (
          <View style={[layoutStyles.historyPanelFooterRow, isNightMode && layoutStyles.nightComponentPanel]}>
            <TouchableOpacity onPress={clearAllDownloads}>
              <Text style={layoutStyles.historyPanelFooterDeleteText}>Delete all</Text>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>
    </View>
  );
}
