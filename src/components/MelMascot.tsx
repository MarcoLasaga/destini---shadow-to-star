import React, { useEffect, useMemo } from 'react';
import {
  Image,
  ImageSourcePropType,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

export type MelOutfit =
  | 'casual_sunny'
  | 'cool_hoodie'
  | 'smart_layered'
  | 'formal_suit'
  | 'rain_active'
  | 'cool_street'
  | 'smart_slate'
  | 'formal_bowtie';

export type MelBubblePosition = 'top-left' | 'bottom-right' | 'inline';

const MEL_IMAGES: Record<string, ImageSourcePropType> = {
  casual_sunny: require('../../assets/mel/casual_sunny.png'),
  cool_hoodie: require('../../assets/mel/cool_hoodie.png'),
  smart_layered: require('../../assets/mel/smart_layered.png'),
  formal_suit: require('../../assets/mel/formal_suit.png'),
  rain_active: require('../../assets/mel/rain_active.png'),
  waving_casual: require('../../assets/mel/waving_casual.png'),
  waving_active: require('../../assets/mel/waving_active.png'),
  cool_street: require('../../assets/mel/cool_street.png'),
  smart_slate: require('../../assets/mel/smart_slate.png'),
  formal_bowtie: require('../../assets/mel/formal_bowtie.png'),
};

/**
 * Returns the exact artwork asset for Mel given an outfit & waving state.
 */
export function getMelImageSource(
  outfit: MelOutfit = 'casual_sunny',
  waving = false
): ImageSourcePropType {
  if (waving) {
    if (outfit === 'rain_active') {
      return MEL_IMAGES.waving_active;
    }
    return MEL_IMAGES.waving_casual;
  }
  return MEL_IMAGES[outfit] || MEL_IMAGES.casual_sunny;
}

/**
 * Helper to dynamically coordinate Mel's outfit with the target occasion.
 */
export function melOutfitForOccasion(occasion?: string): MelOutfit {
  if (!occasion) return 'smart_layered';
  const occ = occasion.toLowerCase();
  if (occ.includes('formal') || occ.includes('gala') || occ.includes('wedding')) {
    return 'formal_suit';
  }
  if (
    occ.includes('street') ||
    occ.includes('party') ||
    occ.includes('night') ||
    occ.includes('club')
  ) {
    return 'cool_hoodie';
  }
  if (
    occ.includes('sport') ||
    occ.includes('gym') ||
    occ.includes('active') ||
    occ.includes('rain') ||
    occ.includes('run')
  ) {
    return 'rain_active';
  }
  if (
    occ.includes('casual') ||
    occ.includes('everyday') ||
    occ.includes('home') ||
    occ.includes('errand')
  ) {
    return 'casual_sunny';
  }
  return 'smart_layered';
}

interface MelMascotProps {
  outfit?: MelOutfit;
  size?: number;
  waving?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function MelMascot({
  outfit = 'casual_sunny',
  size = 140,
  waving = false,
  onPress,
  style,
}: MelMascotProps) {
  const bob = useSharedValue(0);
  const tilt = useSharedValue(0);
  const scale = useSharedValue(1);

  // Subtle floating idle motion
  useEffect(() => {
    bob.value = withRepeat(
      withSequence(
        withTiming(-4, { duration: 1200, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1200, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      false
    );
  }, [bob]);

  // Gentle playful tilt when waving
  useEffect(() => {
    if (waving) {
      tilt.value = withRepeat(
        withSequence(
          withTiming(-2.5, { duration: 320, easing: Easing.inOut(Easing.ease) }),
          withTiming(2.5, { duration: 320, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 200, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
    } else {
      tilt.value = withTiming(0, { duration: 200 });
    }
  }, [waving, tilt]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: bob.value },
      { rotate: `${tilt.value}deg` },
      { scale: scale.value },
    ],
  }));

  const handlePressIn = () => {
    if (onPress) {
      scale.value = withSpring(0.94, { damping: 14, stiffness: 220 });
    }
  };

  const handlePressOut = () => {
    if (onPress) {
      scale.value = withSpring(1, { damping: 14, stiffness: 220 });
    }
  };

  const imageSource = useMemo(
    () => getMelImageSource(outfit, waving),
    [outfit, waving]
  );

  const width = size;
  const height = Math.round(size * 1.52);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={`Mel the Chameleon Stylist in ${outfit.replace('_', ' ')} outfit`}
      style={[styles.container, { width, height }, style]}
    >
      <Animated.View style={[{ width, height }, animatedStyle]}>
        <Image
          source={imageSource}
          style={{ width, height }}
          resizeMode="contain"
        />
      </Animated.View>
    </Pressable>
  );
}

export function MelSpeechBubble({
  variant = 'casual_sunny',
  message,
  onTapNextTip,
  position = 'top-left',
}: {
  variant?: MelOutfit;
  message: string;
  onTapNextTip?: () => void;
  position?: MelBubblePosition;
}) {
  const scale = useSharedValue(0.99);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.99, { duration: 600, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, [scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const label = useMemo(() => {
    if (variant === 'rain_active') return 'Mel · Weather Alert';
    if (variant === 'formal_suit' || variant === 'formal_bowtie') return 'Mel · Formal Style Note';
    if (variant === 'cool_hoodie' || variant === 'cool_street') return 'Mel · Streetwear Note';
    return 'Mel · Stylist Note';
  }, [variant]);

  return (
    <Pressable
      onPress={onTapNextTip}
      disabled={!onTapNextTip}
      style={[
        styles.bubbleWrap,
        position === 'bottom-right'
          ? styles.bottomRight
          : position === 'inline'
          ? styles.inlineWrap
          : styles.topLeft,
      ]}
    >
      <Animated.View
        style={[
          styles.bubble,
          position === 'inline' && styles.inlineBubble,
          animatedStyle,
        ]}
      >
        <View style={styles.bubbleHeaderRow}>
          <Text style={styles.bubbleLabel}>{label}</Text>
          {!!onTapNextTip && (
            <Text style={styles.tapPill}>Tap for tip ↻</Text>
          )}
        </View>
        <Text style={styles.bubbleText}>{message}</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleWrap: {
    position: 'absolute',
    zIndex: 2,
    maxWidth: 245,
  },
  topLeft: {
    top: 8,
    left: 8,
  },
  bottomRight: {
    right: 94,
    bottom: 10,
  },
  inlineWrap: {
    flex: 1,
    position: 'relative',
    maxWidth: '100%',
  },
  bubble: {
    backgroundColor: '#FFFDF7',
    borderColor: '#24513B',
    borderWidth: 1.5,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#24513B',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  inlineBubble: {
    width: '100%',
  },
  bubbleHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  bubbleLabel: {
    color: '#4D9A65',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  tapPill: {
    color: '#2E7D32',
    fontSize: 10,
    fontWeight: '700',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  bubbleText: {
    color: '#21352B',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
});
