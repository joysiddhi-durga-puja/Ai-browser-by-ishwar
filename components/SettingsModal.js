import React from 'react';
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
  setCurrentModal
}) {
  if (!visible) return null;
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[layoutStyles.fullscreenSystemOverlayContainerBlock, isNightMode && layoutStyles.nightModeShellBG]}>
      <View style={[layoutStyles.modalSingleHeaderTitleNavbarElementBlock, isNightMode && layoutStyles.nightComponentPanel]}>
        <Text style={[layoutStyles.modalSingleNavbarHeaderHeadlineTitleLabelString, isNightMode && { color: '#ffffff' }]}>Configuration Settings</Text>
      </View>
      <ScrollView style={layoutStyles.settingsMenuInnerOperationalContainerLayoutSectionBlock}>
        <View style={layoutStyles.settingsPanelInteractiveToggleConfigurationRowItem}>
          <View style={{ flex: 1, marginRight: 16 }}>
            <Text style={[layoutStyles.settingsToggleItemPrimaryHeadlineLabelTextString, isNightMode && { color: '#ffffff' }]}>Show AI Floating Portal</Text>
            <Text style={layoutStyles.settingsToggleItemSecondarySubDescriptionTextString}>Inject LLaMA dynamic assistant viewport anchor matrix tracks</Text>
          </View>
          <Switch value={isAiEnabled} onValueChange={onToggleAiEnabled} />
        </View>

        {/* --- AI API KEY INPUT --- */}
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

        {/* --- AI MODEL SELECTOR --- */}
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
      <TouchableOpacity style={layoutStyles.closeFullscreenSystemOverlayBtnFooter} onPress={() => setCurrentModal(null)}>
        <Text style={layoutStyles.closeSystemFooterBtnLabelString}>Close</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}
