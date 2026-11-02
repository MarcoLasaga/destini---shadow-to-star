import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../hooks/useAppTheme';
import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '../contexts/ProfileContext';
import { syncCreatorNickname } from '../services/communityService';
import { MelMascot } from '../components/MelMascot';

type SkinUndertone = 'Warm' | 'Cool' | 'Neutral';

interface OnboardingScreenProps {
  onComplete: () => void;
  onNavigateToLogin?: () => void;
}

interface PaletteOption {
  id: string;
  name: string;
  displayName: string;
  description: string;
  colors: string[];
  matchedUndertones: SkinUndertone[];
}

const COLOR_PALETTES: PaletteOption[] = [
  {
    id: 'monochrome',
    name: 'Monochrome & Achromatic',
    displayName: 'Monochrome & Minimal',
    description: 'Timeless blacks, grays & crisp whites',
    colors: ['#18181B', '#52525B', '#D4D4D8', '#FAFAFA'],
    matchedUndertones: ['Neutral'],
  },
  {
    id: 'warm_earth',
    name: 'Warm Earth & Neutrals',
    displayName: 'Warm Earth & Neutrals',
    description: 'Rich browns, olive & warm sand tones',
    colors: ['#C8AD8D', '#5C4033', '#556B2F', '#F5F0E6'],
    matchedUndertones: ['Warm'],
  },
  {
    id: 'cool_deep',
    name: 'Cool Deep & Classic',
    displayName: 'Cool Deep & Classic',
    description: 'Classic navy, charcoal & cool slate',
    colors: ['#1B2A4A', '#36454F', '#6B7C93', '#F8FAFC'],
    matchedUndertones: ['Cool'],
  },
  {
    id: 'soft_pastel',
    name: 'Soft Pastel & High-Key',
    displayName: 'Soft Pastels & Light',
    description: 'Airy pastels & soft everyday tints',
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

const UNDERTONE_OPTIONS: Array<{
  id: SkinUndertone;
  label: string;
  desc: string;
  swatch: string;
}> = [
  { id: 'Warm', label: 'Warm', desc: 'Golden & earthy', swatch: '#D9A773' },
  { id: 'Neutral', label: 'Neutral', desc: 'Balanced tones', swatch: '#C9B199' },
  { id: 'Cool', label: 'Cool', desc: 'Rosy & cool', swatch: '#C4A4B5' },
];

const STEP1_FEATURES = [
  {
    icon: 'camera-outline' as const,
    title: 'Smart Closet',
    subtitle: 'Digitize & organize pieces in seconds',
  },
  {
    icon: 'sparkles-outline' as const,
    title: 'See It On Me',
    subtitle: 'Preview curated outfits before you dress',
  },
  {
    icon: 'partly-sunny-outline' as const,
    title: 'Live Weather',
    subtitle: 'Daily looks matched to your local forecast',
  },
];

export default function OnboardingScreen({
  onComplete,
  onNavigateToLogin,
}: OnboardingScreenProps) {
  const theme = useAppTheme();
  const isDark = theme.mode === 'dark';
  const { isLoggedIn } = useAuth();
  const { profile, updateProfile } = useProfile();

  // Editorial Palette Tokens (#364536, #F3F1EF, #E83E35)
  const primaryForest = '#364536';
  const lightIvory = '#F3F1EF';
  const accentRed = '#E83E35';
  const activeBorder = isDark ? '#E83E35' : '#364536';
  const activeBgTint = isDark ? 'rgba(54, 69, 54, 0.45)' : '#EBF0EB';

  // 6 Zero-Scroll Steps (0 to 5)
  const [page, setPage] = useState<number>(0);
  const totalPages = 6;

  // Form State (Preserves exact keys/values for ProfileContext & hybridScoreService)
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

  const handleDirectNumericChange = (
    raw: string,
    setter: (val: string) => void
  ) => {
    const digitsOnly = raw.replace(/[^0-9]/g, '');
    setter(digitsOnly);
  };

  const normalizeNumericField = (
    current: string,
    min: number,
    max: number,
    fallback: number,
    setter: (val: string) => void
  ) => {
    const parsed = parseInt(current, 10);
    if (isNaN(parsed)) {
      setter(String(fallback));
      return String(fallback);
    }
    const clamped = Math.max(min, Math.min(max, parsed));
    setter(String(clamped));
    return String(clamped);
  };

  const safeHeightCm = useMemo(() => {
    const parsed = parseInt(heightCm, 10);
    if (isNaN(parsed)) return '168';
    return String(Math.max(120, Math.min(230, parsed)));
  }, [heightCm]);

  const safeWeightKg = useMemo(() => {
    const parsed = parseInt(weightKg, 10);
    if (isNaN(parsed)) return '58';
    return String(Math.max(30, Math.min(180, parsed)));
  }, [weightKg]);

  const payload = useMemo(
    () => ({
      ageGroup,
      gender,
      heightCm: safeHeightCm,
      weightKg: safeWeightKg,
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
      safeHeightCm,
      safeWeightKg,
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
        return 'Which stage best matches your daily schedule and wardrobe needs?';
      case 2:
        return 'Share your fit details so I can tailor proportions and tones to you.';
      case 3:
        return 'Pick the color palettes you love wearing most—I highlighted your best match!';
      case 4:
        return 'Choose the fabrics and fashion aesthetics you gravitate toward.';
      case 5:
        return 'Last step! Tell me where you spend your week and how you like clothes to fit.';
      default:
        return '';
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
    if (page === 2) {
      normalizeNumericField(heightCm, 120, 230, 168, setHeightCm);
      normalizeNumericField(weightKg, 30, 180, 58, setWeightKg);
    }
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
                      idx < page
                        ? primaryForest
                        : idx === page
                        ? accentRed
                        : theme.border,
                  },
                ]}
              />
            ))}
          </View>

          {/* Only show step badge on Steps 2–6 (removed from Step 1 per PDF Page 1) */}
          {page > 0 && (
            <View style={styles.stepIndicatorRow}>
              <Text style={[styles.stepBadgeText, { color: isDark ? lightIvory : primaryForest }]}>
                STEP {page + 1} OF {totalPages}
              </Text>
            </View>
          )}

          {/* Redesigned Mel Companion Banner for Steps 2–6 (PDF Pages 3–7) */}
          {page > 0 && (
            <View
              style={[
                styles.melCompanionBanner,
                {
                  backgroundColor: primaryForest,
                  borderColor: 'rgba(243, 241, 239, 0.16)',
                },
              ]}
            >
              <View style={styles.melAvatarCircle}>
                <MelMascot outfit={melOutfit} size={38} waving={page === 5} />
              </View>
              <View style={styles.melCompanionTextCol}>
                <View style={styles.melCompanionHeaderRow}>
                  <View style={styles.melDot} />
                  <Text style={styles.melCompanionLabel}>MEL&apos;S STYLING TIP</Text>
                </View>
                <Text style={styles.melCompanionMessage} numberOfLines={2}>
                  {melMessage}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* ================= STEP 1 (page === 0): WELCOME & REDESIGNED FEATURE CARDS ================= */}
        {page === 0 && (
          <View style={styles.step1CenterStage}>
            {/* Hero Stage without the speech bubble box (removed per PDF Page 1) */}
            <View style={styles.melHeroStage}>
              <View style={styles.heroBackdropRing}>
                <MelMascot outfit="casual_sunny" size={136} waving />
              </View>
              <View style={styles.brandBadgePill}>
                <View style={styles.brandBadgeDot} />
                <Text style={styles.brandBadgeText}>STYLESENSE AI STUDIO</Text>
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

            {/* Redesigned Editorial Feature Cards (PDF Page 2 blue circle) */}
            <View style={styles.editorialFeaturesStack}>
              {STEP1_FEATURES.map((feat, idx) => (
                <View
                  key={feat.title}
                  style={[
                    styles.editorialFeatureCard,
                    {
                      backgroundColor: theme.surface,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.editorialFeatureIconBox,
                      {
                        backgroundColor: idx === 1 ? accentRed : primaryForest,
                      },
                    ]}
                  >
                    <Ionicons name={feat.icon} size={20} color={lightIvory} />
                  </View>
                  <View style={styles.editorialFeatureTextWrap}>
                    <Text style={[styles.editorialFeatureTitle, { color: theme.text }]}>
                      {feat.title}
                    </Text>
                    <Text
                      style={[styles.editorialFeatureSub, { color: theme.textMuted }]}
                      numberOfLines={1}
                    >
                      {feat.subtitle}
                    </Text>
                  </View>
                  <Ionicons
                    name="checkmark-circle"
                    size={18}
                    color={idx === 1 ? accentRed : primaryForest}
                  />
                </View>
              ))}
            </View>

            {/* Step 1 Bottom Actions */}
            <View style={styles.step1ActionsWrap}>
              <Pressable
                onPress={() => setPage(1)}
                style={[styles.startProfileBtn, { backgroundColor: primaryForest }]}
              >
                <Text style={[styles.startProfileBtnText, { color: lightIvory }]}>
                  Start My Style Profile
                </Text>
                <View style={styles.startBtnArrowBadge}>
                  <Ionicons name="arrow-forward" size={15} color={lightIvory} />
                </View>
              </Pressable>

              <Pressable onPress={handleGoToSignIn} style={styles.signInLinkBtn}>
                <Text style={[styles.signInLinkText, { color: theme.textMuted }]}>
                  Already have an account?{' '}
                  <Text style={{ color: isDark ? lightIvory : primaryForest, fontWeight: '800' }}>
                    Sign In
                  </Text>
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* ================= STEP 2 (page === 1): AGE BRACKETS (PDF Page 3) ================= */}
        {page === 1 && (
          <View style={styles.stepBody}>
            <View>
              <Text style={[styles.heroHeading, { color: theme.text }]}>
                Select Your Age Bracket
              </Text>
              <Text style={[styles.heroSubheading, { color: theme.textMuted }]}>
                Helps us curate outfits that fit your daily routine and lifestyle.
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
                        backgroundColor: isSelected ? activeBgTint : theme.surface,
                        borderColor: isSelected ? activeBorder : theme.border,
                        borderWidth: isSelected ? 1.5 : 1,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.ageIconCircle,
                        {
                          backgroundColor: isSelected ? primaryForest : theme.badgeBg,
                        },
                      ]}
                    >
                      <Ionicons
                        name={br.icon as any}
                        size={22}
                        color={isSelected ? lightIvory : theme.text}
                      />
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
                              {
                                backgroundColor: isSelected
                                  ? 'rgba(54, 69, 54, 0.14)'
                                  : theme.badgeBg,
                                color: isSelected
                                  ? isDark
                                    ? lightIvory
                                    : primaryForest
                                  : theme.textMuted,
                              },
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
                      color={isSelected ? accentRed : theme.border}
                    />
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* ================= STEP 3 (page === 2): FIT PROFILE & DIRECT TYPING INPUTS (PDF Page 4) ================= */}
        {page === 2 && (
          <View style={styles.stepBody}>
            <View>
              <Text style={[styles.heroHeading, { color: theme.text }]}>
                Your Fit Profile
              </Text>
              <Text style={[styles.heroSubheading, { color: theme.textMuted }]}>
                Personalize your proportions and skin tone for flattering outfit pairings.
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
                          gender === 'male' ? primaryForest : theme.background,
                        borderColor:
                          gender === 'male' ? primaryForest : theme.border,
                      },
                    ]}
                  >
                    <Ionicons
                      name="man"
                      size={16}
                      color={gender === 'male' ? lightIvory : theme.text}
                    />
                    <Text
                      style={[
                        styles.genderButtonText,
                        { color: gender === 'male' ? lightIvory : theme.text },
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
                          gender === 'female' ? primaryForest : theme.background,
                        borderColor:
                          gender === 'female' ? primaryForest : theme.border,
                      },
                    ]}
                  >
                    <Ionicons
                      name="woman"
                      size={16}
                      color={gender === 'female' ? lightIvory : theme.text}
                    />
                    <Text
                      style={[
                        styles.genderButtonText,
                        { color: gender === 'female' ? lightIvory : theme.text },
                      ]}
                    >
                      Female
                    </Text>
                  </Pressable>
                </View>

                <Text style={[styles.miniSectionLabel, { color: theme.textMuted, marginTop: 4 }]}>
                  PROPORTIONS (TAP TO TYPE)
                </Text>
                <View style={styles.measurementsRow}>
                  {/* Direct Numeric Input Card for Height */}
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
                        onPress={() => stepValue(heightCm, -1, 120, 230, setHeightCm)}
                        style={[styles.stepperCircleBtn, { backgroundColor: theme.badgeBg }]}
                      >
                        <Ionicons name="remove" size={15} color={theme.text} />
                      </Pressable>

                      <View style={[styles.numericInputBox, { borderColor: theme.border }]}>
                        <TextInput
                          value={heightCm}
                          onChangeText={(txt) => handleDirectNumericChange(txt, setHeightCm)}
                          onBlur={() =>
                            normalizeNumericField(heightCm, 120, 230, 168, setHeightCm)
                          }
                          keyboardType="numeric"
                          maxLength={3}
                          selectTextOnFocus
                          style={[styles.numericInputText, { color: theme.text }]}
                          placeholder="168"
                          placeholderTextColor={theme.textMuted}
                        />
                        <Text style={[styles.numericUnitLabel, { color: theme.textMuted }]}>
                          cm
                        </Text>
                      </View>

                      <Pressable
                        onPress={() => stepValue(heightCm, 1, 120, 230, setHeightCm)}
                        style={[styles.stepperCircleBtn, { backgroundColor: theme.badgeBg }]}
                      >
                        <Ionicons name="add" size={15} color={theme.text} />
                      </Pressable>
                    </View>
                  </View>

                  {/* Direct Numeric Input Card for Weight */}
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
                        onPress={() => stepValue(weightKg, -1, 30, 180, setWeightKg)}
                        style={[styles.stepperCircleBtn, { backgroundColor: theme.badgeBg }]}
                      >
                        <Ionicons name="remove" size={15} color={theme.text} />
                      </Pressable>

                      <View style={[styles.numericInputBox, { borderColor: theme.border }]}>
                        <TextInput
                          value={weightKg}
                          onChangeText={(txt) => handleDirectNumericChange(txt, setWeightKg)}
                          onBlur={() =>
                            normalizeNumericField(weightKg, 30, 180, 58, setWeightKg)
                          }
                          keyboardType="numeric"
                          maxLength={3}
                          selectTextOnFocus
                          style={[styles.numericInputText, { color: theme.text }]}
                          placeholder="58"
                          placeholderTextColor={theme.textMuted}
                        />
                        <Text style={[styles.numericUnitLabel, { color: theme.textMuted }]}>
                          kg
                        </Text>
                      </View>

                      <Pressable
                        onPress={() => stepValue(weightKg, 1, 30, 180, setWeightKg)}
                        style={[styles.stepperCircleBtn, { backgroundColor: theme.badgeBg }]}
                      >
                        <Ionicons name="add" size={15} color={theme.text} />
                      </Pressable>
                    </View>
                  </View>
                </View>

                <Text style={[styles.miniSectionLabel, { color: theme.textMuted, marginTop: 4 }]}>
                  SKIN UNDERTONE
                </Text>
                <View style={styles.undertoneCardsRow}>
                  {UNDERTONE_OPTIONS.map((ut) => {
                    const isActive = undertone === ut.id;
                    return (
                      <Pressable
                        key={ut.id}
                        onPress={() => setUndertone(ut.id)}
                        style={[
                          styles.undertoneCard,
                          {
                            borderColor: isActive ? primaryForest : theme.border,
                            backgroundColor: isActive ? primaryForest : theme.background,
                          },
                        ]}
                      >
                        <View style={styles.undertoneTopRow}>
                          <View
                            style={[
                              styles.undertoneSwatchDot,
                              { backgroundColor: ut.swatch },
                            ]}
                          />
                          <Text
                            style={[
                              styles.undertoneTitleText,
                              { color: isActive ? lightIvory : theme.text },
                            ]}
                            numberOfLines={1}
                          >
                            {ut.label}
                          </Text>
                        </View>
                        <Text
                          style={[
                            styles.undertoneDescText,
                            {
                              color: isActive
                                ? 'rgba(243, 241, 239, 0.8)'
                                : theme.textMuted,
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {ut.desc}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>
          </View>
        )}

        {/* ================= STEP 4 (page === 3): COLOR PALETTES (PDF Page 5) ================= */}
        {page === 3 && (
          <View style={styles.stepBody}>
            <View>
              <Text style={[styles.heroHeading, { color: theme.text }]}>
                Your Color Palettes
              </Text>
              <Text style={[styles.heroSubheading, { color: theme.textMuted }]}>
                Select the color families that best match your personal style ({undertone} undertone).
              </Text>
            </View>

            <View style={styles.palettes2x2Grid}>
              {COLOR_PALETTES.map((pal) => {
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
                        backgroundColor: isSelected ? activeBgTint : theme.surface,
                        borderColor: isSelected ? activeBorder : theme.border,
                        borderWidth: isSelected ? 1.5 : 1,
                      },
                    ]}
                  >
                    {/* Connected Editorial Color Strip at Top of Card */}
                    <View style={styles.paletteStripBar}>
                      {pal.colors.map((c, i) => (
                        <View
                          key={i}
                          style={[styles.paletteStripSegment, { backgroundColor: c }]}
                        />
                      ))}
                    </View>

                    {isSkinMatch && (
                      <View
                        style={[
                          styles.skinMatchBadge,
                          { backgroundColor: primaryForest },
                        ]}
                      >
                        <Ionicons name="sparkles" size={10} color={lightIvory} />
                        <Text style={[styles.skinMatchBadgeText, { color: lightIvory }]}>
                          Best for {undertone}
                        </Text>
                      </View>
                    )}

                    <View style={styles.paletteCardTopRow}>
                      <Text
                        style={[styles.palette2x2Name, { color: theme.text }]}
                        numberOfLines={2}
                      >
                        {pal.displayName}
                      </Text>
                      <Ionicons
                        name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                        size={20}
                        color={isSelected ? accentRed : theme.border}
                      />
                    </View>

                    <Text
                      style={[styles.palette2x2Sub, { color: theme.textMuted }]}
                      numberOfLines={2}
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
                                  : 'rgba(0,0,0,0.08)',
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

        {/* ================= STEP 5 (page === 4): TEXTURES & STYLES (PDF Page 6) ================= */}
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
                TEXTURE PREFERENCE
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
                          backgroundColor: isSelected ? activeBgTint : theme.surface,
                          borderColor: isSelected ? activeBorder : theme.border,
                        },
                      ]}
                    >
                      <Ionicons
                        name={item.icon as any}
                        size={16}
                        color={isSelected ? (isDark ? lightIvory : primaryForest) : theme.textMuted}
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
                        <Ionicons name="checkmark-circle" size={15} color={accentRed} />
                      )}
                    </Pressable>
                  );
                })}
              </View>

              <Text style={[styles.sectionTitle, { color: theme.textMuted, marginTop: 4 }]}>
                PREFERRED STYLES
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
                          backgroundColor: isSelected ? activeBgTint : theme.surface,
                          borderColor: isSelected ? activeBorder : theme.border,
                        },
                      ]}
                    >
                      <Ionicons
                        name={item.icon as any}
                        size={16}
                        color={isSelected ? (isDark ? lightIvory : primaryForest) : theme.textMuted}
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
                        <Ionicons name="checkmark-circle" size={15} color={accentRed} />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        )}

        {/* ================= STEP 6 (page === 5): OCCASIONS & FIT (PDF Page 7) ================= */}
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
                COMMON OCCASIONS
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
                          backgroundColor: isSelected ? activeBgTint : theme.surface,
                          borderColor: isSelected ? activeBorder : theme.border,
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
                        <Ionicons name="checkmark-circle" size={15} color={accentRed} />
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
                          backgroundColor: isSelected ? primaryForest : theme.surface,
                          borderColor: isSelected ? primaryForest : theme.border,
                        },
                      ]}
                    >
                      <Ionicons
                        name={fit.icon as any}
                        size={18}
                        color={isSelected ? lightIvory : theme.textMuted}
                      />
                      <Text
                        style={[
                          styles.fitTitleText,
                          { color: isSelected ? lightIvory : theme.text },
                        ]}
                      >
                        {fit.title}
                      </Text>
                      <Text
                        style={[
                          styles.fitSubText,
                          {
                            color: isSelected
                              ? 'rgba(243, 241, 239, 0.78)'
                              : theme.textMuted,
                          },
                        ]}
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
              style={[
                styles.nextBtn,
                { backgroundColor: page === totalPages - 1 ? accentRed : primaryForest },
              ]}
            >
              {busy ? (
                <ActivityIndicator color={lightIvory} />
              ) : (
                <Text style={[styles.nextBtnText, { color: lightIvory }]}>
                  {page === totalPages - 1 ? 'Complete Setup →' : 'Continue →'}
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
    gap: 8,
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
    fontWeight: '800',
    letterSpacing: 1,
  },
  melCompanionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
  },
  melAvatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(243, 241, 239, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  melCompanionTextCol: {
    flex: 1,
    gap: 2,
  },
  melCompanionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  melDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E83E35',
  },
  melCompanionLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 1,
    color: 'rgba(243, 241, 239, 0.75)',
  },
  melCompanionMessage: {
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: '600',
    color: '#F3F1EF',
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
    marginTop: 4,
  },
  heroBackdropRing: {
    width: 158,
    height: 158,
    borderRadius: 79,
    backgroundColor: 'rgba(54, 69, 54, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(54, 69, 54, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#364536',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  brandBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E83E35',
  },
  brandBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: '#F3F1EF',
  },
  step1TitleWrap: {
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  step1Title: {
    fontSize: 23,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  step1Subtitle: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 5,
  },
  editorialFeaturesStack: {
    gap: 8,
  },
  editorialFeatureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 13,
    borderRadius: 15,
    borderWidth: 1,
    gap: 12,
  },
  editorialFeatureIconBox: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editorialFeatureTextWrap: {
    flex: 1,
    gap: 2,
  },
  editorialFeatureTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  editorialFeatureSub: {
    fontSize: 11.5,
    fontWeight: '500',
  },
  step1ActionsWrap: {
    gap: 10,
  },
  startProfileBtn: {
    height: 50,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  startProfileBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  startBtnArrowBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E83E35',
    alignItems: 'center',
    justifyContent: 'center',
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
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  heroSubheading: {
    fontSize: 12.5,
    lineHeight: 17,
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
    fontWeight: '800',
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
    fontWeight: '700',
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
    gap: 4,
  },
  stepperCircleBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numericInputBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1.5,
    paddingBottom: 2,
    gap: 2,
  },
  numericInputText: {
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
    minWidth: 34,
    paddingVertical: 0,
  },
  numericUnitLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  miniSectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  undertoneCardsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  undertoneCard: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    gap: 3,
  },
  undertoneTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  undertoneSwatchDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  undertoneTitleText: {
    fontSize: 12,
    fontWeight: '700',
  },
  undertoneDescText: {
    fontSize: 9.5,
    fontWeight: '500',
  },
  palettes2x2Grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  palette2x2Card: {
    width: '48.2%',
    padding: 11,
    borderRadius: 14,
    gap: 6,
    overflow: 'hidden',
  },
  paletteStripBar: {
    flexDirection: 'row',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 2,
  },
  paletteStripSegment: {
    flex: 1,
  },
  skinMatchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 999,
    gap: 4,
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
    fontSize: 12.5,
    fontWeight: '700',
  },
  palette2x2Sub: {
    fontSize: 10.5,
    lineHeight: 14,
  },
  swatchCirclesRow: {
    flexDirection: 'row',
    gap: 7,
    marginTop: 2,
  },
  swatchCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
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
    fontSize: 9.5,
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
