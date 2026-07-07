import React from 'react';
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
}: {
  item: ClothingItem;
  onToggleFavorite: (id: string) => void;
}) {
  const theme = useAppTheme();
  const navigation = useNavigation<any>();
  const scale = useSharedValue(1);

  const cardAnimatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View entering={FadeIn.duration(350)} style={[styles.wrapper, cardAnimatedStyle]}>
      <Pressable
        onPressIn={() => (scale.value = withSpring(0.97))}
        onPressOut={() => (scale.value = withSpring(1))}
        onPress={() => navigation.navigate('ClothingDetails', { id: item.id })}
        style={[styles.card, { backgroundColor: theme.surface }]}
      >
        <View style={styles.imageWrap}>
          <Image source={{ uri: item.image }} style={styles.image} contentFit="cover" transition={200} />

          {item.status === 'needs-washing' && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Needs Wash</Text>
            </View>
          )}

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
  card: { borderRadius: 18, overflow: 'hidden' },
  imageWrap: { width: '100%', aspectRatio: 1, position: 'relative' },
  image: { width: '100%', height: '100%' },
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