import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function StarRating({
  rating,
  size = 16,
  editable = false,
  onChange,
}: {
  rating: number;
  size?: number;
  editable?: boolean;
  onChange?: (value: number) => void;
}) {
  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= Math.round(rating);
        const StarComponent = editable ? Pressable : View;
        return (
          <StarComponent key={star} onPress={editable ? () => onChange?.(star) : undefined} hitSlop={4}>
            <Ionicons name={filled ? 'star' : 'star-outline'} size={size} color="#F5B841" />
          </StarComponent>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 4 },
});