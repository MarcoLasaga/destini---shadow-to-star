import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Line, Path, Rect } from 'react-native-svg';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { OutfitClothingItem, UserProfile } from '../types';

export type MannequinSlot = 'TOP' | 'OUTERWEAR' | 'BOTTOM' | 'SHOES' | 'ACCESSORIES';
type Props = { profile?: Partial<UserProfile> | null; items?: OutfitClothingItem[]; activeSlot?: MannequinSlot | null; onSelectSlot?: (slot: MannequinSlot) => void; compact?: boolean };

const slotForItem = (item: OutfitClothingItem) => item.slotType === 'outerLayer' ? 'OUTERWEAR' : item.slotType === 'bottom' ? 'BOTTOM' : item.slotType === 'shoes' ? 'SHOES' : item.slotType === 'accessory' ? 'ACCESSORIES' : 'TOP';
const color = (item?: OutfitClothingItem, fallback = '#8BAA82') => item?.primaryColor || item?.hexColor || fallback;
const nameOf = (item?: OutfitClothingItem) => (item?.name || '').toLowerCase();

function Garment({ item, slot, build, active }: { item?: OutfitClothingItem; slot: MannequinSlot; build: number; active: boolean }) {
  const fill = color(item, slot === 'SHOES' ? '#3B414B' : '#6B8E72'); const second = item?.secondaryColor || (slot === 'BOTTOM' ? '#5D6672' : '#F3E7CF'); const n = nameOf(item); const accent = active ? '#F07E57' : '#264C3B';
  if (slot === 'TOP') {
    if (/polo/.test(n)) return <G><Path d={`M78 180 L108 165 L132 176 L150 165 L178 180 L164 260 L92 260 Z`} fill={fill} stroke={accent} strokeWidth="2" /><Path d="M108 165l24 32 18-32" fill="none" stroke={second} strokeWidth="5" /><Line x1="130" y1="197" x2="130" y2="242" stroke={second} strokeWidth="2" /></G>;
    if (/button|oxford|shirt/.test(n)) return <G><Path d="M80 180 L111 164 L130 183 L150 164 L180 180 L166 264 L94 264 Z" fill={fill} stroke={accent} strokeWidth="2" /><Path d="M111 164l19 19 20-19M130 183v78" fill="none" stroke={second} strokeWidth="3" /><Circle cx="130" cy="205" r="2" fill={second} /><Circle cx="130" cy="225" r="2" fill={second} /></G>;
    return <G><Path d={`M78 180 L109 166 L130 182 L151 166 L182 180 L166 266 L94 266 Z`} fill={fill} stroke={accent} strokeWidth="2" /><Path d="M110 167l20 18 20-18" fill="none" stroke={second} strokeWidth="3" /></G>;
  }
  if (slot === 'OUTERWEAR') {
    if (/hoodie|zip/.test(n)) return <G><Path d="M79 177 Q130 139 181 177 L190 272 L70 272 Z" fill={fill} stroke={accent} strokeWidth="2" /><Path d="M96 177 Q130 143 164 177" fill="none" stroke={second} strokeWidth="11" /><Path d="M130 184v83M100 235h60v28H100z" fill="none" stroke={second} strokeWidth="3" /><Line x1="116" y1="157" x2="112" y2="180" stroke={second} strokeWidth="2" /><Line x1="144" y1="157" x2="148" y2="180" stroke={second} strokeWidth="2" /></G>;
    if (/blazer|suit/.test(n)) return <G><Path d="M79 180 L108 164 L130 184 L152 164 L181 180 L170 273 L90 273 Z" fill={fill} stroke={accent} strokeWidth="2" /><Path d="M108 165l22 19 22-19M130 184v83M130 199l-20 24h40z" fill="none" stroke={second} strokeWidth="3" /></G>;
    return <Path d="M76 178 L108 164 L130 184 L152 164 L184 178 L171 274 L89 274 Z" fill={fill} stroke={accent} strokeWidth="2" />;
  }
  if (slot === 'BOTTOM') {
    if (/skirt/.test(n)) return <Path d="M96 263h68l27 108H69z" fill={fill} stroke={accent} strokeWidth="2" />;
    if (/short/.test(n)) return <G><Path d="M97 260h33v79H90zM130 260h33l7 79h-40z" fill={fill} stroke={accent} strokeWidth="2" /><Line x1="130" y1="265" x2="130" y2="330" stroke={second} strokeWidth="2" /></G>;
    return <G><Path d={`M96 260h35v${102 + build * 8}H${86 - build * 3}z`} fill={fill} stroke={accent} strokeWidth="2" /><Path d={`M130 260h35v${102 + build * 8}h${10 + build * 3}L165 260z`} fill={fill} stroke={accent} strokeWidth="2" /><Line x1="130" y1="267" x2="130" y2="300" stroke={second} strokeWidth="2" /></G>;
  }
  if (slot === 'SHOES') return <G><Path d="M87 410l39 1 11 25H74q-9-3 13-26z" fill={fill} stroke={accent} strokeWidth="2" /><Path d="M134 411l31-2 29 23q4 5-4 6h-61z" fill={fill} stroke={accent} strokeWidth="2" /><Line x1="91" y1="420" x2="119" y2="420" stroke={second} strokeWidth="3" /><Line x1="153" y1="420" x2="176" y2="425" stroke={second} strokeWidth="3" /></G>;
  if (/sunglass/.test(n)) return <G><Path d="M101 92h25l-2 15h-18zM134 92h25l-5 15h-18z" fill={fill} stroke={accent} strokeWidth="2" /><Line x1="126" y1="97" x2="134" y2="97" stroke={accent} strokeWidth="2" /></G>;
  if (/watch/.test(n)) return <Rect x="164" y="235" width="15" height="21" rx="4" fill={fill} stroke={accent} strokeWidth="2" />;
  return <G><Circle cx="130" cy="194" r="30" fill="none" stroke={fill} strokeWidth="4" /><Path d="M100 194q30 18 60 0" fill="none" stroke={second} strokeWidth="2" /></G>;
}

export default function Mannequin2D({ profile, items = [], activeSlot, onSelectSlot, compact = false }: Props) {
  const gender = profile?.gender || 'female'; const height = Math.min(195, Math.max(145, Number(profile?.heightCm) || 170)); const weight = Math.min(110, Math.max(42, Number(profile?.weightKg) || 65)); const build = Math.max(-1, Math.min(1, (weight - 65) / 30)); const fit = (profile?.fitPreference || '').toLowerCase(); const fitScale = fit.includes('baggy') || fit.includes('oversized') ? 1.1 : fit.includes('slim') || fit.includes('tailored') ? 0.93 : 1; const heightScale = 0.88 + ((height - 145) / 50) * 0.24; const shoulder = gender === 'male' ? 1.08 : 0.96; const hair = gender === 'male' ? '#2E2A34' : '#4A2F2A';
  const bySlot = useMemo(() => Object.fromEntries(items.map((item) => [slotForItem(item), item])) as Partial<Record<MannequinSlot, OutfitClothingItem>>, [items]);
  const bodyWidth = 1 + build * 0.12; const bodyHeight = compact ? 0.9 : 1;
  const zones: Array<{ slot: MannequinSlot; top: number; left: number; width: number; height: number }> = [{ slot: 'ACCESSORIES', top: 44, left: 26, width: 48, height: 45 }, { slot: 'TOP', top: 118, left: 24, width: 54, height: 86 }, { slot: 'OUTERWEAR', top: 104, left: 18, width: 64, height: 110 }, { slot: 'BOTTOM', top: 202, left: 25, width: 54, height: 126 }, { slot: 'SHOES', top: 322, left: 25, width: 54, height: 52 }];
  return <Animated.View entering={FadeIn.duration(260)} style={[styles.wrap, compact && styles.compact]}><Svg width="100%" height="100%" viewBox="0 0 240 470" preserveAspectRatio="xMidYMid meet"><G transform={`translate(120 0) scale(${bodyWidth * shoulder} ${heightScale * bodyHeight}) translate(-120 0)`}>
    <Ellipse cx="130" cy="92" rx="31" ry="37" fill="#B7D69C" stroke="#264C3B" strokeWidth="2" />{gender === 'female' ? <Path d="M97 87Q95 35 131 32q37 4 34 57l-12-24q-15 12-43 3z" fill={hair} stroke="#264C3B" strokeWidth="2" /> : <Path d="M100 65q10-35 31-34 24 0 33 34l-9-9q-18 9-43 0z" fill={hair} stroke="#264C3B" strokeWidth="2" />}
    <Circle cx="119" cy="88" r="3.5" fill="#2C72A8" /><Circle cx="143" cy="88" r="3.5" fill="#2C72A8" /><Path d="M121 105q9 7 18 0" fill="none" stroke="#264C3B" strokeWidth="2" />
    <Path d={`M${92 - build * 5} 140q38-25 ${76 + build * 14} 0l-11 93q-27 ${12 + build * 3} -54 0z`} fill="#B7D69C" stroke="#264C3B" strokeWidth="2" /><Path d={`M${103 - build * 4} 226l-12 155h27l12-155zM${130 + build * 2} 226l12 155h27l-12-155z`} fill="#B7D69C" stroke="#264C3B" strokeWidth="2" />
    <Path d={`M96 143l-28 14-16 84 20 3 20-58M164 143l28 14 16 84-20 3-20-58`} fill="#B7D69C" stroke="#264C3B" strokeWidth="2" />
    <G transform={`translate(130 250) scale(${fitScale}) translate(-130 -250)`}>{(['TOP', 'OUTERWEAR', 'BOTTOM', 'SHOES', 'ACCESSORIES'] as MannequinSlot[]).map((slot) => <Garment key={slot} item={bySlot[slot]} slot={slot} build={build} active={activeSlot === slot} />)}</G>
  </G></Svg>{zones.map((zone) => <Pressable key={zone.slot} accessibilityLabel={`Select ${zone.slot.toLowerCase()}`} onPress={() => onSelectSlot?.(zone.slot)} style={[styles.zone, { top: `${zone.top / 4.7}%`, left: `${zone.left}%`, width: `${zone.width}%`, height: `${zone.height / 4.7}%` }, activeSlot === zone.slot && styles.zoneActive]} />)}<View style={styles.caption}><Text style={styles.captionText}>{gender === 'male' ? 'Your tailored silhouette' : 'Your personal silhouette'} · {height} cm</Text></View></Animated.View>;
}
const styles = StyleSheet.create({ wrap: { width: '100%', height: 430, alignItems: 'center', justifyContent: 'center', position: 'relative' }, compact: { height: 300 }, zone: { position: 'absolute', borderRadius: 20 }, zoneActive: { borderWidth: 2, borderColor: '#F07E57', backgroundColor: 'rgba(240,126,87,0.10)' }, caption: { position: 'absolute', bottom: 2, alignSelf: 'center' }, captionText: { color: '#758378', fontSize: 10, fontWeight: '700' } });
