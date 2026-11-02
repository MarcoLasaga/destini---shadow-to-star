import React, { useEffect, useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useAppTheme } from '../hooks/useAppTheme';
import { getRandomTip } from '../constants/mockData';

export default function SustainabilityTip() {
  const theme = useAppTheme();
  const [tip, setTip] = useState('');

  useEffect(() => {
    setTip(getRandomTip());
  }, []);

  if (!tip) return null;

  return (
    <Animated.View
      key={tip}
      entering={FadeIn.duration(500)}
      exiting={FadeOut.duration(300)}
      style={[styles.card, { backgroundColor: theme.mode === 'dark' ? '#3A331F' : '#FBEFD2' }]}
    >
      <Ionicons name="bulb-outline" size={18} color={theme.accent} style={styles.bulbIcon} />
      <Text style={[styles.text, { color: theme.text }]}>
        <Text style={{ fontWeight: '700' }}>Sustainability tip: </Text>
        {tip}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 18,
    padding: 14,
    alignItems: 'flex-start',
  },
  bulbIcon: { marginRight: 10, marginTop: 1 },
  text: { flex: 1, fontSize: 13.5, lineHeight: 19 },
});
