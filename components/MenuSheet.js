import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Animated } from 'react-native';
import ViaIcon from '../ViaIcon';
import layoutStyles, { SCREEN_WIDTH } from '../styles';

// --- HORIZONTAL SYMMETRIC GRID SHEET ---
// actionItemsSchema is the full 12-item list built in App.js (it depends on
// many state setters), split here into two pages of icons.
// onRequestClose fires when the user taps anywhere outside the sheet.
export default function MenuSheet({ isMenuVisible, isNightMode, slideAnimation, actionItemsSchema, onRequestClose }) {
  if (!isMenuVisible) return null;

  // Dynamic pagination: first page holds 8 icons in the symmetric grid,
  // every following page holds the remainder (wraps naturally as new
  // action items get added later without needing to touch this file).
  const ITEMS_PER_PAGE = 8;
  const pages = [];
  for (let i = 0; i < actionItemsSchema.length; i += ITEMS_PER_PAGE) {
    pages.push(actionItemsSchema.slice(i, i + ITEMS_PER_PAGE));
  }

  const renderGridItem = (gridItemNode) => (
    <TouchableOpacity key={gridItemNode.id} style={layoutStyles.interactiveCellGridBlockItem} onPress={gridItemNode.action}>
      <View style={[
        layoutStyles.emojiAssetContainerPlateBox,
        isNightMode && { backgroundColor: '#333333', borderColor: '#444' },
        gridItemNode.isActive && layoutStyles.blueHighlightedIconPlateBg
      ]}>
        <ViaIcon type={gridItemNode.iconType} color={gridItemNode.isActive ? '#4f46e5' : (isNightMode ? '#aaa' : '#475569')} size={22} />
      </View>
      <Text style={[
        layoutStyles.gridLabelTextStringDescription,
        isNightMode && { color: '#cccccc' },
        gridItemNode.isActive && layoutStyles.blueHighlightedTextLabel
      ]} numberOfLines={1}>
        {gridItemNode.label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={layoutStyles.menuSheetBackdrop} pointerEvents="box-none">
      <TouchableOpacity style={layoutStyles.menuSheetBackdropTouchable} activeOpacity={1} onPress={onRequestClose} />
      <Animated.View style={[layoutStyles.menuSheetStructureAbsoluteWrapper, isNightMode && layoutStyles.nightComponentPanel, { transform: [{ translateY: slideAnimation }] }]}>
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} snapToInterval={SCREEN_WIDTH} decelerationRate="fast">
          {pages.map((pageItems, pageIndex) => (
            <View key={pageIndex} style={[layoutStyles.paginatedSlideRenderContainerPage, { width: SCREEN_WIDTH }]}>
              <View style={pageIndex === 0 ? layoutStyles.symmetricMatrixBalancedFlexGridRow : layoutStyles.symmetricMatrixBalancedFlexGridRowAlternativeGapLayout}>
                {pageItems.map(renderGridItem)}
              </View>
            </View>
          ))}
        </ScrollView>

        <View style={layoutStyles.sliderProgressBulletTrackBarRow}>
          {pages.map((_, pageIndex) => (
            <View key={pageIndex} style={pageIndex === 0 ? layoutStyles.bulletNodeIndicatorActive : layoutStyles.bulletNodeIndicatorInactive} />
          ))}
        </View>
      </Animated.View>
    </View>
  );
}
