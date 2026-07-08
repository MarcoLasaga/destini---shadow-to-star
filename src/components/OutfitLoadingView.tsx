import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { useEffect } from 'react';
import { useAppTheme } from '../hooks/useAppTheme';
import SkeletonBlock from './SkeletonBlock';

export default function OutfitLoadingView() {
  const theme = useAppTheme();
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(withTiming(360, { duration: 1600, easing: Easing.linear }), -1);
  }, []);

  const spinStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));

  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.container}>
      <Animated.View style={[styles.iconCircle, { backgroundColor: theme.mode === 'dark' ? '#2A2A31' : '#EDEAF6' }, spinStyle]}>
        <Ionicons name="sparkles" size={26} color={theme.secondaryAccent} />
      </Animated.View>

      <Text style={[styles.title, { color: theme.text }]}>Generating your perfect outfit...</Text>
      <Text style={[styles.subtitle, { color: theme.textMuted }]}>Analyzing weather, style & wardrobe</Text>

      <View style={styles.skeletonWrap}>
        <View style={styles.row}>
          <SkeletonBlock style={{ width: 44, height: 44, borderRadius: 22 }} />
          <SkeletonBlock style={{ flex: 1, height: 44, marginLeft: 12 }} />
        </View>
        <SkeletonBlock style={{ width: '100%', height: 48, marginTop: 16 }} />
        <View style={[styles.row, { marginTop: 16 }]}>
          <SkeletonBlock style={{ flex: 1, height: 44 }} />
          <SkeletonBlock style={{ flex: 1, height: 44, marginLeft: 12 }} />
        </View>
        <SkeletonBlock style={{ width: '100%', height: 48, marginTop: 16 }} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingTop: 40, paddingHorizontal: 20 },
  iconCircle: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title: { fontSize: 16.5, fontWeight: '700', marginBottom: 4 },
  subtitle: { fontSize: 13, marginBottom: 28 },
  skeletonWrap: { width: '100%' },
  row: { flexDirection: 'row', alignItems: 'center' },
});