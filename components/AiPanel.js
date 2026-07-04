import React from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import layoutStyles from '../styles';

// --- COGNITIVE CORE LLAMA ASSISTANT BOTTOM SHEET PANEL ---
export default function AiPanel({
  visible,
  isNightMode,
  aiLoading,
  aiResponse,
  aiPrompt,
  setAiPrompt,
  executeCloudAiGatewayRequest,
  setShowAiPanel
}) {
  if (!visible) return null;
  return (
    <View style={layoutStyles.aiEnginePanelBackdrop} pointerEvents="box-none">
      <TouchableOpacity style={layoutStyles.aiEnginePanelBackdropTouchable} activeOpacity={1} onPress={() => setShowAiPanel(false)} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[layoutStyles.aiEngineFloatingPanelBottomSheetResponseContainerBlockBox, isNightMode && { backgroundColor: '#1e1e1e', borderTopColor: '#333333' }]}>
        <View style={layoutStyles.aiEnginePanelHeaderRowTitleBarActionsLayoutFlexBlock}>
          <Text style={[layoutStyles.aiEngineHeadlineTitleStringLabelText, isNightMode && { color: '#ffffff' }]}>Groq LLaMA Core Node Assistant</Text>
          <TouchableOpacity style={layoutStyles.aiEngineCloseActionAnchorInteractNode} onPress={() => setShowAiPanel(false)}>
            <Text style={{ color: '#ef4444', fontWeight: '800', fontSize: 14 }}>Dismiss</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={{ flex: 1, padding: 16 }}>
          {aiLoading ? (
            <View style={layoutStyles.aiEngineLoaderIndicatorCentralSpinnerWrapperContainer}>
              <ActivityIndicator size="large" color="#4f46e5" />
              <Text style={[{ marginTop: 16, color: '#64748b', fontWeight: '500' }, isNightMode && { color: '#a0aec0' }]}>Computing vectors parsing map...</Text>
            </View>
          ) : (
            <Text style={[layoutStyles.aiEngineOutputMarkdownResponseContentStringProseBody, isNightMode && { color: '#e2e8f0' }]}>{aiResponse}</Text>
          )}
        </ScrollView>
        <View style={layoutStyles.aiEngineInputInteractiveFooterCommandRowControlBlock}>
          <TextInput
            style={[layoutStyles.aiEngineInputControlTextEntryBoxFieldField, isNightMode && { color: '#ffffff', backgroundColor: '#2d2d2d', borderColor: '#444444' }]}
            placeholder="Query current operational DOM content context..."
            value={aiPrompt}
            onChangeText={setAiPrompt}
            placeholderTextColor="#94a3b8"
          />
          <TouchableOpacity style={layoutStyles.aiEngineSubmitPromptInteractiveActionNodeBtnAsset} onPress={() => executeCloudAiGatewayRequest()}>
            <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 13 }}>Execute</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
