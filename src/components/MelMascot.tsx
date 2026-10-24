import React, { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

export type MelOutfit = 'casual_sunny' | 'cool_hoodie' | 'smart_layered' | 'formal_suit' | 'rain_active';
export type MelBubblePosition = 'top-left' | 'bottom-right';
type Props = { outfit?: MelOutfit; size?: number; waving?: boolean; onPress?: () => void };
const outfitCopy: Record<MelOutfit, { top: string; bottom: string; shoe: string }> = {
  casual_sunny: { top: '#F8E7C4', bottom: '#6F7D46', shoe: '#F4F1E8' }, cool_hoodie: { top: '#7660A7', bottom: '#303746', shoe: '#F1F0EA' }, smart_layered: { top: '#5A82A7', bottom: '#C9B17D', shoe: '#8D5C3D' }, formal_suit: { top: '#1B2E53', bottom: '#1B2E53', shoe: '#432033' }, rain_active: { top: '#F47B35', bottom: '#203B63', shoe: '#E9E7DF' },
};

export function MelMascot({ outfit = 'casual_sunny', size = 150, waving = false, onPress }: Props) {
  const palette = outfitCopy[outfit]; const bob = useSharedValue(0); const wave = useSharedValue(0);
  useEffect(() => { bob.value = withRepeat(withSequence(withTiming(-3, { duration: 900, easing: Easing.inOut(Easing.quad) }), withTiming(0, { duration: 900, easing: Easing.inOut(Easing.quad) })), -1, false); wave.value = withRepeat(withSequence(withTiming(waving ? -18 : 0, { duration: 260 }), withTiming(waving ? 8 : 0, { duration: 260 }), withTiming(0, { duration: 260 })), waving ? -1 : 0, false); }, [bob, wave, waving]);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ translateY: bob.value }] })); const armStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${wave.value}deg` }] }));
  return <Pressable onPress={onPress} disabled={!onPress} accessibilityLabel="Mel, your StyleSense chameleon stylist"><Animated.View style={[{ width: size, height: size * 1.18 }, animatedStyle]}><Svg width={size} height={size * 1.18} viewBox="0 0 150 176">
    <Path d="M118 144c25 10 28 27 9 28-14 1-20-8-11-15 9-7 20-1 22 5" fill="none" stroke="#4D9A65" strokeWidth="8" strokeLinecap="round" /><Ellipse cx="76" cy="138" rx="38" ry="13" fill="#3F8058" />
    <Rect x="47" y="105" width="59" height="48" rx="20" fill={palette.top} stroke="#24513B" strokeWidth="2" />{outfit === 'smart_layered' && <Rect x="43" y="104" width="15" height="45" rx="5" fill="#F8E7C4" />}{outfit === 'formal_suit' && <G><Path d="M75 108l8 18 8-18" fill="white" stroke="#DCE4EE" strokeWidth="2" /><Path d="M75 115l8 6 8-6-4 11h-8z" fill="#8E3047" /></G>}
    <Path d="M50 148h52l-4 24H54z" fill={palette.bottom} stroke="#24513B" strokeWidth="2" /><Path d="M60 169l-4 5h-15c-3 0-4-4-1-6l12-6zM88 169l4 5h15c3 0 4-4 1-6l-12-6z" fill={palette.shoe} stroke="#24513B" strokeWidth="2" />
    <Ellipse cx="76" cy="74" rx="38" ry="35" fill="#70B86E" stroke="#24513B" strokeWidth="2" /><Path d="M52 53c3-20 15-30 25-35 7 15 18 17 28 20-10 5-17 11-22 21z" fill="#4D9A65" stroke="#24513B" strokeWidth="2" /><Path d="M44 80c-25 5-27 20-12 25 11 4 20-5 12-13-6-6-14-3-17 2" fill="none" stroke="#70B86E" strokeWidth="8" strokeLinecap="round" />
    <Circle cx="61" cy="75" r="12" fill="white" stroke="#24513B" strokeWidth="2" /><Circle cx="91" cy="75" r="12" fill="white" stroke="#24513B" strokeWidth="2" /><Circle cx="64" cy="77" r="5" fill="#2D84C6" /><Circle cx="88" cy="77" r="5" fill="#2D84C6" /><Path d="M68 96c6 5 12 5 18 0" fill="none" stroke="#24513B" strokeWidth="2.5" strokeLinecap="round" /><Circle cx="49" cy="91" r="4" fill="#A8D47E" /><Circle cx="103" cy="91" r="4" fill="#A8D47E" />
  </Svg><Animated.View style={[styles.waveArm, armStyle]} /></Animated.View></Pressable>;
}

export function MelSpeechBubble({ variant = 'casual_sunny', message, onTapNextTip, position = 'top-left' }: { variant?: MelOutfit; message: string; onTapNextTip?: () => void; position?: MelBubblePosition }) {
  const scale = useSharedValue(0.98); useEffect(() => { scale.value = withRepeat(withSequence(withTiming(1, { duration: 500 }), withTiming(0.98, { duration: 500 })), -1, true); }, [scale]); const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] })); const label = useMemo(() => variant === 'rain_active' ? 'Mel · weather alert' : 'Mel · your stylist', [variant]);
  return <Pressable onPress={onTapNextTip} disabled={!onTapNextTip} style={[styles.bubbleWrap, position === 'bottom-right' ? styles.bottomRight : styles.topLeft]}><Animated.View style={[styles.bubble, animatedStyle]}><Text style={styles.bubbleLabel}>{label}</Text><Text style={styles.bubbleText}>{message}</Text>{!!onTapNextTip && <Text style={styles.tapHint}>Tap for another tip</Text>}</Animated.View></Pressable>;
}
const styles = StyleSheet.create({ waveArm: { position: 'absolute', right: 18, top: 70, width: 23, height: 8, borderRadius: 8, backgroundColor: '#70B86E', transformOrigin: 'left center' }, bubbleWrap: { position: 'absolute', zIndex: 2, maxWidth: 245 }, topLeft: { top: 8, left: 8 }, bottomRight: { right: 94, bottom: 10 }, bubble: { backgroundColor: '#FFFDF7', borderColor: '#24513B', borderWidth: 1.5, borderRadius: 18, paddingHorizontal: 13, paddingVertical: 11, shadowColor: '#24513B', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3 }, bubbleLabel: { color: '#4D9A65', fontSize: 10, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 3 }, bubbleText: { color: '#21352B', fontSize: 13, lineHeight: 18, fontWeight: '600' }, tapHint: { color: '#7D8A80', fontSize: 10, marginTop: 6 } });
