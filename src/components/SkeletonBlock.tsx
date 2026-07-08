import React, { useEffect } from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useAppTheme } from '../hooks/useAppTheme';

export default function SkeletonBlock({ style }: { style: ViewStyle }) {
  const theme = useAppTheme();
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(withSequence(withTiming(0.9, { duration: 700 }), withTiming(0.4, { duration: 700 })), -1, true);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        styles.block,
        { backgroundColor: theme.mode === 'dark' ? '#33333B' : '#E9E4D8' },
        style,
        animatedStyle,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  block: { borderRadius: 14 },
});