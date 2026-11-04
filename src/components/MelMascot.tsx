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
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useAppTheme } from '../hooks/useAppTheme';

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

/**
 * Standalone Free-Standing Mel Character Illustration.
 * Never enclosed inside a circular badge or cropped container.
 */
export function MelMascot({
  outfit = 'casual_sunny',
  size = 56,
  waving = false,
  onPress,
  style,
}: MelMascotProps) {
  const bob = useSharedValue(0);
  const tilt = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    bob.value = withRepeat(
      withSequence(
        withTiming(-3, { duration: 1500, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      false
    );
  }, [bob]);

  useEffect(() => {
    if (waving) {
      tilt.value = withRepeat(
        withSequence(
          withTiming(-2, { duration: 360, easing: Easing.inOut(Easing.ease) }),
          withTiming(2, { duration: 360, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 240, easing: Easing.inOut(Easing.ease) })
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
      scale.value = withSpring(0.95, { damping: 14, stiffness: 220 });
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

  // Full-body chameleon aspect ratio (~297 x 450 = 1 : 1.52)
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
      style={[styles.freeStandingContainer, { width, height }, style]}
    >
      <Animated.View style={[{ width, height, overflow: 'visible' }, animatedStyle]}>
        <Image
          source={imageSource}
          style={{ width, height }}
          resizeMode="contain"
        />
      </Animated.View>
    </Pressable>
  );
}

/**
 * Natural Dialogue Speech Bubble with Directional Tail Pointing to Mel.
 * Automatically adapts to Light Mode and Dark Mode.
 */
export function MelSpeechBubble({
  variant = 'casual_sunny',
  title = 'MEL · STYLE TIP',
  message,
  onTapNextTip,
  position = 'inline',
  tailDirection = 'left',
  hideHeader = false,
  compact = false,
}: {
  variant?: MelOutfit;
  title?: string;
  message: string;
  onTapNextTip?: () => void;
  position?: MelBubblePosition;
  tailDirection?: 'left' | 'right' | 'top' | 'none';
  hideHeader?: boolean;
  compact?: boolean;
}) {
  const theme = useAppTheme();
  const isDark = theme.mode === 'dark';

  const bubbleBg = isDark ? '#19211D' : '#FFFFFF';
  const bubbleBorder = isDark ? '#2B3830' : '#D8E2DA';
  const badgeColor = isDark ? '#98C4A4' : '#364536';
  const textColor = isDark ? '#F3F1EF' : '#18181B';
  const actionBg = isDark ? 'rgba(152, 196, 164, 0.14)' : '#ECF1ED';

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
      <View style={styles.speechRowWithTail}>
        {tailDirection === 'left' && (
          <View style={styles.leftTailWrap} pointerEvents="none">
            <View
              style={[
                styles.leftTailDiamond,
                {
                  backgroundColor: bubbleBg,
                  borderColor: bubbleBorder,
                },
              ]}
            />
          </View>
        )}

        <View
          style={[
            styles.bubble,
            compact && styles.bubbleCompact,
            position === 'inline' && !compact && styles.inlineBubble,
            position === 'inline' && compact && styles.inlineBubbleCompact,
            {
              backgroundColor: bubbleBg,
              borderColor: bubbleBorder,
            },
          ]}
        >
          {tailDirection === 'top' && (
            <View
              style={[
                styles.topTailDiamond,
                {
                  backgroundColor: bubbleBg,
                  borderColor: bubbleBorder,
                },
              ]}
              pointerEvents="none"
            />
          )}

          {!hideHeader && (
            <View style={[styles.bubbleHeaderRow, compact && { marginBottom: 3 }]}>
              <View style={styles.melBadgeRow}>
                <View style={styles.melAccentDot} />
                <Text style={[styles.bubbleLabel, { color: badgeColor }]} numberOfLines={1}>
                  {title}
                </Text>
              </View>
              {!!onTapNextTip && (
                <View style={[styles.tapPill, { backgroundColor: actionBg }]}>
                  <Text style={[styles.tapPillText, { color: badgeColor }]}>Next tip</Text>
                  <Ionicons name="refresh" size={10} color={badgeColor} />
                </View>
              )}
            </View>
          )}
          <Text
            style={[
              styles.bubbleText,
              compact && styles.bubbleTextCompact,
              { color: textColor },
            ]}
            numberOfLines={compact ? 2 : 3}
          >
            {message}
          </Text>
        </View>

        {tailDirection === 'right' && (
          <View style={styles.rightTailWrap} pointerEvents="none">
            <View
              style={[
                styles.rightTailDiamond,
                {
                  backgroundColor: bubbleBg,
                  borderColor: bubbleBorder,
                },
              ]}
            />
          </View>
        )}
      </View>
    </Pressable>
  );
}

export default MelMascot;

const styles = StyleSheet.create({
  freeStandingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    overflow: 'visible',
  },
  bubbleWrap: {
    position: 'absolute',
    zIndex: 2,
    maxWidth: 260,
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
    flexShrink: 1,
    position: 'relative',
    maxWidth: '100%',
  },
  speechRowWithTail: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  leftTailWrap: {
    width: 10,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -5,
    zIndex: 3,
  },
  leftTailDiamond: {
    width: 10,
    height: 10,
    borderLeftWidth: 1.2,
    borderBottomWidth: 1.2,
    transform: [{ rotate: '45deg' }],
    borderRadius: 2,
  },
  rightTailWrap: {
    width: 10,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -5,
    zIndex: 3,
  },
  rightTailDiamond: {
    width: 10,
    height: 10,
    borderRightWidth: 1.2,
    borderTopWidth: 1.2,
    transform: [{ rotate: '45deg' }],
    borderRadius: 2,
  },
  topTailDiamond: {
    position: 'absolute',
    top: -5,
    left: 24,
    width: 10,
    height: 10,
    borderTopWidth: 1.2,
    borderLeftWidth: 1.2,
    transform: [{ rotate: '45deg' }],
    borderRadius: 2,
  },
  bubble: {
    borderWidth: 1.2,
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 5,
    elevation: 2,
    flexShrink: 1,
  },
  bubbleCompact: {
    borderRadius: 14,
    paddingHorizontal: 11,
    paddingVertical: 8,
    maxWidth: 220,
  },
  inlineBubble: {
    flex: 1,
    width: '100%',
  },
  inlineBubbleCompact: {
    flexShrink: 1,
    maxWidth: 220,
  },
  bubbleHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  melBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1,
  },
  melAccentDot: {
    width: 5.5,
    height: 5.5,
    borderRadius: 3,
    backgroundColor: '#E83E35',
  },
  bubbleLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  tapPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  tapPillText: {
    fontSize: 9,
    fontWeight: '700',
  },
  bubbleText: {
    fontSize: 12,
    lineHeight: 16.5,
    fontWeight: '600',
  },
  bubbleTextCompact: {
    fontSize: 11.5,
    lineHeight: 15.5,
  },
});
