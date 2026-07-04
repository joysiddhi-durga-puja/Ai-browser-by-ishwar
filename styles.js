import { StyleSheet, Dimensions, Platform } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
export { SCREEN_WIDTH, SCREEN_HEIGHT };

// ============================================================================
// SYSTEM PRODUCTION MINIMAL SPECIFICATION DESIGN STYLESHEET
// ============================================================================
const layoutStyles = StyleSheet.create({
  appShell: { flex: 1, backgroundColor: '#f8fafc' },
  nightModeShellBG: { backgroundColor: '#121212' },
  nightComponentPanel: { backgroundColor: '#1e1e1e', borderBottomColor: '#2d2d2d', borderTopColor: '#2d2d2d' },
  nightModeWebViewBg: { backgroundColor: '#121212' },

  navbarContainerPanel: { height: 65, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, backgroundColor: '#ffffff', gap: 10, paddingTop: 5 },
  navbarIconButtonAsset: { width: 42, height: 42, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f1f5f9', borderRadius: 21 },
  inputAreaWrapperField: { flex: 1, height: 42, backgroundColor: '#f1f5f9', borderRadius: 21, paddingHorizontal: 16, justifyContent: 'center', position: 'relative', overflow: 'hidden' },
  inputFieldCoreElement: { flex: 1, fontSize: 14, color: '#1e293b', paddingVertical: 0 },
  loadingTrackProgress: { position: 'absolute', bottom: 0, left: 0, height: 3, backgroundColor: '#4f46e5' },
  tabsNumberIndicatorBadge: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: '#475569', justifyContent: 'center', alignItems: 'center' },
  tabsCounterTextString: { fontSize: 12, fontWeight: '800', color: '#475569' },

  webviewCoreLayoutContainerBody: { flex: 1, backgroundColor: '#cbd5e1' },
  webviewFrameStructuralContainer: { flex: 1 },

  floatingAssistantInteractiveActionCircleNode: { position: 'absolute', right: 24, bottom: 80, width: 60, height: 60, justifyContent: 'center', alignItems: 'center', zIndex: 99999 },
  globalFloatingToastContainerBox: { position: 'absolute', bottom: 120, left: SCREEN_WIDTH * 0.15, right: SCREEN_WIDTH * 0.15, backgroundColor: 'rgba(45, 55, 72, 0.94)', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 25, zIndex: 9999999, elevation: 12 },
  globalToastMessageTextLabel: { color: '#ffffff', fontSize: 14, fontWeight: '600', textAlign: 'center' },

  dockActionToolbarSystemPanel: { height: 56, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', backgroundColor: '#ffffff', borderTopWidth: 1, borderTopColor: '#e2e8f0', zIndex: 999 },
  dockEmojiControlLabel: { fontSize: 24, color: '#334155' },
  dockControlAssetDisabledState: { color: '#cbd5e1' },

  menuSheetBackdrop: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, zIndex: 99998, elevation: 23 },
  menuSheetBackdropTouchable: { flex: 1, backgroundColor: 'transparent' },
  menuSheetStructureAbsoluteWrapper: { backgroundColor: '#ffffff', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingVertical: 20, position: 'absolute', bottom: 56, left: 0, right: 0, elevation: 24, zIndex: 99999, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  paginatedSlideRenderContainerPage: { paddingHorizontal: 20 },
  symmetricMatrixBalancedFlexGridRow: { flexDirection: 'row', flexWrap: 'wrap', width: '100%', justifyContent: 'space-between' },
  symmetricMatrixBalancedFlexGridRowAlternativeGapLayout: { flexDirection: 'row', flexWrap: 'wrap', width: '100%', justifyContent: 'flex-start', gap: 14 },
  interactiveCellGridBlockItem: { width: '22%', alignItems: 'center', marginVertical: 12 },
  emojiAssetContainerPlateBox: { width: 52, height: 52, borderRadius: 16, backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center', marginBottom: 8, borderWidth: 1, borderColor: '#f1f5f9' },
  gridLabelTextStringDescription: { fontSize: 11, color: '#64748b', fontWeight: '600', textAlign: 'center' },
  sliderProgressBulletTrackBarRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 14 },
  bulletNodeIndicatorActive: { width: 16, height: 6, borderRadius: 3, backgroundColor: '#4f46e5', marginHorizontal: 3 },
  bulletNodeIndicatorInactive: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#cbd5e1', marginHorizontal: 3 },

  blueHighlightedIconPlateBg: { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' },
  blueHighlightedTextLabel: { color: '#3b82f6', fontWeight: '700' },

  fullscreenSystemOverlayContainerBlock: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: '#ffffff', zIndex: 999999, justifyContent: 'space-between' },
  overlayNavbarHeaderDashboardPanel: { height: 70, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingTop: 15 },
  overlayHeaderTitleTextString: { fontSize: 18, fontWeight: '800', color: '#1e293b' },
  createNewWorkspaceActionTextButtonAsset: { backgroundColor: '#4f46e5', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  closeFullscreenSystemOverlayBtnFooter: { height: 58, backgroundColor: '#4f46e5', justifyContent: 'center', alignItems: 'center' },
  closeSystemFooterBtnLabelString: { color: '#ffffff', fontWeight: '700', fontSize: 16 },

  workspaceItemCardGridPlate: { flex: 0.5, height: 140, backgroundColor: '#f8fafc', margin: 8, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#e2e8f0', justifyContent: 'space-between' },
  activeWorkspaceBorderTrackColorIndicator: { borderColor: '#4f46e5', borderWidth: 2.5 },
  workspaceItemCardHeaderFlexBlockRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  workspaceCardTitleTextStringLabel: { fontSize: 14, fontWeight: '700', color: '#334155', flex: 1, marginRight: 6 },
  workspaceCardCloseInteractiveNodeAsset: { padding: 4 },
  workspaceCardInteractiveClickAreaContainer: { flex: 1, paddingTop: 10 },
  workspaceCardContentUrlTextStringDescription: { fontSize: 11, color: '#64748b', lineHeight: 15 },

  modalTwinSubTabsHeaderNavigationBarFlexRow: { flexDirection: 'row', height: 65, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', backgroundColor: '#f8fafc', paddingTop: 15 },
  modalTabSelectorItemBtnElement: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  modalTabSelectorItemBtnElementActiveBorderBorder: { borderBottomWidth: 3, borderBottomColor: '#4f46e5' },
  modalSubTabLabelTextAssetString: { fontSize: 16, fontWeight: '700', color: '#64748b' },
  modalSubTabLabelTextAssetStringActiveTextMode: { color: '#4f46e5' },
  modalScrollBodyCoreRenderingContentAreaScrollLayout: { flex: 1, paddingHorizontal: 18, paddingTop: 10 },
  emptyStateIllustrationTextStringLabel: { textAlign: 'center', color: '#94a3b8', marginTop: 60, fontSize: 14, fontWeight: '500' },
  actionButtonTriggerWipeOperationsHandler: { padding: 14, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', marginBottom: 10 },

  dataRowRecordInteractiveListItemLogsBlock: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  dataRowRecordPrimaryHeadlineTitleLabelText: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  dataRowRecordSecondaryUrlDescriptionText: { fontSize: 12, color: '#94a3b8', marginTop: 4, lineHeight: 16 },

  modalSingleHeaderTitleNavbarElementBlock: { height: 70, justifyContent: 'center', paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingTop: 15 },
  modalSingleNavbarHeaderHeadlineTitleLabelString: { fontSize: 19, fontWeight: '800', color: '#1e293b' },

  settingsMenuInnerOperationalContainerLayoutSectionBlock: { flex: 1, paddingHorizontal: 18, paddingTop: 12 },
  settingsPanelInteractiveToggleConfigurationRowItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  settingsToggleItemPrimaryHeadlineLabelTextString: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  settingsToggleItemSecondarySubDescriptionTextString: { fontSize: 13, color: '#64748b', marginTop: 3, lineHeight: 17 },

  settingsSectionBlockPadded: { paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  settingsSectionHeaderTextString: { fontSize: 13, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 20, marginBottom: 4 },
  settingsApiKeyInputField: { marginTop: 12, height: 46, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, paddingHorizontal: 14, color: '#1e293b', backgroundColor: '#ffffff', fontSize: 14 },
  settingsModelChipRowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  settingsModelChipItem: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
  settingsModelChipItemActive: { backgroundColor: '#eff6ff', borderColor: '#4f46e5' },
  settingsModelChipLabelText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  settingsModelChipLabelTextActive: { color: '#4f46e5', fontWeight: '700' },
  settingsSaveAiConfigButton: { marginTop: 20, marginBottom: 30, height: 48, borderRadius: 12, backgroundColor: '#4f46e5', justifyContent: 'center', alignItems: 'center' },

  aiEnginePanelBackdrop: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, zIndex: 99999998, elevation: 23 },
  aiEnginePanelBackdropTouchable: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.35)' },
  aiEngineFloatingPanelBottomSheetResponseContainerBlockBox: { position: 'absolute', bottom: 0, left: 0, right: 0, height: SCREEN_HEIGHT * 0.68, backgroundColor: '#ffffff', borderTopLeftRadius: 28, borderTopRightRadius: 28, elevation: 24, zIndex: 99999999, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  aiEnginePanelHeaderRowTitleBarActionsLayoutFlexBlock: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  aiEngineHeadlineTitleStringLabelText: { fontSize: 16, fontWeight: '800', color: '#1e293b' },
  aiEngineCloseActionAnchorInteractNode: { padding: 4 },
  aiEngineLoaderIndicatorCentralSpinnerWrapperContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 },
  aiEngineOutputMarkdownResponseContentStringProseBody: { fontSize: 15, color: '#334155', lineHeight: 24, fontWeight: '400' },
  aiEngineInputInteractiveFooterCommandRowControlBlock: { flexDirection: 'row', padding: 14, borderTopWidth: 1, borderTopColor: '#e2e8f0', gap: 10, alignItems: 'center', backgroundColor: '#f8fafc', paddingBottom: Platform.OS === 'ios' ? 24 : 14 },
  aiEngineInputControlTextEntryBoxFieldField: { flex: 1, height: 42, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 21, paddingHorizontal: 16, color: '#1e293b', backgroundColor: '#ffffff', fontSize: 14 },
  aiEngineSubmitPromptInteractiveActionNodeBtnAsset: { backgroundColor: '#4f46e5', paddingHorizontal: 20, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' },

  // --- Homepage screen + inline navbar search ---
  homeNavbarLabelRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  homeNavbarLabelText: { flex: 1, fontSize: 15, fontWeight: '600', color: '#334155' },
  homeNavbarInlineSearchInput: { flex: 1, fontSize: 14, color: '#1e293b', paddingVertical: 0, marginLeft: 10 },

  homeScreenCenterContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff', paddingHorizontal: 40 },
  homeScreenLogoImage: { width: 96, height: 96, marginBottom: 28 },
  homeScreenCenterSearchPill: { width: '100%', height: 50, borderRadius: 25, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#ffffff' },
  homeScreenCenterSearchPillNight: { borderColor: '#333333', backgroundColor: '#1e1e1e' },

  // --- History & Bookmarks right-side slide-in panel ---
  historyPanelBackdrop: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, flexDirection: 'row', zIndex: 999999 },
  historyPanelBackdropTouchable: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.35)' },
  historyPanelSlideContainer: { width: '88%', maxWidth: 420, height: '100%', backgroundColor: '#ffffff', elevation: 24, shadowColor: '#000', shadowOffset: { width: -2, height: 0 }, shadowOpacity: 0.15, shadowRadius: 10 },
  historyPanelHeaderRow: { flexDirection: 'row', alignItems: 'center', height: 70, paddingHorizontal: 10, paddingTop: 15, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', backgroundColor: '#ffffff' },
  historyPanelBackBtn: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' },
  historyPanelTabsRow: { flex: 1, flexDirection: 'row' },
  historyPanelTabBtn: { paddingHorizontal: 16, paddingVertical: 8, marginRight: 6 },
  historyPanelTabBtnActive: { borderBottomWidth: 3, borderBottomColor: '#4f46e5' },
  historyPanelTabLabel: { fontSize: 15, fontWeight: '700', color: '#94a3b8' },
  historyPanelTabLabelActive: { color: '#1e293b' },
  historyPanelSearchWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', borderRadius: 22, marginHorizontal: 16, marginTop: 14, marginBottom: 6, height: 42, paddingHorizontal: 14, gap: 8 },
  historyPanelSearchInput: { flex: 1, fontSize: 14, color: '#1e293b', paddingVertical: 0 },
  historyPanelDateHeader: { fontSize: 13, fontWeight: '700', color: '#94a3b8', marginTop: 16, marginBottom: 6 },
  historyPanelRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  historyPanelRowTextCol: { flex: 1 },
  historyPanelFooterRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 18, paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#e2e8f0', backgroundColor: '#ffffff' },
  historyPanelFooterDeleteText: { color: '#ef4444', fontWeight: '700', fontSize: 14 },

  // --- Downloads panel (shares the historyPanel* container/header styles) ---
  downloadPanelTitleRow: { flex: 1, justifyContent: 'center' },
  downloadPanelTitleText: { fontSize: 18, fontWeight: '800', color: '#1e293b' },
  downloadRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  downloadRowIconPlate: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#eef2ff', justifyContent: 'center', alignItems: 'center' },
  downloadRowTextCol: { flex: 1 },
  downloadRowNameText: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  downloadRowMetaText: { fontSize: 12, color: '#94a3b8', marginTop: 3 },
  downloadRowMetaTextFailed: { color: '#ef4444', fontWeight: '600' },
  downloadProgressTrack: { height: 5, borderRadius: 3, backgroundColor: '#e2e8f0', marginTop: 8, overflow: 'hidden' },
  downloadProgressFill: { height: 5, borderRadius: 3, backgroundColor: '#4f46e5' },
  downloadRowDeleteBtn: { padding: 8 }
});

export default layoutStyles;
