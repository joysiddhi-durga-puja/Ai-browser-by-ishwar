import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, Switch, KeyboardAvoidingView, Platform } from 'react-native';
import layoutStyles from '../styles';
import { AVAILABLE_AI_MODELS } from '../constants';

// --- USER SYSTEM CONTROL SETTINGS PANEL ---
export default function SettingsModal({
  visible,
  isNightMode,
  isAiEnabled,
  onToggleAiEnabled,
  aiApiKeyDraft,
  setAiApiKeyDraft,
  aiModel,
  setAiModel,
  persistAiSettings,
  downloadFolderLabel,
  chooseDownloadFolder,
  isAppLockEnabled,
  toggleAppLock,
  setCurrentModal
}) {
  const [page, setPage] = useState('root'); // 'root' | 'ai' | 'download'
  if (!visible) return null;

  const headerTitle = page === 'ai' ? 'AI Settings' : page === 'download' ? 'Download settings' : 'Configuration Settings';
  const onBack = () => (page === 'root' ? setCurrentModal(null) : setPage('root'));

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[layoutStyles.fullscreenSystemOverlayContainerBlock, isNightMode && layoutStyles.nightModeShellBG]}>
      <View style={[layoutStyles.modalSingleHeaderTitleNavbarElementBlock, isNightMode && layoutStyles.nightComponentPanel, { flexDirection: 'row', alignItems: 'center' }]}>
        <TouchableOpacity onPress={onBack} style={{ flexDirection: 'row', alignItems: 'center', paddingRight: 12 }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 6 }}>
          <Text style={{ fontSize: 22, color: isNightMode ? '#ffffff' : '#0f172a' }}>‹</Text>
          <Text style={{ fontSize: 16, marginLeft: 2, color: isNightMode ? '#ffffff' : '#0f172a' }}>Back</Text>
        </TouchableOpacity>
        <Text style={[layoutStyles.modalSingleNavbarHeaderHeadlineTitleLabelString, isNightMode && { color: '#ffffff' }]}>{headerTitle}</Text>
      </View>

      {page === 'root' && (
        <ScrollView style={layoutStyles.settingsMenuInnerOperationalContainerLayoutSectionBlock}>
          <TouchableOpacity style={layoutStyles.settingsPanelInteractiveToggleConfigurationRowItem} onPress={() => setPage('ai')}>
            <Text style={[layoutStyles.settingsToggleItemPrimaryHeadlineLabelTextString, isNightMode && { color: '#ffffff' }]}>AI Settings</Text>
            <Text style={{ fontSize: 20, color: '#94a3b8' }}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={layoutStyles.settingsPanelInteractiveToggleConfigurationRowItem} onPress={() => setPage('download')}>
            <Text style={[layoutStyles.settingsToggleItemPrimaryHeadlineLabelTextString, isNightMode && { color: '#ffffff' }]}>Download settings</Text>
            <Text style={{ fontSize: 20, color: '#94a3b8' }}>›</Text>
          </TouchableOpacity>

          <View style={layoutStyles.settingsPanelInteractiveToggleConfigurationRowItem}>
            <View style={{ flex: 1, marginRight: 16 }}>
              <Text style={[layoutStyles.settingsToggleItemPrimaryHeadlineLabelTextString, isNightMode && { color: '#ffffff' }]}>App Lock (Fingerprint)</Text>
              <Text style={layoutStyles.settingsToggleItemSecondarySubDescriptionTextString}>Require your fingerprint every time you open the app</Text>
            </View>
            <Switch value={!!isAppLockEnabled} onValueChange={toggleAppLock} />
          </View>
        </ScrollView>
      )}

      {page === 'ai' && (
        <ScrollView style={layoutStyles.settingsMenuInnerOperationalContainerLayoutSectionBlock}>
          <View style={layoutStyles.settingsPanelInteractiveToggleConfigurationRowItem}>
            <View style={{ flex: 1, marginRight: 16 }}>
              <Text style={[layoutStyles.settingsToggleItemPrimaryHeadlineLabelTextString, isNightMode && { color: '#ffffff' }]}>Show AI Floating Portal</Text>
              <Text style={layoutStyles.settingsToggleItemSecondarySubDescriptionTextString}>Inject LLaMA dynamic assistant viewport anchor matrix tracks</Text>
            </View>
            <Switch value={isAiEnabled} onValueChange={onToggleAiEnabled} />
          </View>

          <View style={layoutStyles.settingsSectionBlockPadded}>
            <Text style={[layoutStyles.settingsToggleItemPrimaryHeadlineLabelTextString, isNightMode && { color: '#ffffff' }]}>Groq API Key</Text>
            <Text style={layoutStyles.settingsToggleItemSecondarySubDescriptionTextString}>Stored only on this device. Get a free key from console.groq.com</Text>
            <TextInput
              style={[layoutStyles.settingsApiKeyInputField, isNightMode && { color: '#ffffff', backgroundColor: '#2d2d2d', borderColor: '#444444' }]}
              placeholder="gsk_xxxxxxxxxxxxxxxxxxxx"
              placeholderTextColor="#94a3b8"
              value={aiApiKeyDraft}
              onChangeText={setAiApiKeyDraft}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />
          </View>

          <View style={layoutStyles.settingsSectionBlockPadded}>
            <Text style={[layoutStyles.settingsToggleItemPrimaryHeadlineLabelTextString, isNightMode && { color: '#ffffff' }]}>AI Model</Text>
            <Text style={layoutStyles.settingsToggleItemSecondarySubDescriptionTextString}>Choose which Groq model powers the assistant</Text>
            <View style={layoutStyles.settingsModelChipRowWrap}>
              {AVAILABLE_AI_MODELS.map(modelOption => (
                <TouchableOpacity
                  key={modelOption.id}
                  style={[
                    layoutStyles.settingsModelChipItem,
                    isNightMode && { backgroundColor: '#2d2d2d', borderColor: '#444444' },
                    aiModel === modelOption.id && layoutStyles.settingsModelChipItemActive
                  ]}
                  onPress={() => setAiModel(modelOption.id)}
                >
                  <Text style={[
                    layoutStyles.settingsModelChipLabelText,
                    isNightMode && { color: '#cccccc' },
                    aiModel === modelOption.id && layoutStyles.settingsModelChipLabelTextActive
                  ]}>
                    {modelOption.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity style={layoutStyles.settingsSaveAiConfigButton} onPress={persistAiSettings}>
            <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 15 }}>Save AI Settings</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {page === 'download' && (
        <ScrollView style={layoutStyles.settingsMenuInnerOperationalContainerLayoutSectionBlock}>
          <View style={layoutStyles.settingsSectionBlockPadded}>
            <Text style={[layoutStyles.settingsToggleItemPrimaryHeadlineLabelTextString, isNightMode && { color: '#ffffff' }]}>Download location</Text>
            <Text style={layoutStyles.settingsToggleItemSecondarySubDescriptionTextString}>Pick internal storage or SD card. Files save into an "AI Browser" folder there.</Text>
            <TouchableOpacity
              style={[layoutStyles.settingsApiKeyInputField, { justifyContent: 'center' }, isNightMode && { backgroundColor: '#2d2d2d', borderColor: '#444444' }]}
              onPress={chooseDownloadFolder}
            >
              <Text style={isNightMode ? { color: '#ffffff' } : null} numberOfLines={1}>📁 {downloadFolderLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[layoutStyles.settingsSaveAiConfigButton, { marginTop: 10 }]} onPress={chooseDownloadFolder}>
              <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 15 }}>Change Folder</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}
