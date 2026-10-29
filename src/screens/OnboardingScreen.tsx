import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../hooks/useAppTheme';
import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '../contexts/ProfileContext';
import { syncCreatorNickname } from '../services/communityService';
import { MelMascot, MelSpeechBubble } from '../components/MelMascot';

type SkinUndertone = 'Warm' | 'Cool' | 'Neutral';

interface OnboardingScreenProps {
  onComplete: () => void;
  onNavigateToLogin?: () => void;
}

interface PaletteOption {
  id: string;
  name: string;
  description: string;
  colors: string[];
  matchedUndertones: SkinUndertone[];
}

const CIELAB_PALETTES: PaletteOption[] = [
  {
    id: 'monochrome',
    name: 'Monochrome & Achromatic',
    description: 'Low-chroma ΔE neutral anchor',
    colors: ['#18181B', '#52525B', '#D4D4D8', '#FAFAFA'],
    matchedUndertones: ['Neutral'],
  },
  {
    id: 'warm_earth',
    name: 'Warm Earth & Neutrals',
    description: 'Positive +b* warm harmony',
    colors: ['#C8AD8D', '#5C4033', '#556B2F', '#F5F0E6'],
    matchedUndertones: ['Warm'],
  },
  {
    id: 'cool_deep',
    name: 'Cool Deep & Classic',
    description: 'Negative -b* cool contrast',
    colors: ['#1B2A4A', '#36454F', '#6B7C93', '#F8FAFC'],
    matchedUndertones: ['Cool'],
  },
  {
    id: 'soft_pastel',
    name: 'Soft Pastel & High-Key',
    description: 'High-lightness L* > 75 tint harmony',
    colors: ['#D8C8E8', '#F4C2C2', '#B8D8BA', '#FDFBF7'],
    matchedUndertones: [],
  },
];

const AGE_BRACKETS: Array<{
  id: '18-20' | '21-24' | '25+';
  range: string;
  title: string;
  subtitle: string;
  tags: string[];
  icon: string;
}> = [
  {
    id: '18-20',
    range: '18 – 20',
    title: 'Early College & Campus',
    subtitle: 'Campus lectures, orgs & casual hangouts',
    tags: ['#CampusStyle', '#EverydayCasual'],
    icon: 'school-outline',
  },
  {
    id: '21-24',
    range: '21 – 24',
    title: 'Upperclassmen & Fresh Grads',
    subtitle: 'Thesis defense, internships & first job',
    tags: ['#SmartCasual', '#InternshipFit'],
    icon: 'briefcase-outline',
  },
  {
    id: '25+',
    range: '25+',
    title: 'Young Professionals',
    subtitle: 'Office tailoring, career & weekend versatility',
    tags: ['#OfficeSmart', '#Minimalist'],
    icon: 'ribbon-outline',
  },
];

const TEXTURE_OPTIONS = [
  { label: 'Soft Cotton', icon: 'cloud-outline' },
  { label: 'Cozy Knit', icon: 'shirt-outline' },
  { label: 'Rough & Denim', icon: 'layers-outline' },
  { label: 'Smooth Silk', icon: 'sparkles-outline' },
  { label: 'Structured & Crisp', icon: 'shield-checkmark-outline' },
  { label: 'Breathable Linen', icon: 'leaf-outline' },
];

const STYLE_OPTIONS = [
  { label: 'Casual Everyday', icon: 'walk-outline' },
  { label: 'Streetwear', icon: 'bicycle-outline' },
  { label: 'Minimalist', icon: 'ellipse-outline' },
  { label: 'Formal & Smart', icon: 'briefcase-outline' },
  { label: 'Vintage & Retro', icon: 'film-outline' },
  { label: 'Sporty Active', icon: 'fitness-outline' },
];

const OCCASION_OPTIONS = [
  { label: 'School / Campus', emoji: '🎓' },
  { label: 'Work / Office', emoji: '💼' },
  { label: 'Casual Hangouts', emoji: '☕' },
  { label: 'Parties & Events', emoji: '✨' },
  { label: 'Workout & Gym', emoji: '🏃' },
  { label: 'Formal Dinners', emoji: '🥂' },
];

const FIT_OPTIONS = [
  {
    id: 'Baggy / Oversized',
    title: 'Baggy',
    description: 'Relaxed drape',
    icon: 'resize-outline',
  },
  {
    id: 'Regular / Relaxed Fit',
    title: 'Regular',
    description: 'Everyday comfort',
    icon: 'body-outline',
  },
  {
    id: 'Slim / Tailored Fit',
    title: 'Slim',
    description: 'Clean contour',
    icon: 'cut-outline',
  },
];

const UNDERTONE_OPTIONS: Array<{ id: SkinUndertone; label: string; desc: string }> = [
  { id: 'Warm', label: 'Warm (+b*)', desc: 'Earth & golden tones' },
  { id: 'Neutral', label: 'Neutral', desc: 'Balanced monochrome' },
  { id: 'Cool', label: 'Cool (-b*)', desc: 'Navy & slate tones' },
];

export default function OnboardingScreen({
  onComplete,
  onNavigateToLogin,
}: OnboardingScreenProps) {
  const theme = useAppTheme();
  const { isLoggedIn } = useAuth();
  const { profile, updateProfile } = useProfile();

  // 6 Zero-Scroll Steps (0 to 5)
  const [page, setPage] = useState<number>(0);
  const totalPages = 6;

  // Form State (55% Content-Based + 45% Collaborative Hybrid Engine inputs)
  const [ageGroup, setAgeGroup] = useState<'18-20' | '21-24' | '25+'>('18-20');
  const [gender, setGender] = useState<'male' | 'female'>('female');
  const [heightCm, setHeightCm] = useState<string>('168');
  const [weightKg, setWeightKg] = useState<string>('58');
  const [undertone, setUndertone] = useState<SkinUndertone>('Warm');
  const [selectedPalettes, setSelectedPalettes] = useState<string[]>([
    'Warm Earth & Neutrals',
    'Monochrome & Achromatic',
  ]);
  const [texturePreferences, setTexturePreferences] = useState<string[]>([
    'Soft Cotton',
    'Cozy Knit',
  ]);
  const [preferredStyles, setPreferredStyles] = useState<string[]>([
    'Casual Everyday',
    'Streetwear',
  ]);
  const [commonOccasions, setCommonOccasions] = useState<string[]>([
    'School / Campus',
    'Casual Hangouts',
  ]);
  const [fitPreference, setFitPreference] = useState<string>('Regular / Relaxed Fit');
  const [busy, setBusy] = useState<boolean>(false);

  const toggleArrayItem = (
    item: string,
    currentList: string[],
    setter: (val: string[]) => void
  ) => {
    if (currentList.includes(item)) {
      if (currentList.length > 1) {
        setter(currentList.filter((x) => x !== item));
      }
    } else {
      setter([...currentList, item]);
    }
  };

  const stepValue = (
    current: string,
    delta: number,
    min: number,
    max: number,
    setter: (val: string) => void
  ) => {
    const num = parseInt(current, 10) || min;
    const next = Math.max(min, Math.min(max, num + delta));
    setter(String(next));
  };

  const payload = useMemo(
    () => ({
      ageGroup,
      gender,
      heightCm,
      weightKg,
      preferredColors: selectedPalettes,
      texturePreferences,
      preferredStyles,
      commonOccasions,
      fitPreference,
      undertone,
    }),
    [
      ageGroup,
      gender,
      heightCm,
      weightKg,
      selectedPalettes,
      texturePreferences,
      preferredStyles,
      commonOccasions,
      fitPreference,
      undertone,
    ]
  );

  const melOutfit = useMemo(() => {
    if (page === 0) return 'casual_sunny';
    if (page === 1) return 'cool_hoodie';
    if (page === 2) return 'smart_layered';
    if (page === 3) return 'formal_suit';
    if (page === 4) return 'rain_active';
    return 'casual_sunny';
  }, [page]);

  const melMessage = useMemo(() => {
    switch (page) {
      case 1:
        return 'Select your adult life stage (18+ RA 10173 compliant).';
      case 2:
        return 'Tell me a bit about your fit profile so I can tailor your outfit recommendations!';
      case 3:
        return 'Pick CIELAB palettes harmonized with your undertone!';
      case 4:
        return 'Choose the fabrics and style vibes you love!';
      case 5:
        return 'Final step! Pick your occasions and preferred fit.';
      default:
        return "Hi! I'm Mel, your AI chameleon stylist—let's set up your look in 60 seconds!";
    }
  }, [page]);

  const handleFinish = async () => {
    setBusy(true);
    try {
      await AsyncStorage.multiSet([
        ['@stylesense_onboarding_complete', 'true'],
        ['stylesense_onboarding_profile', JSON.stringify(payload)],
      ]);

      if (isLoggedIn) {
        await updateProfile(payload as any);
        if (profile?.displayName) {
          syncCreatorNickname(profile.displayName);
        }
      }
      onComplete();
    } catch {
      onComplete();
    } finally {
      setBusy(false);
    }
  };

  const handleGoToSignIn = async () => {
    try {
      await AsyncStorage.setItem('stylesense_onboarding_profile', JSON.stringify(payload));
    } catch {
      // ignore
    }
    if (onNavigateToLogin) {
      onNavigateToLogin();
    } else {
      onComplete();
    }
  };

  const handleNext = () => {
    if (page < totalPages - 1) {
      setPage(page + 1);
    } else {
      handleFinish();
    }
  };

  const handleBack = () => {
    if (page > 0) {
      setPage(page - 1);
    }
  };

  const isPaletteMatchedToUndertone = (pal: PaletteOption): boolean => {
    return pal.matchedUndertones.includes(undertone);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <View style={styles.screenContainer}>
        {/* Top Progress Header */}
        <View style={styles.topHeader}>
          <View style={styles.progressSegments}>
            {Array.from({ length: totalPages }).map((_, idx) => (
              <View
                key={idx}
                style={[
                  styles.segmentBar,
                  {
                    backgroundColor:
                      idx <= page
                        ? theme.secondaryAccent
                        : theme.border,
                  },
                ]}
              />
            ))}
          </View>
          <View style={styles.stepIndicatorRow}>
            <Text style={[styles.stepBadgeText, { color: theme.accent }]}>
              STEP {page + 1} OF {totalPages}
            </Text>
            {page > 0 && (
              <Text style={[styles.zeroScrollTag, { color: theme.textMuted }]}>
                Cold-Start Style Profile
              </Text>
            )}
          </View>

          {/* Compact Mel Header Banner for Steps 2–6 */}
          {page > 0 && (
            <View
              style={[
                styles.melCompactHeader,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <MelMascot outfit={melOutfit} size={46} waving={page === 5} />
              <View style={styles.melBubbleWrap}>
                <MelSpeechBubble
                  message={melMessage}
                  variant={melOutfit}
                  position="inline"
                />
              </View>
            </View>
          )}
        </View>

        {/* ================= STEP 1 (page === 0): MEL WELCOME ONLY + SIGN-IN ENTRY ================= */}
        {page === 0 && (
          <View style={styles.step1CenterStage}>
            <View style={styles.melHeroStage}>
              <MelMascot outfit="casual_sunny" size={142} waving />
              <View style={styles.step1SpeechWrap}>
                <MelSpeechBubble
                  message="Hi! I'm Mel, your AI chameleon stylist—let's set up your look in 60 seconds!"
                  variant="casual_sunny"
                  position="inline"
                />
              </View>
            </View>

            <View style={styles.step1TitleWrap}>
              <Text style={[styles.step1Title, { color: theme.text }]}>
                Your Personal AI Wardrobe Studio
              </Text>
              <Text style={[styles.step1Subtitle, { color: theme.textMuted }]}>
                Maximize your closet, explore your style identity, and never say “nothing to wear” again.
              </Text>
            </View>

            {/* 3 Compact Visual Feature Pills */}
            <View style={styles.visualPillsRow}>
              <View
                style={[
                  styles.visualFeaturePill,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
              >
                <Text style={styles.visualPillEmoji}>📸</Text>
                <Text style={[styles.visualPillLabel, { color: theme.text }]}>Smart Closet</Text>
              </View>

              <View
                style={[
                  styles.visualFeaturePill,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
              >
                <Text style={styles.visualPillEmoji}>🧍</Text>
                <Text style={[styles.visualPillLabel, { color: theme.text }]}>See It On Me</Text>
              </View>

              <View
                style={[
                  styles.visualFeaturePill,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
              >
                <Text style={styles.visualPillEmoji}>🌦️</Text>
                <Text style={[styles.visualPillLabel, { color: theme.text }]}>Live Weather</Text>
              </View>
            </View>

            {/* Step 1 Bottom Actions */}
            <View style={styles.step1ActionsWrap}>
              <Pressable
                onPress={() => setPage(1)}
                style={[styles.startProfileBtn, { backgroundColor: theme.secondaryAccent }]}
              >
                <Text style={[styles.startProfileBtnText, { color: theme.onAccent }]}>
                  Start My Style Profile →
                </Text>
              </Pressable>

              <Pressable onPress={handleGoToSignIn} style={styles.signInLinkBtn}>
                <Text style={[styles.signInLinkText, { color: theme.textMuted }]}>
                  Already have an account?{' '}
                  <Text style={{ color: theme.text, fontWeight: '700' }}>Sign In</Text>
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* ================= STEP 2 (page === 1): 18+ ADULT AGE BRACKETS ================= */}
        {page === 1 && (
          <View style={styles.stepBody}>
            <View>
              <Text style={[styles.heroHeading, { color: theme.text }]}>
                Select Your Age Bracket
              </Text>
              <Text style={[styles.heroSubheading, { color: theme.textMuted }]}>
                Tailored for 18+ college & young adult wardrobes (RA 10173 compliant).
              </Text>
            </View>

            <View style={styles.ageBracketsStack}>
              {AGE_BRACKETS.map((br) => {
                const isSelected = ageGroup === br.id;
                return (
                  <Pressable
                    key={br.id}
                    onPress={() => setAgeGroup(br.id)}
                    style={[
                      styles.ageBracketCard,
                      {
                        backgroundColor: theme.surface,
                        borderColor: isSelected ? theme.secondaryAccent : theme.border,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.ageIconCircle,
                        { backgroundColor: theme.badgeBg },
                      ]}
                    >
                      <Ionicons name={br.icon as any} size={22} color={theme.text} />
                    </View>

                    <View style={{ flex: 1 }}>
                      <View style={styles.ageHeaderInline}>
                        <Text style={[styles.ageRangeText, { color: theme.text }]}>
                          {br.range}
                        </Text>
                        <Text style={[styles.ageTitleText, { color: theme.textMuted }]}>
                          {br.title}
                        </Text>
                      </View>
                      <Text style={[styles.ageSubtitleText, { color: theme.textMuted }]}>
                        {br.subtitle}
                      </Text>
                      <View style={styles.tagChipsWrap}>
                        {br.tags.map((t) => (
                          <Text
                            key={t}
                            style={[
                              styles.tagPill,
                              { backgroundColor: theme.badgeBg, color: theme.textMuted },
                            ]}
                          >
                            {t}
                          </Text>
                        ))}
                      </View>
                    </View>

                    <Ionicons
                      name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                      size={24}
                      color={isSelected ? theme.secondaryAccent : theme.border}
                    />
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* ================= STEP 3 (page === 2): GENDER & BODY PROFILE (NO 2D MANNEQUIN) ================= */}
        {page === 2 && (
          <View style={styles.stepBody}>
            <View>
              <Text style={[styles.heroHeading, { color: theme.text }]}>
                Your Fit Profile
              </Text>
              <Text style={[styles.heroSubheading, { color: theme.textMuted }]}>
                Used by our 55% Content-Based + 45% Collaborative Hybrid Engine.
              </Text>
            </View>

            <View
              style={[
                styles.subTabContentCard,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <View style={styles.subTabInner}>
                <Text style={[styles.miniSectionLabel, { color: theme.textMuted }]}>
                  GENDER EXPRESSION
                </Text>
                <View style={styles.genderToggleRow}>
                  <Pressable
                    onPress={() => setGender('male')}
                    style={[
                      styles.genderButton,
                      {
                        backgroundColor:
                          gender === 'male' ? theme.secondaryAccent : theme.background,
                        borderColor:
                          gender === 'male' ? theme.secondaryAccent : theme.border,
                      },
                    ]}
                  >
                    <Ionicons
                      name="man"
                      size={16}
                      color={gender === 'male' ? theme.onAccent : theme.text}
                    />
                    <Text
                      style={[
                        styles.genderButtonText,
                        { color: gender === 'male' ? theme.onAccent : theme.text },
                      ]}
                    >
                      Male
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setGender('female')}
                    style={[
                      styles.genderButton,
                      {
                        backgroundColor:
                          gender === 'female' ? theme.secondaryAccent : theme.background,
                        borderColor:
                          gender === 'female' ? theme.secondaryAccent : theme.border,
                      },
                    ]}
                  >
                    <Ionicons
                      name="woman"
                      size={16}
                      color={gender === 'female' ? theme.onAccent : theme.text}
                    />
                    <Text
                      style={[
                        styles.genderButtonText,
                        { color: gender === 'female' ? theme.onAccent : theme.text },
                      ]}
                    >
                      Female
                    </Text>
                  </Pressable>
                </View>

                <Text style={[styles.miniSectionLabel, { color: theme.textMuted, marginTop: 6 }]}>
                  PROPORTIONS
                </Text>
                <View style={styles.measurementsRow}>
                  <View
                    style={[
                      styles.measurementCard,
                      { backgroundColor: theme.background, borderColor: theme.border },
                    ]}
                  >
                    <Text style={[styles.measurementLabel, { color: theme.textMuted }]}>
                      HEIGHT (CM)
                    </Text>
                    <View style={styles.stepperControlRow}>
                      <Pressable
                        onPress={() => stepValue(heightCm, -1, 140, 210, setHeightCm)}
                        style={[styles.stepperCircleBtn, { backgroundColor: theme.badgeBg }]}
                      >
                        <Ionicons name="remove" size={16} color={theme.text} />
                      </Pressable>
                      <Text style={[styles.measurementValueText, { color: theme.text }]}>
                        {heightCm} cm
                      </Text>
                      <Pressable
                        onPress={() => stepValue(heightCm, 1, 140, 210, setHeightCm)}
                        style={[styles.stepperCircleBtn, { backgroundColor: theme.badgeBg }]}
                      >
                        <Ionicons name="add" size={16} color={theme.text} />
                      </Pressable>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.measurementCard,
                      { backgroundColor: theme.background, borderColor: theme.border },
                    ]}
                  >
                    <Text style={[styles.measurementLabel, { color: theme.textMuted }]}>
                      WEIGHT (KG)
                    </Text>
                    <View style={styles.stepperControlRow}>
                      <Pressable
                        onPress={() => stepValue(weightKg, -1, 38, 140, setWeightKg)}
                        style={[styles.stepperCircleBtn, { backgroundColor: theme.badgeBg }]}
                      >
                        <Ionicons name="remove" size={16} color={theme.text} />
                      </Pressable>
                      <Text style={[styles.measurementValueText, { color: theme.text }]}>
                        {weightKg} kg
                      </Text>
                      <Pressable
                        onPress={() => stepValue(weightKg, 1, 38, 140, setWeightKg)}
                        style={[styles.stepperCircleBtn, { backgroundColor: theme.badgeBg }]}
                      >
                        <Ionicons name="add" size={16} color={theme.text} />
                      </Pressable>
                    </View>
                  </View>
                </View>

                <Text style={[styles.miniSectionLabel, { color: theme.textMuted, marginTop: 6 }]}>
                  SKIN UNDERTONE (CIELAB COLOR HARMONY)
                </Text>
                <View style={styles.oneRowPills}>
                  {UNDERTONE_OPTIONS.map((ut) => {
                    const isActive = undertone === ut.id;
                    return (
                      <Pressable
                        key={ut.id}
                        onPress={() => setUndertone(ut.id)}
                        style={[
                          styles.compactPill,
                          {
                            borderColor: isActive ? theme.secondaryAccent : theme.border,
                            backgroundColor: isActive ? theme.secondaryAccent : theme.background,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.compactPillText,
                            { color: isActive ? theme.onAccent : theme.text },
                          ]}
                          numberOfLines={1}
                        >
                          {ut.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>
          </View>
        )}

        {/* ================= STEP 4 (page === 3): CIELAB COLOR-THEORY PALETTES (2x2 GRID) ================= */}
        {page === 3 && (
          <View style={styles.stepBody}>
            <View>
              <Text style={[styles.heroHeading, { color: theme.text }]}>
                CIELAB Color-Harmony Palettes
              </Text>
              <Text style={[styles.heroSubheading, { color: theme.textMuted }]}>
                Select palettes that anchor your wardrobe and skin undertone ({undertone}).
              </Text>
            </View>

            <View style={styles.palettes2x2Grid}>
              {CIELAB_PALETTES.map((pal) => {
                const isSelected = selectedPalettes.includes(pal.name);
                const isSkinMatch = isPaletteMatchedToUndertone(pal);

                return (
                  <Pressable
                    key={pal.id}
                    onPress={() =>
                      toggleArrayItem(pal.name, selectedPalettes, setSelectedPalettes)
                    }
                    style={[
                      styles.palette2x2Card,
                      {
                        backgroundColor: theme.surface,
                        borderColor: isSelected ? theme.secondaryAccent : theme.border,
                      },
                    ]}
                  >
                    {isSkinMatch && (
                      <View
                        style={[
                          styles.skinMatchBadge,
                          { backgroundColor: theme.badgeBg },
                        ]}
                      >
                        <Text style={[styles.skinMatchBadgeText, { color: theme.text }]}>
                          ✨ Matched to Your Undertone
                        </Text>
                      </View>
                    )}

                    <View style={styles.paletteCardTopRow}>
                      <Text
                        style={[styles.palette2x2Name, { color: theme.text }]}
                        numberOfLines={2}
                      >
                        {pal.name}
                      </Text>
                      <Ionicons
                        name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                        size={20}
                        color={isSelected ? theme.secondaryAccent : theme.border}
                      />
                    </View>

                    <Text
                      style={[styles.palette2x2Sub, { color: theme.textMuted }]}
                      numberOfLines={1}
                    >
                      {pal.description}
                    </Text>

                    <View style={styles.swatchCirclesRow}>
                      {pal.colors.map((c, i) => (
                        <View
                          key={i}
                          style={[
                            styles.swatchCircle,
                            {
                              backgroundColor: c,
                              borderColor:
                                c.toUpperCase() === '#FAFAFA' ||
                                c.toUpperCase() === '#F8FAFC' ||
                                c.toUpperCase() === '#FDFBF7' ||
                                c.toUpperCase() === '#F5F0E6'
                                  ? '#CBD5E1'
                                  : 'transparent',
                            },
                          ]}
                        />
                      ))}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* ================= STEP 5 (page === 4): COMPACT 2-COLUMN TEXTURES & STYLES ================= */}
        {page === 4 && (
          <View style={styles.stepBody}>
            <View>
              <Text style={[styles.heroHeading, { color: theme.text }]}>
                Textures & Fashion Styles
              </Text>
              <Text style={[styles.heroSubheading, { color: theme.textMuted }]}>
                Pick the fabrics and style aesthetics you wear most.
              </Text>
            </View>

            <View style={{ gap: 10 }}>
              <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>
                TEXTURE PREFERENCE (2-COL)
              </Text>
              <View style={styles.twoColGrid}>
                {TEXTURE_OPTIONS.map((item) => {
                  const isSelected = texturePreferences.includes(item.label);
                  return (
                    <Pressable
                      key={item.label}
                      onPress={() =>
                        toggleArrayItem(item.label, texturePreferences, setTexturePreferences)
                      }
                      style={[
                        styles.twoColChip,
                        {
                          backgroundColor: theme.surface,
                          borderColor: isSelected ? theme.secondaryAccent : theme.border,
                        },
                      ]}
                    >
                      <Ionicons
                        name={item.icon as any}
                        size={16}
                        color={isSelected ? theme.text : theme.textMuted}
                      />
                      <Text
                        style={[
                          styles.twoColChipText,
                          { color: theme.text },
                        ]}
                        numberOfLines={1}
                      >
                        {item.label}
                      </Text>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={15} color={theme.secondaryAccent} />
                      )}
                    </Pressable>
                  );
                })}
              </View>

              <Text style={[styles.sectionTitle, { color: theme.textMuted, marginTop: 4 }]}>
                PREFERRED STYLES (2-COL)
              </Text>
              <View style={styles.twoColGrid}>
                {STYLE_OPTIONS.map((item) => {
                  const isSelected = preferredStyles.includes(item.label);
                  return (
                    <Pressable
                      key={item.label}
                      onPress={() =>
                        toggleArrayItem(item.label, preferredStyles, setPreferredStyles)
                      }
                      style={[
                        styles.twoColChip,
                        {
                          backgroundColor: theme.surface,
                          borderColor: isSelected ? theme.secondaryAccent : theme.border,
                        },
                      ]}
                    >
                      <Ionicons
                        name={item.icon as any}
                        size={16}
                        color={isSelected ? theme.text : theme.textMuted}
                      />
                      <Text
                        style={[
                          styles.twoColChipText,
                          { color: theme.text },
                        ]}
                        numberOfLines={1}
                      >
                        {item.label}
                      </Text>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={15} color={theme.secondaryAccent} />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        )}

        {/* ================= STEP 6 (page === 5): COMPACT 2-COLUMN OCCASIONS & FIT ================= */}
        {page === 5 && (
          <View style={styles.stepBody}>
            <View>
              <Text style={[styles.heroHeading, { color: theme.text }]}>
                Common Occasions & Fit
              </Text>
              <Text style={[styles.heroSubheading, { color: theme.textMuted }]}>
                Where you spend your week and how your clothes should drape.
              </Text>
            </View>

            <View style={{ gap: 10 }}>
              <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>
                COMMON OCCASIONS (2-COL)
              </Text>
              <View style={styles.twoColGrid}>
                {OCCASION_OPTIONS.map((item) => {
                  const isSelected = commonOccasions.includes(item.label);
                  return (
                    <Pressable
                      key={item.label}
                      onPress={() =>
                        toggleArrayItem(item.label, commonOccasions, setCommonOccasions)
                      }
                      style={[
                        styles.twoColChip,
                        {
                          backgroundColor: theme.surface,
                          borderColor: isSelected ? theme.secondaryAccent : theme.border,
                        },
                      ]}
                    >
                      <Text style={{ fontSize: 15 }}>{item.emoji}</Text>
                      <Text
                        style={[
                          styles.twoColChipText,
                          { color: theme.text },
                        ]}
                        numberOfLines={1}
                      >
                        {item.label}
                      </Text>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={15} color={theme.secondaryAccent} />
                      )}
                    </Pressable>
                  );
                })}
              </View>

              <Text style={[styles.sectionTitle, { color: theme.textMuted, marginTop: 4 }]}>
                FIT PREFERENCE
              </Text>
              <View style={styles.fitThreeColRow}>
                {FIT_OPTIONS.map((fit) => {
                  const isSelected = fitPreference === fit.id;
                  return (
                    <Pressable
                      key={fit.id}
                      onPress={() => setFitPreference(fit.id)}
                      style={[
                        styles.fitCompactCard,
                        {
                          backgroundColor: theme.surface,
                          borderColor: isSelected ? theme.secondaryAccent : theme.border,
                        },
                      ]}
                    >
                      <Ionicons
                        name={fit.icon as any}
                        size={18}
                        color={isSelected ? theme.text : theme.textMuted}
                      />
                      <Text style={[styles.fitTitleText, { color: theme.text }]}>
                        {fit.title}
                      </Text>
                      <Text
                        style={[styles.fitSubText, { color: theme.textMuted }]}
                        numberOfLines={1}
                      >
                        {fit.description}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        )}

        {/* Bottom Navigation Bar for Steps 2–6 */}
        {page > 0 ? (
          <View style={[styles.bottomBar, { borderTopColor: theme.border }]}>
            <Pressable
              onPress={handleBack}
              style={[
                styles.backBtn,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <Ionicons name="arrow-back" size={17} color={theme.text} />
              <Text style={[styles.backBtnText, { color: theme.text }]}>Back</Text>
            </Pressable>

            <Pressable
              disabled={busy}
              onPress={handleNext}
              style={[styles.nextBtn, { backgroundColor: theme.secondaryAccent }]}
            >
              {busy ? (
                <ActivityIndicator color={theme.onAccent} />
              ) : (
                <Text style={[styles.nextBtnText, { color: theme.onAccent }]}>
                  {page === totalPages - 1 ? 'Complete Setup →' : 'Next →'}
                </Text>
              )}
            </Pressable>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  screenContainer: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  topHeader: {
    gap: 6,
  },
  progressSegments: {
    flexDirection: 'row',
    gap: 6,
  },
  segmentBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  stepIndicatorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stepBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  zeroScrollTag: {
    fontSize: 11,
    fontWeight: '600',
  },
  melCompactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
  },
  melBubbleWrap: {
    flex: 1,
  },
  step1CenterStage: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  melHeroStage: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 6,
  },
  step1SpeechWrap: {
    width: '100%',
  },
  step1TitleWrap: {
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  step1Title: {
    fontSize: 23,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  step1Subtitle: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 6,
  },
  visualPillsRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  visualFeaturePill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
  },
  visualPillEmoji: {
    fontSize: 20,
  },
  visualPillLabel: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  step1ActionsWrap: {
    gap: 10,
  },
  startProfileBtn: {
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startProfileBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  signInLinkBtn: {
    paddingVertical: 6,
    alignItems: 'center',
  },
  signInLinkText: {
    fontSize: 13,
    fontWeight: '600',
  },
  stepBody: {
    flex: 1,
    justifyContent: 'space-evenly',
    paddingVertical: 4,
  },
  heroHeading: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  heroSubheading: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  ageBracketsStack: {
    gap: 8,
  },
  ageBracketCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  ageIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ageHeaderInline: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  ageRangeText: {
    fontSize: 17,
    fontWeight: '700',
  },
  ageTitleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  ageSubtitleText: {
    fontSize: 11,
    marginTop: 2,
  },
  tagChipsWrap: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  tagPill: {
    fontSize: 10,
    fontWeight: '600',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  subTabContentCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    justifyContent: 'center',
  },
  subTabInner: {
    gap: 10,
  },
  genderToggleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  genderButton: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  genderButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  measurementsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  measurementCard: {
    flex: 1,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    gap: 6,
  },
  measurementLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  stepperControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  stepperCircleBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  measurementValueText: {
    fontSize: 14,
    fontWeight: '700',
  },
  miniSectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  oneRowPills: {
    flexDirection: 'row',
    gap: 8,
  },
  compactPill: {
    flex: 1,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 6,
  },
  compactPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  palettes2x2Grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  palette2x2Card: {
    width: '48.2%',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 6,
  },
  skinMatchBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  skinMatchBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  paletteCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 4,
  },
  palette2x2Name: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
  },
  palette2x2Sub: {
    fontSize: 10,
  },
  swatchCirclesRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  swatchCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  twoColGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  twoColChip: {
    width: '48.5%',
    height: 40,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  twoColChipText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
  },
  fitThreeColRow: {
    flexDirection: 'row',
    gap: 8,
  },
  fitCompactCard: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    gap: 3,
  },
  fitTitleText: {
    fontSize: 12,
    fontWeight: '700',
  },
  fitSubText: {
    fontSize: 9,
    textAlign: 'center',
  },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    gap: 10,
  },
  backBtn: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  nextBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
