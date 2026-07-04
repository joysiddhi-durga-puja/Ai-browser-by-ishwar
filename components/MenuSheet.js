import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Animated } from 'react-native';
import ViaIcon from '../ViaIcon';
import layoutStyles, { SCREEN_WIDTH } from '../styles';

// --- HORIZONTAL SYMMETRIC GRID SHEET ---
// actionItemsSchema is the full 12-item list built in App.js (it depends on
// many state setters), split here into two pages of icons.
export default function MenuSheet({ isMenuVisible, isNightMode, slideAnimation, actionItemsSchema }) {
  if (!isMenuVisible) return null;

  const primarySlideCollection = actionItemsSchema.slice(0, 8);
  const secondarySlideCollection = actionItemsSchema.slice(8, 12);

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
    <Animated.View style={[layoutStyles.menuSheetStructureAbsoluteWrapper, isNightMode && layoutStyles.nightComponentPanel, { transform: [{ translateY: slideAnimation }] }]}>
      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} snapToInterval={SCREEN_WIDTH} decelerationRate="fast">
        {/* SLIDE 1: Via Clean Minimalist Vector Assets Grid */}
        <View style={[layoutStyles.paginatedSlideRenderContainerPage, { width: SCREEN_WIDTH }]}>
          <View style={layoutStyles.symmetricMatrixBalancedFlexGridRow}>
            {primarySlideCollection.map(renderGridItem)}
          </View>
        </View>

        {/* SLIDE 2: Remainder Workspace Nodes Expansion */}
        <View style={[layoutStyles.paginatedSlideRenderContainerPage, { width: SCREEN_WIDTH }]}>
          <View style={layoutStyles.symmetricMatrixBalancedFlexGridRowAlternativeGapLayout}>
            {secondarySlideCollection.map(renderGridItem)}
          </View>
        </View>
      </ScrollView>

      <View style={layoutStyles.sliderProgressBulletTrackBarRow}>
        <View style={layoutStyles.bulletNodeIndicatorActive} />
        <View style={layoutStyles.bulletNodeIndicatorInactive} />
      </View>
    </Animated.View>
  );
}
