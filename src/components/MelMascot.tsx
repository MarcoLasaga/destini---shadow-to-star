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
        withTiming(-3, { duration: 1300, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1300, easing: Easing.inOut(Easing.quad) })
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
          withTiming(-2, { duration: 340, easing: Easing.inOut(Easing.ease) }),
          withTiming(2, { duration: 340, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 220, easing: Easing.inOut(Easing.ease) })
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
  hideHeader = false,
}: {
  variant?: MelOutfit;
  message: string;
  onTapNextTip?: () => void;
  position?: MelBubblePosition;
  hideHeader?: boolean;
}) {
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
      <View
        style={[
          styles.bubble,
          position === 'inline' && styles.inlineBubble,
        ]}
      >
        {!hideHeader && (
          <View style={styles.bubbleHeaderRow}>
            <View style={styles.melBadgeRow}>
              <View style={styles.melAccentDot} />
              <Text style={styles.bubbleLabel}>Mel · Style Guide</Text>
            </View>
            {!!onTapNextTip && (
              <Text style={styles.tapPill}>Next tip ↻</Text>
            )}
          </View>
        )}
        <Text style={styles.bubbleText}>{message}</Text>
      </View>
    </Pressable>
  );
}

export default MelMascot;

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
    backgroundColor: '#F3F1EF',
    borderColor: 'rgba(54, 69, 54, 0.18)',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  inlineBubble: {
    width: '100%',
  },
  bubbleHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  melBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  melAccentDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E83E35',
  },
  bubbleLabel: {
    color: '#364536',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  tapPill: {
    color: '#F3F1EF',
    fontSize: 9.5,
    fontWeight: '700',
    backgroundColor: '#364536',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  bubbleText: {
    color: '#18181B',
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: '600',
  },
});
