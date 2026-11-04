import React, { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { useAppTheme } from '../hooks/useAppTheme';
import { ClothingItem } from '../types';
import { resolveDatasetGarmentPhoto } from '../data/datasetGarmentCatalog';
import { colorNameToHex } from '../services/outfitRecommendationService';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 20 * 2 - 12) / 2;

export default function ClothingCard({
  item,
  onToggleFavorite,
  selectionMode = false,
  isSelected = false,
  onSelect,
  onLongPress,
}: {
  item: ClothingItem;
  onToggleFavorite: (id: string) => void;
  selectionMode?: boolean;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  onLongPress?: (id: string) => void;
}) {
  const theme = useAppTheme();
  const isDark = theme.mode === 'dark';
  const navigation = useNavigation<any>();
  const scale = useSharedValue(1);

  useEffect(() => {
    if (isSelected) {
      scale.value = withSpring(0.95, { damping: 15, stiffness: 180 });
    } else {
      scale.value = withSpring(1, { damping: 15, stiffness: 180 });
    }
  }, [isSelected]);

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const activeBorderColor = theme.secondaryAccent;
  const stageBg = isDark ? '#1E2521' : '#F4F2EE';
  const colorHex = item.colorHex || colorNameToHex(item.color || 'Black');

  const handlePress = () => {
    if (selectionMode) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onSelect?.(item.id);
    } else {
      navigation.navigate('ClothingDetails', { id: item.id });
    }
  };

  const handleLongPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (onLongPress) {
      onLongPress(item.id);
    } else if (onSelect) {
      onSelect(item.id);
    }
  };

  return (
    <Animated.View entering={FadeIn.duration(300)} style={[styles.wrapper, cardAnimatedStyle]}>
      <Pressable
        onPressIn={() => {
          if (!isSelected) {
            scale.value = withSpring(0.97);
          }
        }}
        onPressOut={() => {
          if (!isSelected) {
            scale.value = withSpring(1);
          }
        }}
        onPress={handlePress}
        onLongPress={handleLongPress}
        delayLongPress={260}
        style={[
          styles.card,
          {
            backgroundColor: theme.surface,
            borderColor: isSelected ? activeBorderColor : theme.border,
            borderWidth: isSelected ? 2 : 1,
          },
        ]}
      >
        <View style={[styles.imageStage, { backgroundColor: stageBg }]}>
          <Image
            source={{ uri: resolveDatasetGarmentPhoto(item.name, item.category, item.image) }}
            style={styles.image}
            contentFit="contain"
            transition={200}
          />

          {/* Selection Checkmark / Circle Badge */}
          {selectionMode && (
            <View
              style={[
                styles.selectBadge,
                isSelected
                  ? { backgroundColor: activeBorderColor }
                  : {
                      backgroundColor: 'rgba(0,0,0,0.38)',
                      borderWidth: 1.5,
                      borderColor: '#FFFFFF',
                    },
              ]}
            >
              {isSelected && <Ionicons name="checkmark" size={14} color={theme.onAccent} />}
            </View>
          )}

          {!selectionMode && (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onToggleFavorite(item.id);
              }}
              style={[
                styles.heartButton,
                {
                  backgroundColor: isDark
                    ? 'rgba(22, 25, 24, 0.86)'
                    : 'rgba(255, 255, 255, 0.90)',
                  borderColor: theme.border,
                },
              ]}
              hitSlop={8}
            >
              <Ionicons
                name={item.favorite ? 'heart' : 'heart-outline'}
                size={15}
                color={item.favorite ? '#E84A42' : theme.textMuted}
              />
            </Pressable>
          )}
        </View>

        <View style={styles.info}>
          <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={styles.metaRow}>
            <View
              style={[
                styles.colorDot,
                {
                  backgroundColor: colorHex,
                  borderColor: isDark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.15)',
                },
              ]}
            />
            <Text style={[styles.meta, { color: theme.textMuted }]} numberOfLines={1}>
              {item.category} · {item.color}
            </Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: CARD_WIDTH,
    marginBottom: 14,
  },
  card: {
    borderRadius: 18,
    padding: 8,
    overflow: 'hidden',
  },
  imageStage: {
    width: '100%',
    aspectRatio: 0.96,
    borderRadius: 13,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  selectBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  heartButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    paddingHorizontal: 4,
    paddingTop: 9,
    paddingBottom: 3,
    gap: 3,
  },
  name: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  colorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 0.8,
  },
  meta: {
    fontSize: 11.5,
    fontWeight: '600',
    flex: 1,
  },
});
