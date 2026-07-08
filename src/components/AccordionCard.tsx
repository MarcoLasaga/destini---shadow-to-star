import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useAppTheme } from '../hooks/useAppTheme';

export default function AccordionCard({ question, answer }: { question: string; answer: string }) {
  const theme = useAppTheme();
  const [expanded, setExpanded] = useState(false);
  const rotation = useSharedValue(0);

  const chevronStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));

  const toggle = () => {
    setExpanded((prev) => !prev);
    rotation.value = withTiming(expanded ? 0 : 180, { duration: 200 });
  };

  return (
    <View style={[styles.card, { backgroundColor: theme.mode === 'dark' ? '#232329' : '#F4F1EA' }]}>
      <Pressable onPress={toggle} style={styles.header}>
        <Text style={[styles.question, { color: theme.text }]}>{question}</Text>
        <Animated.View style={chevronStyle}>
          <Ionicons name="chevron-down" size={18} color={theme.textMuted} />
        </Animated.View>
      </Pressable>
      {expanded && (
        <Animated.View entering={FadeIn.duration(200)} style={styles.answerWrap}>
          <Text style={[styles.answer, { color: theme.textMuted }]}>{answer}</Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, paddingHorizontal: 16, marginBottom: 10, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 15 },
  question: { flex: 1, fontSize: 14, fontWeight: '600', paddingRight: 12 },
  answerWrap: { paddingBottom: 15 },
  answer: { fontSize: 13, lineHeight: 19 },
});