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
import { colorNameToHex } from '../services/outfitRecommendationService';

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

function classifyCollageSlot(
  item: AltaCollageItem
): 'TOP' | 'OUTERWEAR' | 'BOTTOM' | 'SHOES' | 'ACCESSORIES' {
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
  if (cat.startsWith('TOP')) return 'TOP';

  const n = (item.name || item.clothing_name || '').toLowerCase();
  if (/\b(jacket|blazer|coat|cardigan|windbreaker|hoodie|parka|trench|bomber|vest)\b/.test(n)) {
    return 'OUTERWEAR';
  }
  if (/\b(jean|denim|chino|trouser|pant|slack|short|skirt|legging|jogger)\b/.test(n)) {
    return 'BOTTOM';
  }
  if (/\b(shoe|sneaker|loafer|boot|sandal|slipper|slide|heel|flat|trainer)\b/.test(n)) {
    return 'SHOES';
  }
  if (/\b(watch|bag|tote|belt|cap|hat|glasses|sunglasses|necklace|ring|bracelet|earring|scarf)\b/.test(n)) {
    return 'ACCESSORIES';
  }
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

  const renderGarmentPiece = (
    piece: AltaCollageItem | null,
    boxWidth: string | number,
    boxHeight: number,
    extraStyle?: any,
    keySuffix = 'piece'
  ) => {
    if (!piece) return null;
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
        style={[
          styles.garmentBox,
          { width: boxWidth as any, height: boxHeight },
          extraStyle,
          isSelected && {
            borderColor: theme.secondaryAccent,
            borderWidth: 1.5,
            borderRadius: 12,
            backgroundColor:
              theme.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
          },
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
            category={piece.category || classifyCollageSlot(piece)}
            vectorSubtype={piece.vector_subtype}
            colorHex={primaryHex}
            secondaryColor={secondaryHex || undefined}
            size={Math.min(boxHeight * 0.9, 145)}
          />
        )}
      </Wrapper>
    );
  };

  // Scale heights when rendered in compact mode (e.g., 2-col profile grid)
  const scale = compact ? 0.52 : 1;
  const topH = Math.round(142 * scale);
  const bottomH = Math.round(158 * scale);
  const shoesH = Math.round(74 * scale);
  const outerH = Math.round(156 * scale);
  const accH = Math.round(105 * scale);

  const hasOuterwear = Boolean(grouped.outerwear);
  const hasAccessories = grouped.accessories.length > 0;

  // Editorial 2-Column Balance (ALTA layout):
  // - Standard with Outerwear:
  //   Left Column (52%): TOP -> BOTTOM (marginTop: -6) -> SHOES (marginTop: -4)
  //   Right Column (48%): OUTERWEAR -> ACCESSORIES
  // - When no Outerwear is present:
  //   If Accessories exist:
  //     Left Column (52%): TOP -> BOTTOM (marginTop: -6)
  //     Right Column (48%): ACCESSORIES -> SHOES
  //   If neither Outerwear nor Accessories exist:
  //     Left Column (52%): TOP -> SHOES
  //     Right Column (48%): BOTTOM
  const canvasBg = theme.mode === 'dark' ? '#1E1E22' : '#F5F5F3';

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
    const primaryHex =
      cluster0?.hex_code ||
      selectedItem.colorHex ||
      selectedItem.hexColor ||
      colorNameToHex(primaryName);
    const primaryPct =
      typeof cluster0?.proportion === 'number'
        ? `${Math.round(cluster0.proportion * 100)}%`
        : null;

    const secondaryName =
      cluster1?.color_name || selectedItem.secondary_color || selectedItem.secondaryColor || null;
    const secondaryHex =
      cluster1?.hex_code ||
      selectedItem.secondary_color_hex ||
      (secondaryName ? colorNameToHex(secondaryName) : null);
    const secondaryPct =
      typeof cluster1?.proportion === 'number'
        ? `${Math.round(cluster1.proportion * 100)}%`
        : null;

    const harmonyNote =
      selectedItem.color_harmony_note ||
      (secondaryName
        ? `CIELAB K=2: ${primaryName} dominant paired with ${secondaryName} accent.`
        : `CIELAB K=2: Solid ${primaryName} tonal profile.`);

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
              { backgroundColor: theme.background, borderColor: theme.border },
            ]}
          >
            <View style={[styles.swatchDot, { backgroundColor: primaryHex }]} />
            <Text style={[styles.swatchLabel, { color: theme.text }]}>
              {primaryName}
              {primaryPct ? ` · ${primaryPct}` : ''}
            </Text>
          </View>

          {secondaryName && secondaryHex ? (
            <View
              style={[
                styles.swatchPill,
                { backgroundColor: theme.background, borderColor: theme.border },
              ]}
            >
              <View style={[styles.swatchDot, { backgroundColor: secondaryHex }]} />
              <Text style={[styles.swatchLabel, { color: theme.text }]}>
                {secondaryName}
                {secondaryPct ? ` · ${secondaryPct}` : ''}
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
          backgroundColor: canvasBg,
          borderRadius: compact ? 12 : 16,
          padding: compact ? 8 : 16,
          aspectRatio: compact ? 0.9 : 0.92,
        },
      ]}
    >
      <View style={styles.twoColumnRow}>
        {/* Left Column (52% width, vertically stacked with tight overlap/spacing gap: 4) */}
        <View style={styles.leftColumn}>
          {renderGarmentPiece(grouped.top, '92%', topH, undefined, 'left-top')}

          {hasOuterwear ? (
            <>
              {renderGarmentPiece(
                grouped.bottom,
                '88%',
                bottomH,
                { marginTop: compact ? -3 : -6 },
                'left-bottom'
              )}
              {renderGarmentPiece(
                grouped.shoes,
                '72%',
                shoesH,
                { marginTop: compact ? -2 : -4 },
                'left-shoes'
              )}
            </>
          ) : hasAccessories ? (
            <>
              {renderGarmentPiece(
                grouped.bottom,
                '88%',
                bottomH,
                { marginTop: compact ? -3 : -6 },
                'left-bottom'
              )}
              {renderGarmentPiece(
                grouped.shoes,
                '72%',
                shoesH,
                { marginTop: compact ? -2 : -4 },
                'left-shoes'
              )}
            </>
          ) : (
            renderGarmentPiece(
              grouped.shoes,
              '76%',
              shoesH + Math.round(14 * scale),
              { marginTop: compact ? 2 : 6 },
              'left-shoes-only'
            )
          )}
        </View>

        {/* Right Column (48% width, vertically stacked beside the Left Column) */}
        <View style={styles.rightColumn}>
          {hasOuterwear ? (
            <>
              {renderGarmentPiece(grouped.outerwear, '94%', outerH, undefined, 'right-outer')}
              {grouped.accessories.slice(0, 2).map((acc, idx) =>
                renderGarmentPiece(
                  acc,
                  '78%',
                  accH,
                  { marginTop: idx === 0 ? 4 : -2 },
                  `right-acc-${idx}`
                )
              )}
            </>
          ) : hasAccessories ? (
            <>
              {grouped.accessories.slice(0, 2).map((acc, idx) =>
                renderGarmentPiece(
                  acc,
                  '82%',
                  accH + Math.round(20 * scale),
                  { marginTop: idx === 0 ? 0 : 6 },
                  `right-acc-no-outer-${idx}`
                )
              )}
            </>
          ) : (
            renderGarmentPiece(
              grouped.bottom,
              '92%',
              bottomH + Math.round(24 * scale),
              undefined,
              'right-bottom-balanced'
            )
          )}
        </View>
      </View>

      {/* Interactive Garment CIELAB K=2 Popover */}
      {renderPopover()}

      {/* ALTA-Style Pagination Indicator Centered at the Bottom of the Canvas (| · ·) */}
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
                      backgroundColor: isActive
                        ? theme.text
                        : theme.mode === 'dark'
                        ? '#52525B'
                        : '#A1A1AA',
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
    justifyContent: 'space-between',
    overflow: 'hidden',
    position: 'relative',
  },
  twoColumnRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftColumn: {
    width: '52%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  rightColumn: {
    width: '48%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  garmentBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cutoutImage: {
    width: '100%',
    height: '100%',
  },
  paginationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 4,
  },
  paginationHit: {
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paginationActiveBar: {
    width: 3,
    height: 12,
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
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    gap: 6,
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
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.15)',
  },
  swatchLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  harmonyText: {
    fontSize: 10,
    lineHeight: 14,
  },
});

