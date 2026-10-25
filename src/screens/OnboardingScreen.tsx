import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppTheme } from '../hooks/useAppTheme';
import { useProfile } from '../contexts/ProfileContext';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { MelMascot, MelSpeechBubble } from '../components/MelMascot';
import Mannequin2D from '../components/Mannequin2D';
import { OutfitClothingItem } from '../types';
import { syncCreatorNickname } from '../services/communityService';
import {
  MALE_HAIRSTYLES,
  FEMALE_HAIRSTYLES,
  HAIR_COLORS,
  SKIN_TONES,
  FACE_STYLES,
} from '../components/CharacterCustomizeModal';

interface OnboardingScreenProps {
  onComplete: () => void;
  onNavigateToLogin?: () => void;
}

interface PaletteOption {
  id: string;
  name: string;
  description: string;
  colors: string[];
}

const PALETTES: PaletteOption[] = [
  {
    id: 'monochrome',
    name: 'Monochrome B&W',
    description: 'Sleek, modern high-contrast styling',
    colors: ['#171717', '#525252', '#A3A3A3', '#FFFFFF'],
  },
  {
    id: 'earth_neutral',
    name: 'Earth & Neutral',
    description: 'Warm tans, olive greens, and cozy creams',
    colors: ['#785336', '#A2845E', '#D4C3A3', '#556B2F'],
  },
  {
    id: 'streetwear_dark',
    name: 'Streetwear Dark',
    description: 'Cyber & urban midnight slate aesthetics',
    colors: ['#1E1E2E', '#313244', '#45475A', '#89B4FA'],
  },
  {
    id: 'pastel_warm',
    name: 'Pastel & Warm',
    description: 'Soft lavender, butter yellow, and blush',
    colors: ['#FBCFE8', '#FED7AA', '#FEF08A', '#BBF7D0'],
  },
  {
    id: 'mix_match',
    name: 'Mix & Match All',
    description: 'Vibrant, expressive and eclectic combinations',
    colors: ['#EF4444', '#F59E0B', '#10B981', '#3B82F6'],
  },
];

const TEXTURE_OPTIONS = [
  { label: 'Soft Cotton', icon: 'cloud-outline' },
  { label: 'Cozy Knit', icon: 'shirt-outline' },
  { label: 'Rough & Denim', icon: 'layers-outline' },
  { label: 'Smooth Silk', icon: 'sparkles-outline' },
  { label: 'Structured & Crisp', icon: 'shield-checkmark-outline' },
];

const STYLE_OPTIONS = [
  { label: 'Casual Everyday', icon: 'walk-outline', vibe: 'Comfort first' },
  { label: 'Streetwear', icon: 'bicycle-outline', vibe: 'Urban & edgy' },
  { label: 'Vintage & Retro', icon: 'film-outline', vibe: 'Timeless classics' },
  { label: 'Rockstar', icon: 'flash-outline', vibe: 'Bold statements' },
  { label: 'Punk', icon: 'flame-outline', vibe: 'Rebellious tones' },
  { label: 'Minimalist', icon: 'ellipse-outline', vibe: 'Clean essentials' },
  { label: 'Formal & Smart', icon: 'briefcase-outline', vibe: 'Sharp tailoring' },
];

const OCCASION_OPTIONS = [
  { label: 'School / Campus', icon: 'school-outline' },
  { label: 'Work / Internship', icon: 'briefcase-outline' },
  { label: 'Casual Hangouts', icon: 'cafe-outline' },
  { label: 'Parties & Nightlife', icon: 'musical-notes-outline' },
  { label: 'Formal Events', icon: 'ribbon-outline' },
  { label: 'Gym & Sports', icon: 'fitness-outline' },
];

const FIT_OPTIONS = [
  {
    id: 'Baggy / Oversized',
    title: 'Baggy & Oversized',
    description: 'Relaxed streetwear silhouette with extra drape and drop shoulders.',
    icon: 'resize-outline',
  },
  {
    id: 'Regular / Relaxed Fit',
    title: 'Regular & Relaxed',
    description: 'Balanced, timeless everyday fit designed for natural ease and comfort.',
    icon: 'body-outline',
  },
  {
    id: 'Slim / Tailored Fit',
    title: 'Slim & Tailored',
    description: 'Sharp contour that follows body lines for an elongated, crisp profile.',
    icon: 'cut-outline',
  },
];

const DEMO_AVATAR_CLOTHES: OutfitClothingItem[] = [
  {
    id: 'onboard-top',
    name: 'Classic Crewneck',
    category: 'Top',
    image: '',
    color: '#3B82F6',
    primaryColor: '#3B82F6',
    slotType: 'innerTop',
  },
  {
    id: 'onboard-bottom',
    name: 'Straight Denim Pants',
    category: 'Bottom',
    image: '',
    color: '#1E293B',
    primaryColor: '#1E293B',
    slotType: 'bottom',
  },
  {
    id: 'onboard-shoes',
    name: 'Clean White Sneakers',
    category: 'Shoes',
    image: '',
    color: '#FFFFFF',
    primaryColor: '#FFFFFF',
    slotType: 'shoes',
  },
];

export default function OnboardingScreen({
  onComplete,
  onNavigateToLogin,
}: OnboardingScreenProps) {
  const theme = useAppTheme();
  const { isLoggedIn } = useAuth();
  const { profile, updateProfile } = useProfile();
  const {
    setMannequinSkinTone,
    setHairStyle: setSettingsHairStyle,
    setHairColor: setSettingsHairColor,
    setFaceStyle: setSettingsFaceStyle,
  } = useSettings();

  // 6 Pages (0 to 5)
  const [page, setPage] = useState<number>(0);
  const totalPages = 6;

  // Form State
  const [ageGroup, setAgeGroup] = useState<'13-17' | '18-22'>('13-17');
  const [gender, setGender] = useState<'male' | 'female'>('female');
  const [heightCm, setHeightCm] = useState<string>('168');
  const [weightKg, setWeightKg] = useState<string>('58');
  const [selectedPalettes, setSelectedPalettes] = useState<string[]>(['Monochrome B&W', 'Earth & Neutral']);
  const [texturePreferences, setTexturePreferences] = useState<string[]>(['Soft Cotton', 'Cozy Knit']);
  const [preferredStyles, setPreferredStyles] = useState<string[]>(['Casual Everyday', 'Streetwear']);
  const [commonOccasions, setCommonOccasions] = useState<string[]>(['School / Campus', 'Casual Hangouts']);
  const [fitPreference, setFitPreference] = useState<string>('Regular / Relaxed Fit');

  // Character Customization State
  const [hairStyle, setHairStyle] = useState<string>('female_long_tucked');
  const [hairColor, setHairColor] = useState<string>('#1C1613');
  const [skinTone, setSkinTone] = useState<string>('#F1CBA9');
  const [faceStyle, setFaceStyle] = useState<string>('friendly');

  const [busy, setBusy] = useState<boolean>(false);

  const toggleArrayItem = (item: string, currentList: string[], setter: (val: string[]) => void) => {
    if (currentList.includes(item)) {
      setter(currentList.filter((x) => x !== item));
    } else {
      setter([...currentList, item]);
    }
  };

  const handleGenderSelect = (g: 'male' | 'female') => {
    setGender(g);
    if (g === 'male' && hairStyle.startsWith('female_')) {
      setHairStyle('male_twoblock');
    } else if (g === 'female' && hairStyle.startsWith('male_')) {
      setHairStyle('female_long_tucked');
    }
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
      hairStyle,
      hairColor,
      skinTone,
      faceStyle,
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
      hairStyle,
      hairColor,
      skinTone,
      faceStyle,
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
      case 0:
        return "Hi! I'm Mel, your AI chameleon stylist. Let's customize your wardrobe avatar in 60 seconds!";
      case 1:
        return 'Tell me your stage in life so I can tailor campus dress codes & daily vibes!';
      case 2:
        return 'Watch your 2D mannequin adapt in real time as you adjust gender, hair, skin, and face style!';
      case 3:
        return 'Which palettes make up your core closet? I use these for smart color harmonics.';
      case 4:
        return 'Fabrics and styles define how your clothes feel and look on you!';
      case 5:
        return 'Almost ready! Where do you go and how do you like your clothes to fit?';
      default:
        return 'StyleSense adapts to your closet!';
    }
  }, [page]);

  const handleFinish = async () => {
    setBusy(true);
    try {
      await AsyncStorage.multiSet([
        ['@stylesense_onboarding_complete', 'true'],
        ['stylesense_onboarding_profile', JSON.stringify(payload)],
      ]);

      await setMannequinSkinTone(skinTone);
      await setSettingsHairStyle(hairStyle);
      await setSettingsHairColor(hairColor);
      await setSettingsFaceStyle(faceStyle);

      if (isLoggedIn) {
        await updateProfile(payload as any);
        if (profile?.displayName) {
          syncCreatorNickname(profile.displayName);
        }
      }
      onComplete();
    } catch (e) {
      console.error('Error completing onboarding:', e);
      onComplete();
    } finally {
      setBusy(false);
    }
  };

  const handleSkipToLogin = async () => {
    try {
      await AsyncStorage.multiSet([
        ['@stylesense_onboarding_complete', 'true'],
        ['stylesense_onboarding_profile', JSON.stringify(payload)],
      ]);
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
      setPage((prev) => prev + 1);
    } else {
      handleFinish();
    }
  };

  const handleBack = () => {
    if (page > 0) {
      setPage((prev) => prev - 1);
    }
  };

  const availableHairstyles = gender === 'female' ? FEMALE_HAIRSTYLES : MALE_HAIRSTYLES;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardContainer}
      >
        {/* Top App Header with Brand & Skip Button */}
        <View style={styles.topBar}>
          <Text style={[styles.brandText, { color: theme.text }]}>
            Style<Text style={{ color: '#4D9A65' }}>Sense</Text>
          </Text>

          <Pressable onPress={handleSkipToLogin} style={styles.skipButton}>
            <Text style={[styles.skipButtonText, { color: theme.textMuted }]}>
              Skip to Sign In →
            </Text>
          </Pressable>
        </View>

        {/* 6-Step Segmented Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressSegmentsRow}>
            {Array.from({ length: totalPages }).map((_, idx) => (
              <View
                key={idx}
                style={[
                  styles.progressSegment,
                  {
                    backgroundColor: idx <= page ? '#4D9A65' : '#E2E8F0',
                  },
                ]}
              />
            ))}
          </View>
          <View style={styles.stepCountRow}>
            <Text style={[styles.stepLabel, { color: '#4D9A65' }]}>
              STEP {page + 1} OF {totalPages}
            </Text>
          </View>
        </View>

        {/* Mel Stylist Non-Overlapping Header Row */}
        <View style={[styles.melHeaderRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.melBubbleFlex}>
            <MelSpeechBubble variant={melOutfit} message={melMessage} position="inline" />
          </View>
          <MelMascot outfit={melOutfit} size={84} waving={page === 0} />
        </View>

        {/* Interactive Scrollable Content */}
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ================= PAGE 0: WELCOME & FEATURE PILLS ================= */}
          {page === 0 && (
            <View style={styles.pageContainer}>
              <Text style={[styles.heroHeading, { color: theme.text }]}>
                Your Personal AI Wardrobe Stylist
              </Text>
              <Text style={[styles.heroSubheading, { color: theme.textMuted }]}>
                Mix, match, and preview outfits on your custom 2D avatar powered by real-time weather and closet intelligence.
              </Text>

              {/* Duo Preview Card (Avatar + Mel) */}
              <View style={[styles.duoPreviewCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <View style={styles.mannequinPreviewWrap}>
                  <Mannequin2D
                    compact
                    profile={{ gender: 'female', heightCm: '168', weightKg: '58' }}
                    skinTone={skinTone}
                    hairStyle={hairStyle}
                    hairColor={hairColor}
                    faceStyle={faceStyle}
                    items={DEMO_AVATAR_CLOTHES}
                  />
                </View>
                <View style={styles.duoCardDivider} />
                <View style={styles.duoFeaturePills}>
                  <View style={styles.featurePill}>
                    <View style={[styles.featureIconWrap, { backgroundColor: '#E8F5E9' }]}>
                      <Ionicons name="camera-outline" size={18} color="#2E7D32" />
                    </View>
                    <View style={styles.featureTextWrap}>
                      <Text style={[styles.featurePillTitle, { color: theme.text }]}>Snap Your Closet</Text>
                      <Text style={[styles.featurePillSub, { color: theme.textMuted }]}>
                        Auto background removal & instant tagging
                      </Text>
                    </View>
                  </View>

                  <View style={styles.featurePill}>
                    <View style={[styles.featureIconWrap, { backgroundColor: '#EDE7F6' }]}>
                      <Ionicons name="body-outline" size={18} color="#673AB7" />
                    </View>
                    <View style={styles.featureTextWrap}>
                      <Text style={[styles.featurePillTitle, { color: theme.text }]}>2D Outfit Avatar</Text>
                      <Text style={[styles.featurePillSub, { color: theme.textMuted }]}>
                        Try on full looks before stepping out
                      </Text>
                    </View>
                  </View>

                  <View style={styles.featurePill}>
                    <View style={[styles.featureIconWrap, { backgroundColor: '#FFF3E0' }]}>
                      <Ionicons name="partly-sunny-outline" size={18} color="#E65100" />
                    </View>
                    <View style={styles.featureTextWrap}>
                      <Text style={[styles.featurePillTitle, { color: theme.text }]}>Weather-Smart Looks</Text>
                      <Text style={[styles.featurePillSub, { color: theme.textMuted }]}>
                        Tailored to humidity, rain & temp
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* ================= PAGE 1: AGE GROUP ================= */}
          {page === 1 && (
            <View style={styles.pageContainer}>
              <Text style={[styles.heroHeading, { color: theme.text }]}>What is your life stage?</Text>
              <Text style={[styles.heroSubheading, { color: theme.textMuted }]}>
                Mel curates age-appropriate trends, campus dress codes, and fit guidelines for you.
              </Text>

              <View style={styles.twoColumnCardsRow}>
                {/* 13-17 Teen Card */}
                <Pressable
                  onPress={() => setAgeGroup('13-17')}
                  style={[
                    styles.ageCard,
                    { backgroundColor: theme.surface, borderColor: theme.border },
                    ageGroup === '13-17' && styles.activeAgeCard,
                  ]}
                >
                  <View style={styles.ageCardTopRow}>
                    <View style={[styles.ageBadge, { backgroundColor: '#E8F5E9' }]}>
                      <Ionicons name="school" size={20} color="#2E7D32" />
                    </View>
                    {ageGroup === '13-17' && (
                      <Ionicons name="checkmark-circle" size={22} color="#4D9A65" />
                    )}
                  </View>
                  <Text style={[styles.ageNumber, { color: theme.text }]}>13–17</Text>
                  <Text style={[styles.ageTitle, { color: theme.text }]}>Teen & High School</Text>
                  <Text style={[styles.ageDesc, { color: theme.textMuted }]}>
                    Comfortable daily fits, school casual, athletic trends, and weekend hangouts.
                  </Text>
                  <View style={styles.tagChipsWrap}>
                    <Text style={styles.tagPill}>#SchoolFit</Text>
                    <Text style={styles.tagPill}>#Activewear</Text>
                    <Text style={styles.tagPill}>#Streetwear</Text>
                  </View>
                </Pressable>

                {/* 18-22 Campus Card */}
                <Pressable
                  onPress={() => setAgeGroup('18-22')}
                  style={[
                    styles.ageCard,
                    { backgroundColor: theme.surface, borderColor: theme.border },
                    ageGroup === '18-22' && styles.activeAgeCard,
                  ]}
                >
                  <View style={styles.ageCardTopRow}>
                    <View style={[styles.ageBadge, { backgroundColor: '#EDE7F6' }]}>
                      <Ionicons name="school-outline" size={20} color="#673AB7" />
                    </View>
                    {ageGroup === '18-22' && (
                      <Ionicons name="checkmark-circle" size={22} color="#4D9A65" />
                    )}
                  </View>
                  <Text style={[styles.ageNumber, { color: theme.text }]}>18–22</Text>
                  <Text style={[styles.ageTitle, { color: theme.text }]}>Campus & Young Adult</Text>
                  <Text style={[styles.ageDesc, { color: theme.textMuted }]}>
                    College campus style, internships, smart casual networking, and nightlife.
                  </Text>
                  <View style={styles.tagChipsWrap}>
                    <Text style={styles.tagPill}>#CampusStyle</Text>
                    <Text style={styles.tagPill}>#SmartCasual</Text>
                    <Text style={styles.tagPill}>#Internship</Text>
                  </View>
                </Pressable>
              </View>
            </View>
          )}

          {/* ================= PAGE 2: GENDER, HEIGHT, WEIGHT & CHARACTER CUSTOMIZER ================= */}
          {page === 2 && (
            <View style={styles.pageContainer}>
              <Text style={[styles.heroHeading, { color: theme.text }]}>Let's shape your mannequin</Text>
              <Text style={[styles.heroSubheading, { color: theme.textMuted }]}>
                Tailor avatar proportions, hairstyle, skin tone, and face style in real time.
              </Text>

              {/* Live Morphing Mannequin Box */}
              <View style={[styles.liveMannequinBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Mannequin2D
                  compact
                  profile={{
                    gender,
                    heightCm,
                    weightKg,
                  }}
                  skinTone={skinTone}
                  hairStyle={hairStyle}
                  hairColor={hairColor}
                  faceStyle={faceStyle}
                  items={DEMO_AVATAR_CLOTHES}
                />
                <View style={styles.liveBadge}>
                  <View style={styles.greenPulseDot} />
                  <Text style={styles.liveBadgeText}>Live Avatar Preview</Text>
                </View>
              </View>

              {/* Gender Segment Toggle */}
              <View style={styles.genderToggleRow}>
                <Pressable
                  onPress={() => handleGenderSelect('male')}
                  style={[
                    styles.genderButton,
                    { backgroundColor: theme.surface, borderColor: theme.border },
                    gender === 'male' && styles.genderButtonActive,
                  ]}
                >
                  <Ionicons
                    name="man"
                    size={18}
                    color={gender === 'male' ? '#FFFFFF' : theme.text}
                  />
                  <Text
                    style={[
                      styles.genderButtonText,
                      { color: gender === 'male' ? '#FFFFFF' : theme.text },
                    ]}
                  >
                    Male Avatar
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => handleGenderSelect('female')}
                  style={[
                    styles.genderButton,
                    { backgroundColor: theme.surface, borderColor: theme.border },
                    gender === 'female' && styles.genderButtonActive,
                  ]}
                >
                  <Ionicons
                    name="woman"
                    size={18}
                    color={gender === 'female' ? '#FFFFFF' : theme.text}
                  />
                  <Text
                    style={[
                      styles.genderButtonText,
                      { color: gender === 'female' ? '#FFFFFF' : theme.text },
                    ]}
                  >
                    Female Avatar
                  </Text>
                </Pressable>
              </View>

              {/* Height & Weight Inputs with Steppers */}
              <View style={styles.measurementsRow}>
                {/* Height */}
                <View style={[styles.measurementCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Text style={[styles.measurementLabel, { color: theme.textMuted }]}>HEIGHT</Text>
                  <View style={styles.measurementValRow}>
                    <TextInput
                      value={heightCm}
                      onChangeText={setHeightCm}
                      keyboardType="numeric"
                      style={[styles.measurementInput, { color: theme.text }]}
                    />
                    <Text style={[styles.measurementUnit, { color: theme.textMuted }]}>cm</Text>
                  </View>
                  <View style={styles.stepperRow}>
                    <Pressable
                      onPress={() => setHeightCm((prev) => String(Math.max(120, (parseInt(prev, 10) || 165) - 2)))}
                      style={styles.stepperBtn}
                    >
                      <Ionicons name="remove" size={16} color={theme.text} />
                    </Pressable>
                    <Pressable
                      onPress={() => setHeightCm((prev) => String(Math.min(220, (parseInt(prev, 10) || 165) + 2)))}
                      style={styles.stepperBtn}
                    >
                      <Ionicons name="add" size={16} color={theme.text} />
                    </Pressable>
                  </View>
                </View>

                {/* Weight */}
                <View style={[styles.measurementCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Text style={[styles.measurementLabel, { color: theme.textMuted }]}>WEIGHT</Text>
                  <View style={styles.measurementValRow}>
                    <TextInput
                      value={weightKg}
                      onChangeText={setWeightKg}
                      keyboardType="numeric"
                      style={[styles.measurementInput, { color: theme.text }]}
                    />
                    <Text style={[styles.measurementUnit, { color: theme.textMuted }]}>kg</Text>
                  </View>
                  <View style={styles.stepperRow}>
                    <Pressable
                      onPress={() => setWeightKg((prev) => String(Math.max(35, (parseInt(prev, 10) || 60) - 2)))}
                      style={styles.stepperBtn}
                    >
                      <Ionicons name="remove" size={16} color={theme.text} />
                    </Pressable>
                    <Pressable
                      onPress={() => setWeightKg((prev) => String(Math.min(180, (parseInt(prev, 10) || 60) + 2)))}
                      style={styles.stepperBtn}
                    >
                      <Ionicons name="add" size={16} color={theme.text} />
                    </Pressable>
                  </View>
                </View>
              </View>

              {/* Character Attributes Customization */}
              {/* 1. Hairstyles */}
              <Text style={[styles.sectionTitle, { color: '#4D9A65', marginTop: 18 }]}>HAIRSTYLE</Text>
              <View style={styles.hairOptionGrid}>
                {availableHairstyles.map((hs) => {
                  const isActive = hairStyle === hs.id;
                  return (
                    <Pressable
                      key={hs.id}
                      onPress={() => setHairStyle(hs.id)}
                      style={[
                        styles.hairPill,
                        { backgroundColor: theme.surface, borderColor: theme.border },
                        isActive && styles.hairPillActive,
                      ]}
                    >
                      <Text style={[styles.hairPillText, { color: isActive ? '#1B4D1F' : theme.text }]}>
                        {hs.label}
                      </Text>
                      {isActive && <Ionicons name="checkmark-circle" size={14} color="#4D9A65" />}
                    </Pressable>
                  );
                })}
              </View>

              {/* 2. Hair Color */}
              <Text style={[styles.sectionTitle, { color: '#4D9A65', marginTop: 16 }]}>HAIR COLOR</Text>
              <View style={styles.swatchRow}>
                {HAIR_COLORS.map((hc) => {
                  const isActive = hairColor === hc.hex;
                  return (
                    <Pressable
                      key={hc.hex}
                      onPress={() => setHairColor(hc.hex)}
                      style={[
                        styles.swatchItem,
                        isActive && { borderColor: '#4D9A65', transform: [{ scale: 1.1 }] },
                      ]}
                    >
                      <View style={[styles.swatchDot, { backgroundColor: hc.hex }]} />
                      <Text style={[styles.swatchText, { color: theme.text }]} numberOfLines={1}>
                        {hc.label.split(' ')[0]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* 3. Skin Tone */}
              <Text style={[styles.sectionTitle, { color: '#4D9A65', marginTop: 16 }]}>SKIN TONE</Text>
              <View style={styles.swatchRow}>
                {SKIN_TONES.map((st) => {
                  const isActive = skinTone === st.hex;
                  return (
                    <Pressable
                      key={st.hex}
                      onPress={() => setSkinTone(st.hex)}
                      style={[
                        styles.swatchItem,
                        isActive && { borderColor: '#4D9A65', transform: [{ scale: 1.1 }] },
                      ]}
                    >
                      <View style={[styles.swatchDot, { backgroundColor: st.hex }]} />
                      <Text style={[styles.swatchText, { color: theme.text }]} numberOfLines={1}>
                        {st.label.split(' ')[0]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* 4. Face Style */}
              <Text style={[styles.sectionTitle, { color: '#4D9A65', marginTop: 16 }]}>FACE STYLE</Text>
              <View style={styles.faceStyleGrid}>
                {FACE_STYLES.map((fs) => {
                  const isActive = faceStyle === fs.id;
                  return (
                    <Pressable
                      key={fs.id}
                      onPress={() => setFaceStyle(fs.id)}
                      style={[
                        styles.facePill,
                        { backgroundColor: theme.surface, borderColor: theme.border },
                        isActive && styles.facePillActive,
                      ]}
                    >
                      <Ionicons name={fs.icon as any} size={16} color={isActive ? '#2E7D32' : theme.text} />
                      <Text style={[styles.facePillText, { color: isActive ? '#1B4D1F' : theme.text }]}>
                        {fs.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* ================= PAGE 3: USUAL STYLE COLORS ================= */}
          {page === 3 && (
            <View style={styles.pageContainer}>
              <Text style={[styles.heroHeading, { color: theme.text }]}>Which colors do you reach for?</Text>
              <Text style={[styles.heroSubheading, { color: theme.textMuted }]}>
                Choose the color palettes that dominate your wardrobe. Select all that fit your personal style.
              </Text>

              <View style={styles.palettesList}>
                {PALETTES.map((pal) => {
                  const isSelected = selectedPalettes.includes(pal.name);
                  return (
                    <Pressable
                      key={pal.id}
                      onPress={() => toggleArrayItem(pal.name, selectedPalettes, setSelectedPalettes)}
                      style={[
                        styles.paletteCard,
                        { backgroundColor: theme.surface, borderColor: theme.border },
                        isSelected && styles.activePaletteCard,
                      ]}
                    >
                      <View style={styles.paletteHeaderRow}>
                        <View style={styles.paletteTextWrap}>
                          <Text style={[styles.paletteName, { color: theme.text }]}>{pal.name}</Text>
                          <Text style={[styles.paletteDesc, { color: theme.textMuted }]}>
                            {pal.description}
                          </Text>
                        </View>
                        <Ionicons
                          name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                          size={24}
                          color={isSelected ? '#4D9A65' : theme.border}
                        />
                      </View>

                      {/* 4 Swatch Circles */}
                      <View style={styles.swatchCirclesRow}>
                        {pal.colors.map((c, i) => (
                          <View
                            key={i}
                            style={[
                              styles.swatchCircle,
                              { backgroundColor: c, borderColor: c === '#FFFFFF' ? '#D1D5DB' : 'transparent' },
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

          {/* ================= PAGE 4: TEXTURES & STYLES ================= */}
          {page === 4 && (
            <View style={styles.pageContainer}>
              <Text style={[styles.heroHeading, { color: theme.text }]}>Textures & Fashion Styles</Text>
              <Text style={[styles.heroSubheading, { color: theme.textMuted }]}>
                Pick the fabrics and aesthetics you feel most confident wearing.
              </Text>

              {/* Textures Section */}
              <Text style={[styles.sectionTitle, { color: '#4D9A65' }]}>PREFERRED TEXTURES</Text>
              <View style={styles.chipGrid}>
                {TEXTURE_OPTIONS.map((item) => {
                  const isSelected = texturePreferences.includes(item.label);
                  return (
                    <Pressable
                      key={item.label}
                      onPress={() => toggleArrayItem(item.label, texturePreferences, setTexturePreferences)}
                      style={[
                        styles.filterChip,
                        { backgroundColor: theme.surface, borderColor: theme.border },
                        isSelected && styles.filterChipActive,
                      ]}
                    >
                      <Ionicons
                        name={item.icon as any}
                        size={16}
                        color={isSelected ? '#2E7D32' : theme.textMuted}
                      />
                      <Text
                        style={[
                          styles.filterChipText,
                          { color: isSelected ? '#1B4D1F' : theme.text },
                        ]}
                      >
                        {item.label}
                      </Text>
                      {isSelected && (
                        <Ionicons name="checkmark" size={14} color="#2E7D32" />
                      )}
                    </Pressable>
                  );
                })}
              </View>

              {/* Styles Section */}
              <Text style={[styles.sectionTitle, { color: '#4D9A65', marginTop: 20 }]}>
                FASHION STYLES
              </Text>
              <View style={styles.styleGrid}>
                {STYLE_OPTIONS.map((item) => {
                  const isSelected = preferredStyles.includes(item.label);
                  return (
                    <Pressable
                      key={item.label}
                      onPress={() => toggleArrayItem(item.label, preferredStyles, setPreferredStyles)}
                      style={[
                        styles.styleCard,
                        { backgroundColor: theme.surface, borderColor: theme.border },
                        isSelected && styles.styleCardActive,
                      ]}
                    >
                      <Ionicons
                        name={item.icon as any}
                        size={20}
                        color={isSelected ? '#2E7D32' : theme.accent}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.styleCardTitle, { color: theme.text }]}>
                          {item.label}
                        </Text>
                        <Text style={[styles.styleCardVibe, { color: theme.textMuted }]}>
                          {item.vibe}
                        </Text>
                      </View>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={18} color="#4D9A65" />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* ================= PAGE 5: OCCASIONS & FIT ================= */}
          {page === 5 && (
            <View style={styles.pageContainer}>
              <Text style={[styles.heroHeading, { color: theme.text }]}>Occasions & Preferred Fit</Text>
              <Text style={[styles.heroSubheading, { color: theme.textMuted }]}>
                Final touch! Tell Mel what cut looks best on your body and where you spend your time.
              </Text>

              {/* Fit Silhouette Cards */}
              <Text style={[styles.sectionTitle, { color: '#4D9A65' }]}>FIT SILHOUETTE</Text>
              <View style={styles.fitList}>
                {FIT_OPTIONS.map((fit) => {
                  const isSelected = fitPreference === fit.id;
                  return (
                    <Pressable
                      key={fit.id}
                      onPress={() => setFitPreference(fit.id)}
                      style={[
                        styles.fitCard,
                        { backgroundColor: theme.surface, borderColor: theme.border },
                        isSelected && styles.fitCardActive,
                      ]}
                    >
                      <View style={styles.fitHeaderRow}>
                        <View style={[styles.fitIconCircle, { backgroundColor: isSelected ? '#E8F5E9' : '#F1F5F9' }]}>
                          <Ionicons
                            name={fit.icon as any}
                            size={18}
                            color={isSelected ? '#2E7D32' : theme.textMuted}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.fitTitle, { color: theme.text }]}>{fit.title}</Text>
                          <Text style={[styles.fitDesc, { color: theme.textMuted }]}>
                            {fit.description}
                          </Text>
                        </View>
                        <Ionicons
                          name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                          size={22}
                          color={isSelected ? '#4D9A65' : theme.border}
                        />
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              {/* Common Occasions Chips */}
              <Text style={[styles.sectionTitle, { color: '#4D9A65', marginTop: 20 }]}>
                COMMON OCCASIONS
              </Text>
              <View style={styles.chipGrid}>
                {OCCASION_OPTIONS.map((item) => {
                  const isSelected = commonOccasions.includes(item.label);
                  return (
                    <Pressable
                      key={item.label}
                      onPress={() => toggleArrayItem(item.label, commonOccasions, setCommonOccasions)}
                      style={[
                        styles.filterChip,
                        { backgroundColor: theme.surface, borderColor: theme.border },
                        isSelected && styles.filterChipActive,
                      ]}
                    >
                      <Ionicons
                        name={item.icon as any}
                        size={16}
                        color={isSelected ? '#2E7D32' : theme.textMuted}
                      />
                      <Text
                        style={[
                          styles.filterChipText,
                          { color: isSelected ? '#1B4D1F' : theme.text },
                        ]}
                      >
                        {item.label}
                      </Text>
                      {isSelected && (
                        <Ionicons name="checkmark" size={14} color="#2E7D32" />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}
        </ScrollView>

        {/* Bottom Navigation Buttons */}
        <View style={[styles.bottomBar, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
          {page > 0 ? (
            <Pressable onPress={handleBack} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={18} color={theme.text} />
              <Text style={[styles.backBtnText, { color: theme.text }]}>Back</Text>
            </Pressable>
          ) : (
            <View style={{ width: 60 }} />
          )}

          <Pressable
            onPress={handleNext}
            disabled={busy}
            style={[styles.primaryNextBtn, { backgroundColor: '#24513B' }]}
          >
            {busy ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Text style={styles.primaryNextBtnText}>
                  {page === totalPages - 1 ? 'Finish & Sign In' : 'Continue'}
                </Text>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              </>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  keyboardContainer: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
  },
  brandText: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  skipButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  skipButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  progressContainer: {
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  progressSegmentsRow: {
    flexDirection: 'row',
    gap: 6,
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 4,
  },
  progressSegment: {
    flex: 1,
    height: 5,
    borderRadius: 3,
  },
  stepCountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  stepLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  melHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginVertical: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
  },
  melBubbleFlex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  pageContainer: {
    paddingTop: 8,
  },
  heroHeading: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  heroSubheading: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  duoPreviewCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  mannequinPreviewWrap: {
    height: 200,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  duoCardDivider: {
    width: '100%',
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 14,
  },
  duoFeaturePills: {
    width: '100%',
    gap: 10,
  },
  featurePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTextWrap: {
    flex: 1,
  },
  featurePillTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  featurePillSub: {
    fontSize: 12,
  },
  twoColumnCardsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  ageCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 2,
    padding: 14,
    minHeight: 220,
    justifyContent: 'space-between',
  },
  activeAgeCard: {
    borderColor: '#4D9A65',
    backgroundColor: '#F0F9F1',
    shadowColor: '#4D9A65',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  ageCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ageBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ageNumber: {
    fontSize: 28,
    fontWeight: '900',
    marginTop: 8,
  },
  ageTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 6,
  },
  ageDesc: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 10,
  },
  tagChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  tagPill: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2E7D32',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  liveMannequinBox: {
    height: 230,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 14,
    overflow: 'hidden',
  },
  liveBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  greenPulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4D9A65',
  },
  liveBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#24513B',
  },
  genderToggleRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  genderButton: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  genderButtonActive: {
    backgroundColor: '#24513B',
    borderColor: '#24513B',
  },
  genderButtonText: {
    fontSize: 14,
    fontWeight: '800',
  },
  measurementsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  measurementCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
  },
  measurementLabel: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  measurementValRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  measurementInput: {
    fontSize: 26,
    fontWeight: '900',
    minWidth: 60,
    padding: 0,
  },
  measurementUnit: {
    fontSize: 14,
    fontWeight: '700',
  },
  stepperRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  stepperBtn: {
    flex: 1,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hairOptionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  hairPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  hairPillActive: {
    borderColor: '#4D9A65',
    backgroundColor: '#E8F5E9',
  },
  hairPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  swatchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  swatchItem: {
    alignItems: 'center',
    padding: 3,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'transparent',
    width: '18%',
  },
  swatchDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  swatchText: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 3,
    textAlign: 'center',
  },
  faceStyleGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  facePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  facePillActive: {
    borderColor: '#4D9A65',
    backgroundColor: '#E8F5E9',
  },
  facePillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  palettesList: {
    gap: 10,
  },
  paletteCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 14,
  },
  activePaletteCard: {
    borderColor: '#4D9A65',
    backgroundColor: '#F0F9F1',
  },
  paletteHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  paletteTextWrap: {
    flex: 1,
    paddingRight: 8,
  },
  paletteName: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 2,
  },
  paletteDesc: {
    fontSize: 12,
  },
  swatchCirclesRow: {
    flexDirection: 'row',
    gap: 8,
  },
  swatchCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 8,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  filterChipActive: {
    backgroundColor: '#E8F5E9',
    borderColor: '#4D9A65',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  styleGrid: {
    gap: 8,
  },
  styleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  styleCardActive: {
    backgroundColor: '#E8F5E9',
    borderColor: '#4D9A65',
  },
  styleCardTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  styleCardVibe: {
    fontSize: 12,
  },
  fitList: {
    gap: 10,
  },
  fitCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 14,
  },
  fitCardActive: {
    borderColor: '#4D9A65',
    backgroundColor: '#F0F9F1',
  },
  fitHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  fitIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fitTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 2,
  },
  fitDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  primaryNextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 99,
    shadowColor: '#24513B',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryNextBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
});
