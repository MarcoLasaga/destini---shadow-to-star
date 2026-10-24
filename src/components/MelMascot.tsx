import React, { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  Line,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';

export type MelOutfit =
  | 'casual_sunny'
  | 'cool_hoodie'
  | 'smart_layered'
  | 'formal_suit'
  | 'rain_active';

export type MelBubblePosition = 'top-left' | 'bottom-right' | 'inline';

interface MelMascotProps {
  outfit?: MelOutfit;
  size?: number;
  waving?: boolean;
  onPress?: () => void;
}

export function MelMascot({
  outfit = 'casual_sunny',
  size = 140,
  waving = false,
  onPress,
}: MelMascotProps) {
  const bob = useSharedValue(0);
  const wave = useSharedValue(0);

  useEffect(() => {
    bob.value = withRepeat(
      withSequence(
        withTiming(-4, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1100, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      false
    );
  }, [bob]);

  useEffect(() => {
    if (waving) {
      wave.value = withRepeat(
        withSequence(
          withTiming(-20, { duration: 240, easing: Easing.inOut(Easing.ease) }),
          withTiming(15, { duration: 240, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 240, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
    } else {
      wave.value = withTiming(0, { duration: 200 });
    }
  }, [waving, wave]);

  const bobAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: bob.value }],
  }));

  const waveArmAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${wave.value}deg` }],
  }));

  const scale = size / 160;
  const height = size * 1.15;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel="Mel the Chameleon Stylist"
      style={{ width: size, height }}
    >
      <Animated.View style={[{ width: size, height }, bobAnimatedStyle]}>
        <Svg width={size} height={height} viewBox="0 0 160 184">
          <Defs>
            {/* Chameleon Green Gradients */}
            <LinearGradient id="melCrest" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#58B947" />
              <Stop offset="100%" stopColor="#2E7D32" />
            </LinearGradient>
            <LinearGradient id="melBody" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor="#6BCB4A" />
              <Stop offset="70%" stopColor="#43A047" />
              <Stop offset="100%" stopColor="#2E7D32" />
            </LinearGradient>
            <LinearGradient id="melBelly" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#D4F69B" />
              <Stop offset="100%" stopColor="#A8E063" />
            </LinearGradient>

            {/* Expressive Eye Gradient */}
            <LinearGradient id="melEyeIris" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor="#42A5F5" />
              <Stop offset="50%" stopColor="#1E88E5" />
              <Stop offset="100%" stopColor="#0D47A1" />
            </LinearGradient>

            {/* Outfit Gradients */}
            <LinearGradient id="sunnyShirt" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#FFF176" />
              <Stop offset="100%" stopColor="#FBC02D" />
            </LinearGradient>
            <LinearGradient id="hoodieGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#8E78C9" />
              <Stop offset="100%" stopColor="#5E4399" />
            </LinearGradient>
            <LinearGradient id="vestGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#DEB887" />
              <Stop offset="100%" stopColor="#A67C52" />
            </LinearGradient>
            <LinearGradient id="suitGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#2C3E50" />
              <Stop offset="100%" stopColor="#1A252F" />
            </LinearGradient>
            <LinearGradient id="rainGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#FFA726" />
              <Stop offset="100%" stopColor="#EF6C00" />
            </LinearGradient>
          </Defs>

          {/* 1. Curled spiral chameleon tail on the right (M 72,72 C 96,72 98,46 80,46 C 68,46 68,62 78,62 coordinate scaled) */}
          <G transform="translate(42, 68)">
            <Path
              d="M 62,64 C 86,64 96,38 78,38 C 66,38 66,54 76,54"
              fill="none"
              stroke="url(#melCrest)"
              strokeWidth="9"
              strokeLinecap="round"
            />
          </G>

          {/* 2. Chameleon Back Casque / Crest */}
          <Path
            d="M 52,42 C 48,16 66,6 80,11 C 94,15 106,24 114,40 C 98,36 80,34 66,38 Z"
            fill="url(#melCrest)"
            stroke="#1B4D1F"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          {/* Subtle crest ridges */}
          <Circle cx="64" cy="18" r="3.2" fill="#7EE063" />
          <Circle cx="76" cy="16" r="3.5" fill="#7EE063" />
          <Circle cx="88" cy="20" r="3" fill="#7EE063" />
          <Circle cx="98" cy="26" r="2.5" fill="#7EE063" />

          {/* 3. Lower Torso & Back Legs */}
          <Ellipse cx="78" cy="120" rx="34" ry="30" fill="url(#melBody)" stroke="#1B4D1F" strokeWidth="2" />
          
          {/* Feet (Clawed Chameleon Mitts) */}
          {outfit === 'casual_sunny' && (
            <G>
              {/* White sneakers */}
              <Path d="M 50,166 C 44,166 40,172 44,176 C 50,178 62,178 64,172 C 64,168 58,166 50,166 Z" fill="#F8FAFC" stroke="#94A3B8" strokeWidth="1.5" />
              <Path d="M 106,166 C 112,166 116,172 112,176 C 106,178 94,178 92,172 C 92,168 98,166 106,166 Z" fill="#F8FAFC" stroke="#94A3B8" strokeWidth="1.5" />
              <Line x1="48" y1="172" x2="56" y2="172" stroke="#EF4444" strokeWidth="1.5" />
              <Line x1="100" y1="172" x2="108" y2="172" stroke="#EF4444" strokeWidth="1.5" />
            </G>
          )}

          {outfit === 'cool_hoodie' && (
            <G>
              {/* Chunky skater kicks */}
              <Path d="M 48,165 C 42,165 38,171 42,176 C 48,178 62,178 64,173 C 64,167 56,165 48,165 Z" fill="#FFFFFF" stroke="#334155" strokeWidth="1.5" />
              <Path d="M 108,165 C 114,165 118,171 114,176 C 108,178 94,178 92,173 C 92,167 100,165 108,165 Z" fill="#FFFFFF" stroke="#334155" strokeWidth="1.5" />
              <Rect x="44" y="172" width="16" height="4" rx="2" fill="#7C3AED" />
              <Rect x="96" y="172" width="16" height="4" rx="2" fill="#7C3AED" />
            </G>
          )}

          {outfit === 'smart_layered' && (
            <G>
              {/* Polished brown oxfords */}
              <Path d="M 48,166 C 42,166 40,172 44,176 C 50,178 62,178 64,172 C 64,168 58,166 48,166 Z" fill="#6B3A1C" stroke="#3D1F0E" strokeWidth="1.5" />
              <Path d="M 108,166 C 114,166 116,172 112,176 C 106,178 94,178 92,172 C 92,168 98,166 108,166 Z" fill="#6B3A1C" stroke="#3D1F0E" strokeWidth="1.5" />
            </G>
          )}

          {outfit === 'formal_suit' && (
            <G>
              {/* Polished black dress shoes */}
              <Path d="M 48,166 C 42,166 40,172 44,176 C 50,178 62,178 64,172 C 64,168 58,166 48,166 Z" fill="#0F172A" stroke="#000000" strokeWidth="1.5" />
              <Path d="M 108,166 C 114,166 116,172 112,176 C 106,178 94,178 92,172 C 92,168 98,166 108,166 Z" fill="#0F172A" stroke="#000000" strokeWidth="1.5" />
              <Ellipse cx="50" cy="170" rx="3" ry="1.2" fill="#475569" />
              <Ellipse cx="106" cy="170" rx="3" ry="1.2" fill="#475569" />
            </G>
          )}

          {outfit === 'rain_active' && (
            <G>
              {/* Amber yellow rain boots */}
              <Path d="M 46,162 L 46,175 C 46,178 62,178 64,174 L 64,162 Z" fill="#F59E0B" stroke="#B45309" strokeWidth="1.5" />
              <Path d="M 110,162 L 110,175 C 110,178 94,178 92,174 L 92,162 Z" fill="#F59E0B" stroke="#B45309" strokeWidth="1.5" />
              <Rect x="44" y="174" width="20" height="3" rx="1.5" fill="#374151" />
              <Rect x="92" y="174" width="20" height="3" rx="1.5" fill="#374151" />
            </G>
          )}

          {/* 4. Outfit Bottoms */}
          {outfit === 'casual_sunny' && (
            <G>
              {/* Olive safari shorts */}
              <Path d="M 52,136 L 104,136 L 100,160 L 82,160 L 80,146 L 76,146 L 74,160 L 56,160 Z" fill="#4D6B3C" stroke="#25381D" strokeWidth="1.8" />
              <Line x1="60" y1="144" x2="70" y2="144" stroke="#3B532E" strokeWidth="1.5" />
              <Line x1="86" y1="144" x2="96" y2="144" stroke="#3B532E" strokeWidth="1.5" />
            </G>
          )}

          {outfit === 'cool_hoodie' && (
            <G>
              {/* Charcoal baggy pants */}
              <Path d="M 50,136 L 106,136 L 102,162 L 83,162 L 80,145 L 75,145 L 72,162 L 54,162 Z" fill="#2E3440" stroke="#1E222A" strokeWidth="1.8" />
              <Rect x="54" y="145" width="12" height="10" rx="2" fill="#3B4252" />
              <Rect x="90" y="145" width="12" height="10" rx="2" fill="#3B4252" />
            </G>
          )}

          {outfit === 'smart_layered' && (
            <G>
              {/* Tailored navy trousers */}
              <Path d="M 52,135 L 104,135 L 101,162 L 84,162 L 80,144 L 76,144 L 72,162 L 55,162 Z" fill="#1E293B" stroke="#0F172A" strokeWidth="1.8" />
              <Line x1="64" y1="140" x2="64" y2="158" stroke="#334155" strokeWidth="1" />
              <Line x1="92" y1="140" x2="92" y2="158" stroke="#334155" strokeWidth="1" />
            </G>
          )}

          {outfit === 'formal_suit' && (
            <G>
              {/* Midnight navy dress trousers */}
              <Path d="M 52,135 L 104,135 L 101,162 L 84,162 L 80,144 L 76,144 L 72,162 L 55,162 Z" fill="#0F172A" stroke="#020617" strokeWidth="1.8" />
              <Line x1="64" y1="138" x2="64" y2="158" stroke="#1E293B" strokeWidth="1.2" />
              <Line x1="92" y1="138" x2="92" y2="158" stroke="#1E293B" strokeWidth="1.2" />
            </G>
          )}

          {outfit === 'rain_active' && (
            <G>
              {/* Dark storm-gray technical joggers */}
              <Path d="M 51,135 L 105,135 L 101,160 L 83,160 L 80,144 L 75,144 L 73,160 L 55,160 Z" fill="#374151" stroke="#1F2937" strokeWidth="1.8" />
              <Line x1="78" y1="138" x2="78" y2="148" stroke="#6B7280" strokeWidth="1.5" />
            </G>
          )}

          {/* 5. Outfit Tops */}
          {outfit === 'casual_sunny' && (
            <G>
              {/* Resort floral / sunshine yellow open collar shirt */}
              <Path
                d="M 44,98 C 44,92 56,90 78,90 C 100,90 112,92 112,98 L 108,138 L 48,138 Z"
                fill="url(#sunnyShirt)"
                stroke="#C69214"
                strokeWidth="1.8"
              />
              {/* Collar folds */}
              <Path d="M 62,90 L 78,106 L 66,108 Z" fill="#FFF9C4" stroke="#C69214" strokeWidth="1" />
              <Path d="M 94,90 L 78,106 L 90,108 Z" fill="#FFF9C4" stroke="#C69214" strokeWidth="1" />
              {/* Coconut buttons */}
              <Circle cx="78" cy="115" r="2" fill="#5D4037" />
              <Circle cx="78" cy="126" r="2" fill="#5D4037" />
            </G>
          )}

          {outfit === 'cool_hoodie' && (
            <G>
              {/* Lavender oversized fleece hoodie */}
              <Path
                d="M 42,95 C 42,90 56,88 78,88 C 100,88 114,90 114,95 L 110,138 L 46,138 Z"
                fill="url(#hoodieGrad)"
                stroke="#3F286B"
                strokeWidth="1.8"
              />
              {/* Kangaroo pocket */}
              <Path d="M 58,118 L 98,118 L 94,136 L 62,136 Z" fill="#4C347E" stroke="#3F286B" strokeWidth="1.2" />
              {/* Hood collar & drawstring */}
              <Path d="M 64,88 C 72,98 84,98 92,88" fill="none" stroke="#3F286B" strokeWidth="2.5" />
              <Line x1="72" y1="94" x2="70" y2="108" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
              <Line x1="84" y1="94" x2="86" y2="108" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
            </G>
          )}

          {outfit === 'smart_layered' && (
            <G>
              {/* Sky blue collared shirt under camel knit vest */}
              <Path
                d="M 46,95 C 46,90 56,88 78,88 C 100,88 110,90 110,95 L 107,137 L 49,137 Z"
                fill="url(#vestGrad)"
                stroke="#6B4F33"
                strokeWidth="1.8"
              />
              {/* V-neck collar revealing blue shirt & tie */}
              <Path d="M 66,88 L 78,106 L 90,88 Z" fill="#93C5FD" stroke="#3B82F6" strokeWidth="1.2" />
              <Path d="M 76,96 L 80,96 L 79,105 L 77,105 Z" fill="#7C2D12" />
              <Path d="M 62,88 L 72,96" stroke="#FFFFFF" strokeWidth="1.5" />
              <Path d="M 94,88 L 84,96" stroke="#FFFFFF" strokeWidth="1.5" />
            </G>
          )}

          {outfit === 'formal_suit' && (
            <G>
              {/* Midnight navy tuxedo blazer & crimson bowtie */}
              <Path
                d="M 44,95 C 44,90 56,88 78,88 C 100,88 112,90 112,95 L 108,137 L 48,137 Z"
                fill="url(#suitGrad)"
                stroke="#090E17"
                strokeWidth="1.8"
              />
              {/* White dress shirt V */}
              <Path d="M 64,88 L 78,114 L 92,88 Z" fill="#FFFFFF" />
              {/* Silk lapels */}
              <Path d="M 48,94 L 66,118 L 78,115 L 60,90 Z" fill="#1E293B" />
              <Path d="M 108,94 L 90,118 L 78,115 L 96,90 Z" fill="#1E293B" />
              {/* Bowtie */}
              <Path d="M 72,94 L 84,98 L 72,102 Z" fill="#991B1B" />
              <Path d="M 84,94 L 72,98 L 84,102 Z" fill="#991B1B" />
              <Circle cx="78" cy="98" r="2" fill="#7F1D1D" />
              {/* Gold button */}
              <Circle cx="78" cy="122" r="2.2" fill="#F59E0B" />
            </G>
          )}

          {outfit === 'rain_active' && (
            <G>
              {/* Vibrant tangerine waterproof jacket */}
              <Path
                d="M 43,94 C 43,89 56,87 78,87 C 100,87 113,89 113,94 L 109,138 L 47,138 Z"
                fill="url(#rainGrad)"
                stroke="#C2410C"
                strokeWidth="1.8"
              />
              {/* Waterproof black zipper */}
              <Line x1="78" y1="88" x2="78" y2="138" stroke="#111827" strokeWidth="2.5" />
              {/* Zipper pull */}
              <Rect x="76.5" y="102" width="3" height="6" rx="1.5" fill="#E5E7EB" />
              {/* High storm collar */}
              <Path d="M 64,87 C 72,93 84,93 92,87" fill="none" stroke="#C2410C" strokeWidth="2" />
            </G>
          )}

          {/* 6. Chameleon Head with Rounded Friendly Snout */}
          <Ellipse
            cx="78"
            cy="58"
            rx="36"
            ry="29"
            fill="url(#melBody)"
            stroke="#1B4D1F"
            strokeWidth="2.2"
          />

          {/* Soft friendly cheek blushes */}
          <Ellipse cx="50" cy="68" rx="5.5" ry="3.5" fill="#A7E468" opacity="0.85" />
          <Ellipse cx="106" cy="68" rx="5.5" ry="3.5" fill="#A7E468" opacity="0.85" />

          {/* 7. Big Expressive Cartoon Eyes (#1E88E5 iris + white specular highlight) */}
          {/* Left Eye Turret */}
          <Circle cx="56" cy="52" r="14.5" fill="#58B947" stroke="#1B4D1F" strokeWidth="2" />
          <Circle cx="57" cy="52" r="11" fill="#FFFFFF" />
          <Circle cx="58" cy="53" r="6.8" fill="url(#melEyeIris)" />
          <Circle cx="58" cy="53" r="3.6" fill="#0D253A" />
          {/* Specular highlights */}
          <Circle cx="55.5" cy="50" r="2.4" fill="#FFFFFF" />
          <Circle cx="60.5" cy="55.5" r="1.2" fill="#FFFFFF" />

          {/* Right Eye Turret */}
          <Circle cx="100" cy="52" r="14.5" fill="#58B947" stroke="#1B4D1F" strokeWidth="2" />
          <Circle cx="99" cy="52" r="11" fill="#FFFFFF" />
          <Circle cx="98" cy="53" r="6.8" fill="url(#melEyeIris)" />
          <Circle cx="98" cy="53" r="3.6" fill="#0D253A" />
          {/* Specular highlights */}
          <Circle cx="95.5" cy="50" r="2.4" fill="#FFFFFF" />
          <Circle cx="100.5" cy="55.5" r="1.2" fill="#FFFFFF" />

          {/* 8. Friendly Wide Smile */}
          <Path
            d="M 67,73 C 74,80 82,80 89,73"
            fill="none"
            stroke="#1B4D1F"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          {/* Dimple corners */}
          <Path d="M 66,71 C 66,73 68,74 69,73" fill="none" stroke="#1B4D1F" strokeWidth="2" strokeLinecap="round" />
          <Path d="M 90,71 C 90,73 88,74 87,73" fill="none" stroke="#1B4D1F" strokeWidth="2" strokeLinecap="round" />

          {/* 9. Left Arm Resting */}
          <Path
            d="M 44,104 C 34,108 30,122 36,128 C 40,132 46,126 48,118"
            fill="url(#melBody)"
            stroke="#1B4D1F"
            strokeWidth="2"
          />

          {/* 10. Right Arm (Static or Animated Wave) */}
          {!waving && (
            <Path
              d="M 112,104 C 122,108 126,122 120,128 C 116,132 110,126 108,118"
              fill="url(#melBody)"
              stroke="#1B4D1F"
              strokeWidth="2"
            />
          )}
        </Svg>

        {/* Waving Animated Arm */}
        {waving && (
          <Animated.View style={[styles.waveArmContainer, waveArmAnimatedStyle]}>
            <Svg width={36} height={24} viewBox="0 0 36 24">
              <Path
                d="M 4,18 C 14,8 24,4 32,8 C 36,10 34,18 28,18 C 22,18 14,20 4,22 Z"
                fill="#58B947"
                stroke="#1B4D1F"
                strokeWidth="2"
              />
              <Circle cx="30" cy="11" r="2.5" fill="#D4F69B" />
            </Svg>
          </Animated.View>
        )}
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

  const label = useMemo(
    () => (variant === 'rain_active' ? 'Mel · Weather Alert' : 'Mel · Stylist Note'),
    [variant]
  );

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
  waveArmContainer: {
    position: 'absolute',
    right: 8,
    top: 86,
    width: 36,
    height: 24,
    transformOrigin: 'left center',
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
