import React, { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { useAppTheme } from '../hooks/useAppTheme';
import { ClothingItem } from '../types';

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
  const navigation = useNavigation<any>();
  const scale = useSharedValue(1);

  useEffect(() => {
    if (isSelected) {
      scale.value = withSpring(0.93, { damping: 15, stiffness: 180 });
    } else {
      scale.value = withSpring(1, { damping: 15, stiffness: 180 });
    }
  }, [isSelected]);

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const activeBorderColor = theme.mode === 'dark' ? '#6366F1' : theme.secondaryAccent;

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
    <Animated.View entering={FadeIn.duration(350)} style={[styles.wrapper, cardAnimatedStyle]}>
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
        <View style={styles.imageWrap}>
          {item.image ? (
            <Image source={{ uri: item.image }} style={styles.image} contentFit="cover" transition={200} />
          ) : (
            <View style={[styles.image, styles.fallback, { backgroundColor: theme.background }]}>
              <Ionicons name="shirt-outline" size={28} color={theme.textMuted} />
            </View>
          )}

          {/* Selection Checkmark / Empty Circle Badge */}
          {selectionMode && (
            <View
              style={[
                styles.selectBadge,
                isSelected
                  ? { backgroundColor: activeBorderColor }
                  : { backgroundColor: 'rgba(0,0,0,0.3)', borderWidth: 1.5, borderColor: '#FFFFFF' },
              ]}
            >
              {isSelected && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
            </View>
          )}

          {item.status === 'needs-washing' && !selectionMode && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Needs Wash</Text>
            </View>
          )}

          {!selectionMode && (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onToggleFavorite(item.id);
              }}
              style={styles.heartButton}
              hitSlop={8}
            >
              <Ionicons
                name={item.favorite ? 'heart' : 'heart-outline'}
                size={16}
                color={item.favorite ? '#E5484D' : '#5A5A5A'}
              />
            </Pressable>
          )}
        </View>

        <View style={styles.info}>
          <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[styles.meta, { color: theme.textMuted }]} numberOfLines={1}>
            {item.category} · {item.color}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: { width: CARD_WIDTH, marginBottom: 16 },
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  imageWrap: { width: '100%', aspectRatio: 1, position: 'relative' },
  image: { width: '100%', height: '100%' },
  fallback: { alignItems: 'center', justifyContent: 'center' },
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
  badge: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    backgroundColor: '#E8833A',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: { color: '#FFFFFF', fontSize: 10.5, fontWeight: '700' },
  heartButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { padding: 10, gap: 2 },
  name: { fontSize: 13.5, fontWeight: '700' },
  meta: { fontSize: 11.5 },
});