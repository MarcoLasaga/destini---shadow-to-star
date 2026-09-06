import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme } from '../hooks/useAppTheme';
import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '../contexts/ProfileContext';

type Choice = { id: string; label: string; note: string };
const STYLES: Choice[] = [
  { id: 'casual', label: 'Easy & casual', note: 'Relaxed, everyday pieces' },
  { id: 'minimal', label: 'Clean & minimal', note: 'Simple, considered outfits' },
  { id: 'streetwear', label: 'Streetwear', note: 'Statement layers and sneakers' },
  { id: 'classic', label: 'Classic', note: 'Timeless shapes and polish' },
  { id: 'creative', label: 'Creative', note: 'Colour, texture, and play' },
  { id: 'romantic', label: 'Soft & romantic', note: 'Feminine details and flow' },
];
const COLORS: Choice[] = [
  { id: 'neutrals', label: 'Neutrals', note: 'Black, white, beige' },
  { id: 'earth', label: 'Earth tones', note: 'Olive, rust, brown' },
  { id: 'pastels', label: 'Soft pastels', note: 'Powder blue, blush, lilac' },
  { id: 'bold', label: 'Bold colour', note: 'Bright, confident accents' },
];
const OCCASIONS: Choice[] = [
  { id: 'everyday', label: 'Everyday dressing', note: 'Make getting dressed easier' },
  { id: 'work', label: 'Work & school', note: 'Look put-together on repeat' },
  { id: 'weekend', label: 'Weekends & going out', note: 'More ideas for your free time' },
];

export default function OnboardingScreen({ onComplete }: { onComplete: () => void }) {
  const theme = useAppTheme();
  const navigation = useNavigation<any>();
  const { isLoggedIn } = useAuth();
  const { updateProfile } = useProfile();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [stylePrefs, setStylePrefs] = useState<string[]>([]);
  const [colors, setColors] = useState<string[]>([]);
  const [occasion, setOccasion] = useState('');

  const firstName = name.trim() || 'friend';
  const lastStep = 5;
  const canContinue = step === 0 || (step === 1 ? !!name.trim() : step === 2 ? stylePrefs.length > 0 : step === 3 ? colors.length > 0 : step === 4 ? !!occasion : true);

  const toggle = (id: string, setValues: React.Dispatch<React.SetStateAction<string[]>>) => {
    setValues(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  };

  const finish = async () => {
    await AsyncStorage.multiSet([
      ['stylesense_onboarding_complete', 'true'],
      ['stylesense_onboarding_profile', JSON.stringify({ name: name.trim(), styles: stylePrefs, colors, occasion })],
    ]);
    if (isLoggedIn && name.trim()) {
      await updateProfile({ firstName: name.trim(), displayName: name.trim() });
    }
    onComplete();
    navigation.reset({ index: 0, routes: [{ name: isLoggedIn ? 'MainTabs' : 'Login' }] });
  };

  const next = () => {
    if (!canContinue) return;
    if (step === lastStep) { finish(); return; }
    setStep(current => current + 1);
  };

  const back = () => setStep(current => Math.max(0, current - 1));

  const intro = (eyebrow: string, title: string, body: string, icon: keyof typeof Ionicons.glyphMap) => (
    <View style={styles.intro}>
      <View style={[styles.iconBubble, { backgroundColor: theme.primaryAccent }]}><Ionicons name={icon} size={22} color={theme.secondaryAccent} /></View>
      <Text style={[styles.eyebrow, { color: theme.secondaryAccent }]}>{eyebrow}</Text>
      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      <Text style={[styles.body, { color: theme.textMuted }]}>{body}</Text>
    </View>
  );

  const choices = (items: Choice[], selected: string[], setSelected: React.Dispatch<React.SetStateAction<string[]>>) => (
    <View style={styles.choiceGrid}>{items.map(item => {
      const active = selected.includes(item.id);
      return <Pressable key={item.id} onPress={() => toggle(item.id, setSelected)} style={[styles.choice, { backgroundColor: active ? '#F0EDF8' : theme.surface, borderColor: active ? theme.secondaryAccent : theme.border }]}>
        <View style={[styles.check, { borderColor: active ? theme.secondaryAccent : theme.border, backgroundColor: active ? theme.secondaryAccent : 'transparent' }]}>{active && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}</View>
        <View style={styles.choiceCopy}><Text style={[styles.choiceLabel, { color: theme.text }]}>{item.label}</Text><Text style={[styles.choiceNote, { color: theme.textMuted }]}>{item.note}</Text></View>
      </Pressable>;
    })}</View>
  );

  return <KeyboardAvoidingView style={[styles.container, { backgroundColor: theme.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={styles.header}><View style={styles.brand}><View style={[styles.brandMark, { backgroundColor: theme.primaryAccent }]}><Text style={styles.brandMarkText}>S</Text></View><Text style={[styles.brandText, { color: theme.text }]}>Style<Text style={{ color: theme.secondaryAccent }}>Sense</Text></Text></View>{step > 0 && step < lastStep && <Pressable onPress={finish}><Text style={[styles.skip, { color: theme.textMuted }]}>Skip for now</Text></Pressable>}</View>
    <View style={[styles.progressTrack, { backgroundColor: theme.border }]}><View style={[styles.progress, { width: `${((step + 1) / 6) * 100}%`, backgroundColor: theme.secondaryAccent }]} /></View>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      {step === 0 && <><LinearGradient colors={['#E7DEF4', '#FFF4D7']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.welcomeVisual}><Ionicons name="shirt-outline" size={54} color={theme.secondaryAccent} /><View style={styles.sparkle}><Ionicons name="sparkles" size={18} color={theme.secondaryAccent} /></View></LinearGradient>{intro('Welcome to StyleSense', 'Let’s make getting dressed feel easy.', 'A little about your style helps us turn your wardrobe into outfits you’ll actually want to wear.', 'sparkles')}</>}
      {step === 1 && <>{intro('First things first', 'What should we call you?', 'Your StyleSense space should feel personal from the very beginning.', 'person-outline')}<View style={styles.field}><Text style={[styles.fieldLabel, { color: theme.text }]}>Your name</Text><TextInput autoFocus value={name} onChangeText={setName} placeholder="e.g. Alex" placeholderTextColor={theme.textMuted} style={[styles.input, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]} /></View></>}
      {step === 2 && <>{intro('Your style, your way', `What feels most like you, ${firstName}?`, 'Pick as many as you like. There are no wrong answers here.', 'heart-outline')}{choices(STYLES, stylePrefs, setStylePrefs)}</>}
      {step === 3 && <>{intro('A little colour context', 'What colours do you reach for?', 'We’ll use this to make recommendations feel more like your wardrobe.', 'color-palette-outline')}{choices(COLORS, colors, setColors)}</>}
      {step === 4 && <>{intro('One last thing', 'Where do you need the most outfit help?', 'We’ll start your feed with ideas that fit your real life.', 'sunny-outline')}<View style={styles.choiceGrid}>{OCCASIONS.map(item => { const active = occasion === item.id; return <Pressable key={item.id} onPress={() => setOccasion(item.id)} style={[styles.choice, { backgroundColor: active ? '#F0EDF8' : theme.surface, borderColor: active ? theme.secondaryAccent : theme.border }]}><View style={[styles.check, { borderColor: active ? theme.secondaryAccent : theme.border, backgroundColor: active ? theme.secondaryAccent : 'transparent' }]}>{active && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}</View><View style={styles.choiceCopy}><Text style={[styles.choiceLabel, { color: theme.text }]}>{item.label}</Text><Text style={[styles.choiceNote, { color: theme.textMuted }]}>{item.note}</Text></View></Pressable>; })}</View></>}
      {step === 5 && <><View style={[styles.demoPill, { backgroundColor: theme.primaryAccent }]}><Ionicons name="sparkles" size={15} color={theme.secondaryAccent} /><Text style={[styles.demoPillText, { color: theme.secondaryAccent }]}>Your first StyleSense moment</Text></View>{intro('Your style profile is ready', `${firstName}, meet your new outfit shortcut.`, 'StyleSense will learn as you wear, save, and add pieces. Here’s what your daily view can look like.', 'sparkles')}<View style={styles.demoCard}><View style={styles.demoCopy}><Text style={styles.demoOverline}>MONDAY · {occasion === 'work' ? 'WORK' : 'YOUR DAY'}</Text><Text style={styles.demoTitle}>Easy layers{`\n`}with a little polish.</Text><Text style={styles.demoNote}>Built around your {stylePrefs[0] || 'everyday'} style</Text></View><View style={styles.outfitArt}><View style={styles.topArt} /><View style={styles.bottomArt} /><View style={styles.shoeArt} /></View></View><Text style={[styles.helper, { color: theme.textMuted }]}><Ionicons name="checkmark-circle" size={15} color={theme.secondaryAccent} /> You can change these preferences any time.</Text></>}
    </ScrollView>
    <View style={[styles.footer, { borderTopColor: theme.border }]}>{step > 0 ? <Pressable onPress={back} style={styles.backButton}><Ionicons name="arrow-back" size={18} color={theme.textMuted} /><Text style={[styles.backText, { color: theme.textMuted }]}>Back</Text></Pressable> : <View />}{step > 0 && step < lastStep && <Text style={[styles.stepText, { color: theme.textMuted }]}>{step} of 4</Text>}<Pressable onPress={next} disabled={!canContinue} style={[styles.nextButton, { backgroundColor: theme.secondaryAccent, opacity: canContinue ? 1 : .45 }]}><Text style={styles.nextText}>{step === 0 ? 'Let’s get started' : step === lastStep ? 'Enter StyleSense' : 'Continue'}</Text><Ionicons name="arrow-forward" size={18} color="#FFFFFF" /></Pressable></View>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  container: { flex: 1 }, header: { height: 70, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, brand: { flexDirection: 'row', alignItems: 'center', gap: 9 }, brandMark: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }, brandMarkText: { fontSize: 18, fontWeight: '900', color: '#2B1F0E' }, brandText: { fontSize: 20, fontWeight: '800' }, skip: { fontSize: 13, textDecorationLine: 'underline' }, progressTrack: { height: 4, marginHorizontal: 20, borderRadius: 99, overflow: 'hidden' }, progress: { height: 4, borderRadius: 99 }, content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 28 }, intro: { alignItems: 'center', marginBottom: 25 }, iconBubble: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }, eyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10 }, title: { fontSize: 33, fontWeight: '900', lineHeight: 37, textAlign: 'center', marginBottom: 11 }, body: { fontSize: 15, lineHeight: 23, textAlign: 'center', maxWidth: 390 }, welcomeVisual: { width: 150, height: 150, borderRadius: 42, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginBottom: 28, transform: [{ rotate: '-5deg' }] }, sparkle: { position: 'absolute', right: 18, top: 19, transform: [{ rotate: '5deg' }] }, field: { width: '100%', maxWidth: 390, alignSelf: 'center', gap: 7 }, fieldLabel: { fontSize: 13, fontWeight: '700', marginLeft: 3 }, input: { height: 56, borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, fontSize: 17 }, choiceGrid: { gap: 10, maxWidth: 560, width: '100%', alignSelf: 'center' }, choice: { minHeight: 68, borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }, check: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' }, choiceCopy: { flex: 1, gap: 1 }, choiceLabel: { fontSize: 15, fontWeight: '800' }, choiceNote: { fontSize: 12, lineHeight: 16 }, demoPill: { alignSelf: 'center', borderRadius: 99, paddingHorizontal: 12, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 18 }, demoPillText: { fontSize: 11, fontWeight: '800', letterSpacing: .5 }, demoCard: { minHeight: 170, borderRadius: 20, padding: 20, backgroundColor: '#2B1F0E', flexDirection: 'row', justifyContent: 'space-between', overflow: 'hidden' }, demoCopy: { flex: 1, gap: 7, zIndex: 1 }, demoOverline: { color: '#FFD586', fontSize: 10, fontWeight: '800', letterSpacing: 1 }, demoTitle: { color: '#FFFDF9', fontSize: 23, fontWeight: '900', lineHeight: 25 }, demoNote: { color: '#D9CBB9', fontSize: 12 }, outfitArt: { width: 105, position: 'relative' }, topArt: { position: 'absolute', width: 56, height: 66, top: 4, left: 24, borderRadius: 20, backgroundColor: '#E8DFF5', transform: [{ rotate: '-4deg' }] }, bottomArt: { position: 'absolute', width: 58, height: 54, top: 65, left: 24, backgroundColor: '#FFD586' }, shoeArt: { position: 'absolute', width: 43, height: 10, bottom: 4, left: 31, borderRadius: 10, backgroundColor: '#FFFDF9' }, helper: { textAlign: 'center', fontSize: 12, marginTop: 15 }, footer: { minHeight: 82, borderTopWidth: 1, marginHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, backButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 12 }, backText: { fontSize: 14, fontWeight: '700' }, stepText: { fontSize: 12 }, nextButton: { borderRadius: 99, paddingHorizontal: 17, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', gap: 8 }, nextText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
});
