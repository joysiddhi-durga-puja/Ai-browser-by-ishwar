import React, { useRef } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import layoutStyles from '../styles';
import ViaIcon from '../ViaIcon';

// Splits a message's raw text into an ordered list of 'text' and 'table'
// segments. A "table" is any contiguous run of markdown-pipe rows (the
// model is instructed to answer multi-question content this way) — the
// first row is the header, an optional |---|---| separator row is dropped,
// everything else becomes table data.
function parseAiContentSegments(content) {
  const lines = String(content || '').split('\n');
  const segments = [];
  let buffer = [];
  let i = 0;

  const flushText = () => {
    const text = buffer.join('\n').trim();
    if (text) segments.push({ type: 'text', text });
    buffer = [];
  };

  const isTableRow = (line) => /^\s*\|.*\|\s*$/.test(line);
  const isSeparatorRow = (line) => /^\s*\|?[\s:\-|]+\|?\s*$/.test(line);
  const parseRow = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());

  while (i < lines.length) {
    if (isTableRow(lines[i])) {
      const tableLines = [];
      while (i < lines.length && isTableRow(lines[i])) {
        tableLines.push(lines[i]);
        i++;
      }
      flushText();
      if (tableLines.length >= 2) {
        const header = parseRow(tableLines[0]);
        let dataLines = tableLines.slice(1);
        if (dataLines[0] && isSeparatorRow(dataLines[0])) dataLines = dataLines.slice(1);
        const rows = dataLines.map(parseRow);
        segments.push({ type: 'table', header, rows });
      } else {
        segments.push({ type: 'text', text: tableLines.join('\n') });
      }
      continue;
    }
    buffer.push(lines[i]);
    i++;
  }
  flushText();
  return segments;
}

function MarkdownTable({ header, rows, isNightMode }) {
  const borderColor = isNightMode ? '#3a3a3a' : '#e2e8f0';
  const headerBg = isNightMode ? '#2d2d2d' : '#f1f5f9';
  const cellFlex = (idx) => (idx === 0 ? 0.5 : idx === 1 ? 1.4 : 1.8);
  return (
    <View style={{ borderWidth: 1, borderColor, borderRadius: 10, overflow: 'hidden', width: '100%', marginVertical: 4 }}>
      <View style={{ flexDirection: 'row', backgroundColor: headerBg }}>
        {header.map((h, idx) => (
          <Text
            key={idx}
            style={{ flex: cellFlex(idx), fontWeight: '700', fontSize: 12, padding: 8, color: isNightMode ? '#ffffff' : '#0f172a', borderRightWidth: idx < header.length - 1 ? 1 : 0, borderRightColor: borderColor }}
          >
            {h}
          </Text>
        ))}
      </View>
      {rows.map((row, ridx) => (
        <View key={ridx} style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: borderColor }}>
          {row.map((cell, cidx) => (
            <Text
              key={cidx}
              style={{ flex: cellFlex(cidx), fontSize: 12, padding: 8, color: isNightMode ? '#e2e8f0' : '#1e293b', borderRightWidth: cidx < row.length - 1 ? 1 : 0, borderRightColor: borderColor }}
            >
              {cell}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

function ChatBubble({ message, isNightMode }) {
  const isUser = message.role === 'user';
  const segments = message.qaTable
    ? [{ type: 'table', header: ['Sl No', 'Question', 'Answer'], rows: message.qaTable.map((it, idx) => [String(idx + 1), it.question || '', it.answer || '']) }]
    : parseAiContentSegments(message.content);
  const hasTable = segments.some(s => s.type === 'table');

  return (
    <View style={{ alignSelf: isUser ? 'flex-end' : 'flex-start', width: hasTable ? '100%' : undefined, maxWidth: hasTable ? '100%' : '86%', marginBottom: 14 }}>
      <View
        style={{
          backgroundColor: isUser ? '#4f46e5' : (isNightMode ? '#1e1e1e' : '#f1f5f9'),
          borderRadius: 16,
          borderTopRightRadius: isUser ? 4 : 16,
          borderTopLeftRadius: isUser ? 16 : 4,
          padding: 12
        }}
      >
        {segments.map((seg, idx) =>
          seg.type === 'table' ? (
            <MarkdownTable key={idx} header={seg.header} rows={seg.rows} isNightMode={isNightMode} />
          ) : (
            <Text
              key={idx}
              style={{ color: isUser ? '#ffffff' : (isNightMode ? '#e2e8f0' : '#1e293b'), fontSize: 14, lineHeight: 20, marginBottom: idx < segments.length - 1 ? 8 : 0 }}
            >
              {seg.text}
            </Text>
          )
        )}
      </View>
    </View>
  );
}

// --- COGNITIVE CORE LLAMA ASSISTANT — FULL-SCREEN CHAT ---
export default function AiPanel({
  visible,
  isNightMode,
  aiLoading,
  aiMessages,
  aiPrompt,
  setAiPrompt,
  executeCloudAiGatewayRequest,
  setShowAiPanel,
  showAutoAnswerButton,
  triggerAutoAnswer
}) {
  const scrollRef = useRef(null);
  if (!visible) return null;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[layoutStyles.fullscreenSystemOverlayContainerBlock, isNightMode && layoutStyles.nightModeShellBG]}>
      <View style={[layoutStyles.modalSingleHeaderTitleNavbarElementBlock, isNightMode && layoutStyles.nightComponentPanel, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: '#4f46e5', justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
            <ViaIcon type="ai_spark" size={16} color="#ffffff" />
          </View>
          <Text style={[layoutStyles.modalSingleNavbarHeaderHeadlineTitleLabelString, isNightMode && { color: '#ffffff' }]}>AI Assistant</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          {showAutoAnswerButton && (
            <TouchableOpacity
              onPress={triggerAutoAnswer}
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#4f46e5', paddingVertical: 7, paddingHorizontal: 12, borderRadius: 18, gap: 6 }}
            >
              <ViaIcon type="wand" size={14} color="#ffffff" />
              <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 12 }}>Auto Answer</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => setShowAiPanel(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <ViaIcon type="close" size={22} color={isNightMode ? '#ffffff' : '#0f172a'} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1, paddingHorizontal: 14, paddingTop: 14 }}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        keyboardShouldPersistTaps="handled"
      >
        {aiMessages.length === 0 && !aiLoading && (
          <Text style={{ textAlign: 'center', color: '#94a3b8', fontSize: 13, marginTop: 60, paddingHorizontal: 20, lineHeight: 19 }}>
            Kuch bhi puchho, ya kisi page pe "Auto Answer" button use karke us page ke saare sawalon ke jawab ek saath paao.
          </Text>
        )}

        {aiMessages.map((message) => (
          <ChatBubble key={message.id} message={message} isNightMode={isNightMode} />
        ))}

        {aiLoading && (
          <View style={{ alignSelf: 'flex-start', marginBottom: 14 }}>
            <View style={{ backgroundColor: isNightMode ? '#1e1e1e' : '#f1f5f9', borderRadius: 16, borderTopLeftRadius: 4, padding: 12, flexDirection: 'row', alignItems: 'center' }}>
              <ActivityIndicator size="small" color="#4f46e5" />
              <Text style={{ marginLeft: 10, color: isNightMode ? '#94a3b8' : '#64748b', fontSize: 13 }}>Soch raha hai...</Text>
            </View>
          </View>
        )}

        <View style={{ height: 14 }} />
      </ScrollView>

      <View style={layoutStyles.aiEngineInputInteractiveFooterCommandRowControlBlock}>
        <TextInput
          style={[layoutStyles.aiEngineInputControlTextEntryBoxFieldField, isNightMode && { color: '#ffffff', backgroundColor: '#2d2d2d', borderColor: '#444444' }]}
          placeholder="Apna sawal likho..."
          value={aiPrompt}
          onChangeText={setAiPrompt}
          placeholderTextColor="#94a3b8"
          onSubmitEditing={executeCloudAiGatewayRequest}
          returnKeyType="send"
          multiline
        />
        <TouchableOpacity style={layoutStyles.aiEngineSubmitPromptInteractiveActionNodeBtnAsset} onPress={executeCloudAiGatewayRequest}>
          <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 13 }}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
