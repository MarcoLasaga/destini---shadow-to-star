import React, { useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../hooks/useAppTheme';
import {
  CanonicalStudioGarmentSvg,
  formatSubtypeLabel,
  inferVectorSubtype,
  resolveGarmentImageUrl,
} from '../utils/garmentImageHelper';
import { resolveDatasetGarmentPhoto } from '../data/datasetGarmentCatalog';
import { colorNameToHex, normalizeHexCode } from '../services/outfitRecommendationService';

export interface AltaCollageItem {
  id?: string;
  name?: string;
  clothing_name?: string;
  category?: string;
  subCategory?: string;
  sub_category?: string;
  vector_subtype?: string;
  slotType?: string;
  layerRole?: string;
  layer_role?: string;
  image?: string;
  image_url?: string;
  imageUri?: string;
  cutoutUri?: string | null;
  cutoutDataUri?: string | null;
  beautifiedUri?: string | null;
  beautifiedDataUri?: string | null;
  color?: string;
  primary_color?: string;
  primaryColor?: string;
  colorHex?: string;
  hexColor?: string;
  secondary_color?: string;
  secondaryColor?: string;
  secondary_color_hex?: string | null;
  color_harmony_note?: string | null;
  palette?: any;
}

interface AltaOutfitCollageProps {
  items: AltaCollageItem[];
  compact?: boolean;
  interactive?: boolean;
  paginationIndex?: number;
  paginationCount?: number;
  onSelectPagination?: (idx: number) => void;
  onSelectItem?: (item: AltaCollageItem) => void;
}

type CollageSlotKey = 'TOP' | 'OUTERWEAR' | 'BOTTOM' | 'SHOES' | 'ACCESSORIES';

function classifyCollageSlot(item: AltaCollageItem): CollageSlotKey {
  const n = (
    item.name ||
    item.clothing_name ||
    item.subCategory ||
    item.sub_category ||
    ''
  )
    .toLowerCase()
    .trim();

  // 1. Name-first anatomical healing so "Tank Top", "Short-sleeve Top", "T-Shirt", "Shirt", "Polo", "Singlet"
  // ALWAYS resolve to 'TOP' (even if saved category in DB was accidentally "Bottoms"),
  // and "Jeans", "Pants", "Shorts", "Trousers" ALWAYS resolve to 'BOTTOM'.
  if (/\b(jacket|blazer|coat|cardigan|windbreaker|hoodie|parka|trench|bomber)\b/i.test(n)) {
    return 'OUTERWEAR';
  }
  if (
    /\b(top|tank|t-shirt|tshirt|tee|shirt|polo|singlet|blouse|crewneck|henley|camisole|halter|sleeveless|short-sleeve|long-sleeve)\b/i.test(
      n
    )
  ) {
    return 'TOP';
  }
  if (
    /\b(jeans|jean|denim|chino|chinos|trouser|trousers|pant|pants|slack|slacks|short|shorts|skirt|legging|leggings|jogger|joggers|sweatpants|cargo)\b/i.test(
      n
    )
  ) {
    return 'BOTTOM';
  }
  if (
    /\b(shoe|shoes|sneaker|sneakers|loafer|loafers|boot|boots|sandal|sandals|slipper|slippers|slide|heel|heels|flat|flats|trainer|trainers|running\s*shoes)\b/i.test(
      n
    )
  ) {
    return 'SHOES';
  }
  if (
    /\b(watch|wristwatch|smartwatch|bag|tote|belt|cap|hat|beanie|glasses|sunglasses|necklace|ring|bracelet|earring|scarf|tie|necktie|wallet|backpack|purse)\b/i.test(
      n
    )
  ) {
    return 'ACCESSORIES';
  }

  // 2. Fallback to explicit role / slotType / category when name has no garment keyword
  const role = (item.layerRole || item.layer_role || '').toUpperCase().trim();
  if (role === 'INNER_BASE') return 'TOP';
  if (role === 'OUTER_LAYER') return 'OUTERWEAR';
  if (role === 'LOWER_BODY') return 'BOTTOM';
  if (role === 'FOOTWEAR') return 'SHOES';
  if (role === 'ACCESSORY') return 'ACCESSORIES';

  const slot = (item.slotType || '').toLowerCase();
  if (slot === 'outerlayer') return 'OUTERWEAR';
  if (slot === 'innertop') return 'TOP';
  if (slot === 'bottom') return 'BOTTOM';
  if (slot === 'shoes') return 'SHOES';
  if (slot === 'accessory') return 'ACCESSORIES';

  const cat = (item.category || '').toUpperCase().trim();
  if (cat.startsWith('OUTER')) return 'OUTERWEAR';
  if (cat.startsWith('BOTTOM') || cat === 'PANTS' || cat === 'JEANS') return 'BOTTOM';
  if (cat.startsWith('SHOE') || cat === 'FOOTWEAR') return 'SHOES';
  if (cat.startsWith('ACCESSOR')) return 'ACCESSORIES';
  return 'TOP';
}

function resolveDisplayUri(item: AltaCollageItem): string | null {
  const direct =
    item.beautifiedDataUri ||
    item.cutoutDataUri ||
    item.beautifiedUri ||
    item.cutoutUri ||
    resolveGarmentImageUrl(item);

  if (direct && !direct.startsWith('illustration://')) {
    return direct;
  }

  const itemName = item.name || item.clothing_name || 'Garment';
  const itemCat = item.category || 'Tops';
  const fallback = resolveDatasetGarmentPhoto(itemName, itemCat, item.image || item.image_url);
  if (fallback && !fallback.startsWith('illustration://')) {
    return fallback;
  }
  return null;
}

export default function AltaOutfitCollage({
  items = [],
  compact = false,
  interactive = true,
  paginationIndex,
  paginationCount,
  onSelectPagination,
  onSelectItem,
}: AltaOutfitCollageProps) {
  const theme = useAppTheme();
  const isDark = theme.mode === 'dark';
  const [selectedItem, setSelectedItem] = useState<AltaCollageItem | null>(null);
  const [failedUris, setFailedUris] = useState<Record<string, boolean>>({});

  const grouped = useMemo(() => {
    let top: AltaCollageItem | null = null;
    let outerwear: AltaCollageItem | null = null;
    let bottom: AltaCollageItem | null = null;
    let shoes: AltaCollageItem | null = null;
    const accessories: AltaCollageItem[] = [];

    for (const item of items) {
      const slot = classifyCollageSlot(item);
      if (slot === 'TOP' && !top) {
        top = item;
      } else if (slot === 'OUTERWEAR' && !outerwear) {
        outerwear = item;
      } else if (slot === 'BOTTOM' && !bottom) {
        bottom = item;
      } else if (slot === 'SHOES' && !shoes) {
        shoes = item;
      } else if (slot === 'ACCESSORIES') {
        accessories.push(item);
      } else if (!top) {
        top = item;
      } else if (!outerwear) {
        outerwear = item;
      }
    }

    return { top, outerwear, bottom, shoes, accessories };
  }, [items]);

  const handleTapPiece = (piece: AltaCollageItem | null) => {
    if (!piece) return;
    if (onSelectItem) {
      onSelectItem(piece);
    }
    if (!interactive) return;
    setSelectedItem((prev) =>
      prev && (prev.id || prev.name) === (piece.id || piece.name) ? null : piece
    );
  };

  // Render clean borderless cutout inside the single unified #FFFFFF studio container
  const renderFlatLayCutout = (
    piece: AltaCollageItem | null,
    flexWeight: number,
    slotOverride?: CollageSlotKey,
    keySuffix = 'cutout',
    extraStyle?: any
  ) => {
    if (!piece) return null;
    const slotKey = slotOverride || classifyCollageSlot(piece);
    const uri = resolveDisplayUri(piece);
    const itemKey = String(piece.id || piece.name || piece.clothing_name || keySuffix);
    const hasValidUri = Boolean(uri && !failedUris[itemKey]);
    const displayName = piece.name || piece.clothing_name || 'Garment';
    const primaryColorName =
      piece.primary_color ||
      piece.color ||
      piece.primaryColor ||
      (Array.isArray(piece.palette) && piece.palette[0]?.color_name) ||
      'Black';
    const primaryHex =
      piece.colorHex ||
      piece.hexColor ||
      (Array.isArray(piece.palette) && piece.palette[0]?.hex_code) ||
      colorNameToHex(primaryColorName);
    const secondaryHex =
      piece.secondary_color_hex ||
      (Array.isArray(piece.palette) && piece.palette[1]?.hex_code) ||
      (piece.secondary_color ? colorNameToHex(piece.secondary_color) : undefined);

    const isSelected =
      interactive &&
      selectedItem &&
      (selectedItem.id || selectedItem.name) === (piece.id || piece.name);

    const Wrapper = interactive ? Pressable : View;

    return (
      <Wrapper
        key={itemKey}
        onPress={interactive ? () => handleTapPiece(piece) : undefined}
        accessibilityLabel={`Inspect ${displayName}`}
        style={[
          styles.cutoutSlot,
          {
            flex: flexWeight,
            backgroundColor: isSelected ? 'rgba(54, 69, 54, 0.06)' : 'transparent',
            borderColor: isSelected ? 'rgba(54, 69, 54, 0.28)' : 'transparent',
            borderWidth: isSelected ? 1.5 : 0,
            borderRadius: 12,
          },
          extraStyle,
        ]}
      >
        {hasValidUri && uri ? (
          <Image
            source={{ uri }}
            style={styles.cutoutImage}
            resizeMode="contain"
            onError={() =>
              setFailedUris((prev) => ({
                ...prev,
                [itemKey]: true,
              }))
            }
          />
        ) : (
          <CanonicalStudioGarmentSvg
            name={displayName}
            category={piece.category || slotKey}
            vectorSubtype={piece.vector_subtype}
            colorHex={primaryHex}
            secondaryColor={secondaryHex || undefined}
            size={compact ? 64 : 118}
          />
        )}
      </Wrapper>
    );
  };

  const hasOuterwear = Boolean(grouped.outerwear);
  const hasAccessories = grouped.accessories.length > 0;
  const rightColumnHasUpper = hasOuterwear || hasAccessories;

  const renderPopover = () => {
    if (!interactive || !selectedItem) return null;
    const itemName = selectedItem.name || selectedItem.clothing_name || 'Garment';
    const slotLabel = classifyCollageSlot(selectedItem);
    const subtypeLabel =
      selectedItem.subCategory ||
      selectedItem.sub_category ||
      formatSubtypeLabel(
        selectedItem.vector_subtype || inferVectorSubtype(itemName, slotLabel),
        slotLabel
      );

    const cluster0 = Array.isArray(selectedItem.palette) ? selectedItem.palette[0] : null;
    const cluster1 = Array.isArray(selectedItem.palette) ? selectedItem.palette[1] : null;

    const primaryName =
      cluster0?.color_name ||
      selectedItem.primary_color ||
      selectedItem.color ||
      selectedItem.primaryColor ||
      'Charcoal';
    const primaryHex = normalizeHexCode(
      cluster0?.hex_code || selectedItem.colorHex || selectedItem.hexColor,
      primaryName
    );
    const primaryPct =
      typeof cluster0?.proportion === 'number'
        ? `${Math.round(cluster0.proportion * 100)}%`
        : null;

    const secondaryName =
      cluster1?.color_name || selectedItem.secondary_color || selectedItem.secondaryColor || null;
    const secondaryHex = secondaryName
      ? normalizeHexCode(cluster1?.hex_code || selectedItem.secondary_color_hex, secondaryName)
      : null;
    const secondaryPct =
      typeof cluster1?.proportion === 'number'
        ? `${Math.round(cluster1.proportion * 100)}%`
        : null;

    const cleanedRawNote = selectedItem.color_harmony_note
      ? selectedItem.color_harmony_note
          .replace(/CIELAB\s*K\s*=\s*2\s*:?\s*/gi, '')
          .replace(/L\*=\d+/gi, '')
          .trim()
      : '';

    const harmonyNote =
      cleanedRawNote ||
      (secondaryName
        ? `${primaryName} base paired with ${secondaryName} accent.`
        : `Dominant ${primaryName.toLowerCase()} tone.`);

    return (
      <Pressable
        onPress={() => setSelectedItem(null)}
        style={[
          styles.popoverCard,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
          },
        ]}
      >
        <View style={styles.popoverHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.popoverCategory, { color: theme.textMuted }]}>
              {slotLabel} · {subtypeLabel}
            </Text>
            <Text style={[styles.popoverTitle, { color: theme.text }]} numberOfLines={1}>
              {itemName}
            </Text>
          </View>
          <Ionicons name="close-circle" size={18} color={theme.textMuted} />
        </View>

        <View style={styles.popoverSwatchRow}>
          <View
            style={[
              styles.swatchPill,
              { backgroundColor: theme.surfaceSecondary, borderColor: theme.border },
            ]}
          >
            <View
              style={[
                styles.swatchDot,
                {
                  backgroundColor: primaryHex,
                  borderColor: isDark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.15)',
                },
              ]}
            />
            <Text style={[styles.swatchLabel, { color: theme.text }]}>
              {primaryName} · {primaryHex}
              {primaryPct ? ` (${primaryPct})` : ''}
            </Text>
          </View>

          {secondaryName && secondaryHex ? (
            <View
              style={[
                styles.swatchPill,
                { backgroundColor: theme.surfaceSecondary, borderColor: theme.border },
              ]}
            >
              <View
                style={[
                  styles.swatchDot,
                  {
                    backgroundColor: secondaryHex,
                    borderColor: isDark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.15)',
                  },
                ]}
              />
              <Text style={[styles.swatchLabel, { color: theme.text }]}>
                {secondaryName} · {secondaryHex}
                {secondaryPct ? ` (${secondaryPct})` : ''}
              </Text>
            </View>
          ) : null}
        </View>

        <Text style={[styles.harmonyText, { color: theme.textMuted }]} numberOfLines={2}>
          {harmonyNote}
        </Text>
      </Pressable>
    );
  };

  return (
    <View
      style={[
        styles.canvasContainer,
        {
          backgroundColor: '#FFFFFF',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.14)' : '#E5E2DB',
          borderRadius: compact ? 14 : 20,
          paddingHorizontal: compact ? 8 : 16,
          paddingVertical: compact ? 8 : 14,
          aspectRatio: compact ? 0.94 : 0.96,
        },
      ]}
    >
      <View style={styles.flatLayStage}>
        {/* Fixed Anatomical Left Column:
            - Top-Left: TOP (T-Shirt, Polo, Tank Top)
            - Bottom-Left (directly below the Top): BOTTOM (Jeans, Pants, Shorts) */}
        <View style={[styles.leftPrimaryColumn, { flex: 1.15 }]}>
          {grouped.top ? (
            renderFlatLayCutout(grouped.top, 1.08, 'TOP', 'left-top', {
              marginBottom: compact ? -4 : -8,
              zIndex: 2,
            })
          ) : (
            <View style={{ flex: 1.08 }} />
          )}
          {grouped.bottom ? (
            renderFlatLayCutout(grouped.bottom, 1.15, 'BOTTOM', 'left-bottom', {
              marginTop: compact ? -4 : -6,
              zIndex: 1,
            })
          ) : (
            <View style={{ flex: 1.15 }} />
          )}
        </View>

        {/* Fixed Anatomical Right Column:
            - Top-Right: OUTERWEAR (if present) or ACCESSORIES (Watch, Cap, Bag)
            - Bottom-Right: SHOES (Running Shoes, Sneakers) */}
        <View style={[styles.rightCompanionColumn, { flex: 0.92 }]}>
          {hasOuterwear ? (
            <>
              {renderFlatLayCutout(grouped.outerwear, 1.1, 'OUTERWEAR', 'right-outer')}
              {hasAccessories
                ? renderFlatLayCutout(grouped.accessories[0], 0.68, 'ACCESSORIES', 'right-acc-0')
                : null}
            </>
          ) : hasAccessories ? (
            <>
              {grouped.accessories.slice(0, 2).map((acc, idx) =>
                renderFlatLayCutout(acc, 0.85, 'ACCESSORIES', `right-acc-${idx}`)
              )}
            </>
          ) : (
            <View style={{ flex: 1 }} />
          )}
          {grouped.shoes ? (
            renderFlatLayCutout(grouped.shoes, 0.9, 'SHOES', 'right-shoes')
          ) : (
            <View style={{ flex: 0.9 }} />
          )}
        </View>
      </View>

      {/* Interactive Garment Popover when user taps any garment cutout */}
      {renderPopover()}

      {/* Pagination Indicator Centered at Bottom */}
      {!compact && typeof paginationCount === 'number' && paginationCount > 1 && (
        <View style={styles.paginationBar}>
          {Array.from({ length: paginationCount }).map((_, idx) => {
            const isActive = idx === (paginationIndex ?? 0);
            return (
              <Pressable
                key={idx}
                hitSlop={8}
                onPress={() => onSelectPagination?.(idx)}
                style={styles.paginationHit}
              >
                <View
                  style={[
                    isActive ? styles.paginationActiveBar : styles.paginationDot,
                    {
                      backgroundColor: isActive ? '#364536' : '#C6C3BD',
                    },
                  ]}
                />
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  canvasContainer: {
    width: '100%',
    borderWidth: 1,
    justifyContent: 'space-between',
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  flatLayStage: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 4,
  },
  leftPrimaryColumn: {
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rightCompanionColumn: {
    height: '100%',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 4,
  },
  cutoutSlot: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  cutoutImage: {
    width: '95%',
    height: '95%',
  },
  paginationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 6,
  },
  paginationHit: {
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paginationActiveBar: {
    width: 16,
    height: 4,
    borderRadius: 2,
  },
  paginationDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  popoverCard: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 26,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 20,
  },
  popoverHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  popoverCategory: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  popoverTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  popoverSwatchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  swatchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  swatchDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 0.8,
  },
  swatchLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  harmonyText: {
    fontSize: 10.5,
    lineHeight: 14,
  },
});
