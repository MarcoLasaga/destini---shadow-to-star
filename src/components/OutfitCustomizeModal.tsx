import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MelMascot, MelSpeechBubble } from './MelMascot';
import Mannequin2D, { MannequinSlot } from './Mannequin2D';
import { GeneratedOutfit, OutfitClothingItem, UserProfile } from '../types';
import { MiniGarmentSvg, resolveGarmentImageUrl } from '../utils/garmentImageHelper';

const SLOT_LABELS: Record<MannequinSlot, string> = {
  TOP: 'Inner Top',
  OUTERWEAR: 'Outerwear',
  BOTTOM: 'Bottom',
  SHOES: 'Shoes',
  ACCESSORIES: 'Accessory',
};

const toSlot = (item: OutfitClothingItem): MannequinSlot => {
  if (item.slotType === 'outerLayer') return 'OUTERWEAR';
  if (item.slotType === 'bottom') return 'BOTTOM';
  if (item.slotType === 'shoes') return 'SHOES';
  if (item.slotType === 'accessory') return 'ACCESSORIES';
  const name = (item.name || '').toLowerCase();
  const cat = (item.category || '').toLowerCase();
  if (/hoodie|jacket|blazer|coat|cardigan|sweatshirt|crewneck|vest|bomber|parka/.test(name) || cat === 'outerwear') {
    return 'OUTERWEAR';
  }
  if (/jean|denim|pant|trouser|chino|short|skirt|cargo/.test(name) || cat === 'bottom') {
    return 'BOTTOM';
  }
  if (/shoe|sneaker|boot|loafer|sandal|slipper|heel|flat/.test(name) || cat === 'shoes') {
    return 'SHOES';
  }
  if (/watch|sunglass|glasses|belt|bag|tote|necklace|chain|airpod/.test(name) || cat === 'accessory' || cat === 'accessories') {
    return 'ACCESSORIES';
  }
  return 'TOP';
};

interface Props {
  visible: boolean;
  outfit: GeneratedOutfit;
  profile?: Partial<UserProfile> | null;
  suggestions: OutfitClothingItem[];
  onClose: () => void;
  onEquip: (item: OutfitClothingItem, slot: MannequinSlot) => void;
}

const CARD_WIDTH = 126;
const CARD_GAP = 10;
const ITEM_TOTAL_WIDTH = CARD_WIDTH + CARD_GAP;
const LOOP_FACTOR = 8;

export default function OutfitCustomizeModal({
  visible,
  outfit,
  profile,
  suggestions,
  onClose,
  onEquip,
}: Props) {
  const [activeSlot, setActiveSlot] = useState<MannequinSlot>('TOP');
  const equipped = outfit.clothingItems || [];
  const activeItem = equipped.find((item) => toSlot(item) === activeSlot);

  // Filter compatible suggestions for this slot
  const slotSuggestions = useMemo(() => {
    return suggestions.filter((item) => toSlot(item) === activeSlot);
  }, [suggestions, activeSlot]);

  // Repeated dataset for true seamless infinite loop
  const loopedData = useMemo(() => {
    if (slotSuggestions.length === 0) return [];
    const arr: { item: OutfitClothingItem; loopKey: string }[] = [];
    for (let loop = 0; loop < LOOP_FACTOR; loop++) {
      slotSuggestions.forEach((it, idx) => {
        arr.push({ item: it, loopKey: `${it.id || 'sug'}-${loop}-${idx}` });
      });
    }
    return arr;
  }, [slotSuggestions]);

  const flatListRef = useRef<FlatList>(null);

  // Jump to middle loop on slot change or visibility
  useEffect(() => {
    if (visible && slotSuggestions.length > 0) {
      const midIndex = Math.floor(LOOP_FACTOR / 2) * slotSuggestions.length;
      setTimeout(() => {
        flatListRef.current?.scrollToOffset({
          offset: midIndex * ITEM_TOTAL_WIDTH,
          animated: false,
        });
      }, 60);
    }
  }, [activeSlot, visible, slotSuggestions.length]);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (slotSuggestions.length === 0) return;
    const offsetX = e.nativeEvent.contentOffset.x;
    const singleSetWidth = slotSuggestions.length * ITEM_TOTAL_WIDTH;
    if (singleSetWidth <= 0) return;

    if (offsetX < singleSetWidth * 1.5) {
      flatListRef.current?.scrollToOffset({
        offset: offsetX + singleSetWidth * 3,
        animated: false,
      });
    } else if (offsetX > singleSetWidth * 5.5) {
      flatListRef.current?.scrollToOffset({
        offset: offsetX - singleSetWidth * 3,
        animated: false,
      });
    }
  };

  const reaction = activeItem
    ? `Your ${activeItem.name.toLowerCase()} gives this look character. Tap any piece below to instantly dress the avatar!`
    : `Your ${SLOT_LABELS[activeSlot].toLowerCase()} slot is ready. Tap any piece below to equip it!`;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Top Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.kicker}>FOCUSED CUSTOMIZATION</Text>
            <Text style={styles.title}>Dress to Impress</Text>
          </View>
          <Pressable onPress={onClose} style={styles.close} accessibilityLabel="Close customizer">
            <Ionicons name="close" size={22} color="#264C3B" />
          </Pressable>
        </View>

        {/* Dedicated Mel Mascot & Speech Bubble Row (Never Overlaps Mannequin or Cards) */}
        <View style={styles.melRow}>
          <MelMascot size={58} outfit="cool_hoodie" />
          <MelSpeechBubble variant="cool_hoodie" message={reaction} position="inline" />
        </View>

        {/* Split Stage: 2D Human Mannequin on Left + Decomposed 5 Slots on Right */}
        <View style={styles.split}>
          <View style={styles.mannequinPane}>
            <Mannequin2D
              profile={profile}
              items={equipped}
              activeSlot={activeSlot}
              onSelectSlot={setActiveSlot}
            />
          </View>

          <ScrollView style={styles.slotPane} contentContainerStyle={styles.slotContent} showsVerticalScrollIndicator={false}>
            {(['TOP', 'OUTERWEAR', 'BOTTOM', 'SHOES', 'ACCESSORIES'] as MannequinSlot[]).map((slot) => {
              const item = equipped.find((entry) => toSlot(entry) === slot);
              const isSelected = activeSlot === slot;
              const imgUrl = resolveGarmentImageUrl(item);
              const isDataset = item?.isSuggested || (item?.id && item.id.startsWith('dataset-'));

              return (
                <Pressable
                  key={slot}
                  onPress={() => setActiveSlot(slot)}
                  style={[styles.slotCard, isSelected && styles.slotCardActive]}
                >
                  <View style={styles.slotCardHeader}>
                    <Text style={[styles.slotLabel, isSelected && styles.slotLabelActive]}>
                      {SLOT_LABELS[slot]}
                    </Text>
                    {item && (
                      <View
                        style={[
                          styles.slotColorDot,
                          { backgroundColor: item.hexColor || item.primaryColor || '#4B1D6F' },
                        ]}
                      />
                    )}
                  </View>

                  <View style={styles.slotBodyRow}>
                    <View style={styles.slotThumbnail}>
                      {imgUrl ? (
                        <Image source={{ uri: imgUrl }} style={styles.thumbImage} resizeMode="contain" />
                      ) : (
                        <MiniGarmentSvg
                          slot={slot}
                          name={item?.name || ''}
                          color={item?.hexColor || item?.primaryColor || '#8BAA82'}
                          size={38}
                        />
                      )}
                    </View>

                    <View style={styles.slotDetails}>
                      <Text style={styles.slotName} numberOfLines={2}>
                        {item?.name || 'Empty slot'}
                      </Text>
                      <Text style={[styles.slotSource, isDataset && styles.datasetSourceText]}>
                        {item ? (isDataset ? 'Dataset Catalog' : 'My Wardrobe') : 'Tap to add'}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Bottom Drawer: Style Suggestions with Horizontal Infinite-Loop FlatList */}
        <View style={styles.drawer}>
          <View style={styles.drawerHeader}>
            <View>
              <Text style={styles.drawerTitle}>
                Style Suggestions · {SLOT_LABELS[activeSlot]}
              </Text>
              <Text style={styles.drawerHint}>
                Swipe infinitely · Tap any card to equip on your 2D mannequin
              </Text>
            </View>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{slotSuggestions.length} options</Text>
            </View>
          </View>

          {slotSuggestions.length === 0 ? (
            <View style={styles.emptySuggestions}>
              <Text style={styles.emptyText}>No suggestions available for this slot.</Text>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              horizontal
              data={loopedData}
              keyExtractor={(entry) => entry.loopKey}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.suggestionRow}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              getItemLayout={(_, index) => ({
                length: ITEM_TOTAL_WIDTH,
                offset: ITEM_TOTAL_WIDTH * index,
                index,
              })}
              renderItem={({ item: entry }) => {
                const item = entry.item;
                const imageUrl = resolveGarmentImageUrl(item);
                const isDataset = item.isSuggested || (item.id && item.id.startsWith('dataset-'));
                const isEquipped = equipped.some((eq) => eq.id === item.id);

                return (
                  <Pressable
                    onPress={() => onEquip(item, activeSlot)}
                    style={[styles.suggestionCard, isEquipped && styles.suggestionCardEquipped]}
                  >
                    {/* Real Garment Photo or Miniature 2D Vector SVG (NEVER a black sparkle box) */}
                    <View style={styles.previewBox}>
                      {imageUrl ? (
                        <Image source={{ uri: imageUrl }} style={styles.garmentPhoto} resizeMode="contain" />
                      ) : (
                        <MiniGarmentSvg
                          slot={activeSlot}
                          name={item.name}
                          color={item.hexColor || item.primaryColor || item.color}
                          secondaryColor={item.secondaryColor}
                          size={54}
                        />
                      )}

                      {/* CIELAB Color Swatch Dot */}
                      <View
                        style={[
                          styles.colorDotBadge,
                          { backgroundColor: item.hexColor || item.primaryColor || '#3B414B' },
                        ]}
                      />

                      {isEquipped && (
                        <View style={styles.equippedBadge}>
                          <Text style={styles.equippedBadgeText}>Equipped</Text>
                        </View>
                      )}
                    </View>

                    {/* Garment Title */}
                    <Text style={styles.suggestionName} numberOfLines={2}>
                      {item.name}
                    </Text>

                    {/* Source Badge: My Wardrobe vs Dataset Catalog */}
                    <View
                      style={[
                        styles.sourcePill,
                        isDataset ? styles.sourcePillDataset : styles.sourcePillWardrobe,
                      ]}
                    >
                      <Text
                        style={[
                          styles.sourcePillText,
                          isDataset ? styles.sourcePillTextDataset : styles.sourcePillTextWardrobe,
                        ]}
                      >
                        {isDataset ? 'Dataset Catalog' : 'My Wardrobe'}
                      </Text>
                    </View>
                  </Pressable>
                );
              }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF8F2',
    paddingTop: 50,
  },
  header: {
    paddingHorizontal: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  kicker: {
    color: '#4D9A65',
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 1.3,
  },
  title: {
    color: '#264C3B',
    fontSize: 24,
    fontWeight: '900',
    marginTop: 2,
  },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EAF3D9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  melRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
    marginTop: 8,
    marginHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E1E6DB',
    shadowColor: '#264C3B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  split: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: 14,
    gap: 8,
  },
  mannequinPane: {
    flex: 1.18,
    justifyContent: 'center',
    backgroundColor: '#F3F6EC',
    borderRadius: 18,
    overflow: 'hidden',
    paddingVertical: 4,
  },
  slotPane: {
    flex: 0.82,
  },
  slotContent: {
    gap: 7,
    paddingBottom: 10,
  },
  slotCard: {
    borderWidth: 1.5,
    borderColor: '#DCE1D6',
    borderRadius: 13,
    padding: 9,
    backgroundColor: '#FFFFFF',
    minHeight: 68,
  },
  slotCardActive: {
    borderColor: '#F07E57',
    backgroundColor: '#FFF4EE',
  },
  slotCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  slotLabel: {
    color: '#4D9A65',
    fontSize: 9.5,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  slotLabelActive: {
    color: '#F07E57',
  },
  slotColorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  slotBodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  slotThumbnail: {
    width: 38,
    height: 38,
    borderRadius: 7,
    backgroundColor: '#F4F7EF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  slotDetails: {
    flex: 1,
  },
  slotName: {
    color: '#264C3B',
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: '800',
  },
  slotSource: {
    color: '#7D8B81',
    fontSize: 9,
    marginTop: 2,
  },
  datasetSourceText: {
    color: '#5554B8',
  },
  drawer: {
    borderTopWidth: 1,
    borderTopColor: '#E2E6DC',
    backgroundColor: '#FFFFFF',
    paddingTop: 12,
    paddingBottom: 22,
  },
  drawerHeader: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  drawerTitle: {
    color: '#264C3B',
    fontSize: 14.5,
    fontWeight: '900',
  },
  drawerHint: {
    color: '#7B887E',
    fontSize: 10.5,
    marginTop: 2,
  },
  countBadge: {
    backgroundColor: '#EAF3D9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  countText: {
    color: '#264C3B',
    fontSize: 10,
    fontWeight: '800',
  },
  suggestionRow: {
    paddingHorizontal: 16,
    gap: CARD_GAP,
  },
  suggestionCard: {
    width: CARD_WIDTH,
    borderWidth: 1.5,
    borderColor: '#DCE1D6',
    borderRadius: 14,
    padding: 8,
    backgroundColor: '#FCFAF5',
  },
  suggestionCardEquipped: {
    borderColor: '#4D9A65',
    backgroundColor: '#F0F7EB',
  },
  previewBox: {
    height: 72,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E7EBE1',
  },
  garmentPhoto: {
    width: '88%',
    height: '88%',
  },
  colorDotBadge: {
    position: 'absolute',
    top: 5,
    left: 5,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  equippedBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: '#4D9A65',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
  },
  equippedBadgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '800',
  },
  suggestionName: {
    color: '#264C3B',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    minHeight: 28,
  },
  sourcePill: {
    marginTop: 5,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  sourcePillWardrobe: {
    backgroundColor: '#EAF3D9',
  },
  sourcePillDataset: {
    backgroundColor: '#EDEBF9',
  },
  sourcePillText: {
    fontSize: 8.5,
    fontWeight: '800',
  },
  sourcePillTextWardrobe: {
    color: '#2E5B3E',
  },
  sourcePillTextDataset: {
    color: '#4B3AA6',
  },
  emptySuggestions: {
    paddingVertical: 28,
    alignItems: 'center',
  },
  emptyText: {
    color: '#7B887E',
    fontSize: 12,
  },
});
