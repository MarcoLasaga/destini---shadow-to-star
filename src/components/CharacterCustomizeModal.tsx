import React, { useState, useEffect } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../hooks/useAppTheme';
import { useSettings } from '../contexts/SettingsContext';
import { useProfile } from '../contexts/ProfileContext';
import Mannequin2D from './Mannequin2D';
import CameraSkinScanModal, { SkinScanResult } from './CameraSkinScanModal';

interface CharacterCustomizeModalProps {
  visible: boolean;
  onClose: () => void;
  onSave?: (data: {
    gender: 'male' | 'female';
    heightCm: string;
    weightKg: string;
    hairStyle: string;
    hairColor: string;
    skinTone: string;
    faceStyle: string;
  }) => void;
  initialGender?: 'male' | 'female';
}

export const MALE_HAIRSTYLES = [
  { id: 'male_twoblock', label: 'Two-Block', desc: 'Curtain bangs' },
  { id: 'male_comma', label: 'Comma Hair', desc: 'Side-part curve' },
  { id: 'male_spiky', label: 'Spiky Crop', desc: 'Textured taper' },
  { id: 'male_curly', label: 'Curly Fade', desc: 'Wavy crown' },
];

export const FEMALE_HAIRSTYLES = [
  { id: 'female_long_tucked', label: 'Long Layered', desc: 'Flowing behind ears' },
  { id: 'female_bob', label: 'Chin Bob', desc: 'Soft fringe' },
  { id: 'female_ponytail', label: 'High Pony', desc: 'Sleek sweep' },
  { id: 'female_buns', label: 'Space Buns', desc: 'Double buns' },
];

export const HAIR_COLORS = [
  { hex: '#1C1613', label: 'Jet Black' },
  { hex: '#3B261D', label: 'Espresso' },
  { hex: '#6E473B', label: 'Chestnut' },
  { hex: '#C68B59', label: 'Honey Blonde' },
  { hex: '#8B2635', label: 'Burgundy' },
];

export const SKIN_TONES = [
  { hex: '#F7E1D3', label: 'Fair Porcelain' },
  { hex: '#F1CBA9', label: 'Warm Ivory' },
  { hex: '#E2B187', label: 'Golden Sand' },
  { hex: '#C99266', label: 'Warm Honey' },
  { hex: '#A66E46', label: 'Rich Bronze' },
];

export const FACE_STYLES = [
  { id: 'friendly', label: 'Warm Smile', icon: 'happy-outline' },
  { id: 'cool', label: 'Confident Smirk', icon: 'glasses-outline' },
  { id: 'wink', label: 'Playful Wink', icon: 'sparkles-outline' },
];

export default function CharacterCustomizeModal({
  visible,
  onClose,
  onSave,
  initialGender,
}: CharacterCustomizeModalProps) {
  const theme = useAppTheme();
  const {
    mannequinSkinTone,
    setMannequinSkinTone,
    hairStyle: settingsHairStyle,
    setHairStyle: setSettingsHairStyle,
    hairColor: settingsHairColor,
    setHairColor: setSettingsHairColor,
    faceStyle: settingsFaceStyle,
    setFaceStyle: setSettingsFaceStyle,
  } = useSettings();
  const { profile, updateProfile } = useProfile();

  const [gender, setGender] = useState<'male' | 'female'>(
    initialGender || (profile.gender === 'female' ? 'female' : 'male')
  );
  const [heightCm, setHeightCm] = useState<string>(profile.heightCm || '170');
  const [weightKg, setWeightKg] = useState<string>(profile.weightKg || '62');
  const [hairStyle, setHairStyle] = useState<string>(settingsHairStyle || 'male_twoblock');
  const [hairColor, setHairColor] = useState<string>(settingsHairColor || '#1C1613');
  const [skinTone, setSkinTone] = useState<string>(mannequinSkinTone || '#F1CBA9');
  const [faceStyle, setFaceStyle] = useState<string>(settingsFaceStyle || 'friendly');
  const [zoomMode, setZoomMode] = useState<'head' | 'body'>('body');
  const [activeTab, setActiveTab] = useState<'hair' | 'skin'>('hair');
  const [cameraScanVisible, setCameraScanVisible] = useState<boolean>(false);

  useEffect(() => {
    if (visible) {
      const g = initialGender || (profile.gender === 'female' ? 'female' : 'male');
      setGender(g);
      setHeightCm(profile.heightCm || '170');
      setWeightKg(profile.weightKg || '62');
      setSkinTone(mannequinSkinTone || '#F1CBA9');
      setHairColor(settingsHairColor || '#1C1613');
      setFaceStyle(settingsFaceStyle || 'friendly');
      if (settingsHairStyle) {
        setHairStyle(settingsHairStyle);
      } else {
        setHairStyle(g === 'female' ? 'female_long_tucked' : 'male_twoblock');
      }
    }
  }, [
    visible,
    initialGender,
    profile.gender,
    profile.heightCm,
    profile.weightKg,
    mannequinSkinTone,
    settingsHairColor,
    settingsFaceStyle,
    settingsHairStyle,
  ]);

  const handleGenderChange = (newGender: 'male' | 'female') => {
    setGender(newGender);
    if (newGender === 'female' && hairStyle.startsWith('male_')) {
      setHairStyle('female_long_tucked');
    } else if (newGender === 'male' && hairStyle.startsWith('female_')) {
      setHairStyle('male_twoblock');
    }
  };

  const stepValue = (
    current: string,
    delta: number,
    min: number,
    max: number,
    setter: (v: string) => void
  ) => {
    const parsed = parseInt(current, 10) || min;
    const next = Math.max(min, Math.min(max, parsed + delta));
    setter(String(next));
  };

  const handleApplyScan = (scan: SkinScanResult) => {
    setSkinTone(scan.skinTone);
    setHairColor(scan.hairColor);
  };

  const handleSave = async () => {
    await setMannequinSkinTone(skinTone);
    await setSettingsHairStyle(hairStyle);
    await setSettingsHairColor(hairColor);
    await setSettingsFaceStyle(faceStyle);

    await updateProfile({
      gender,
      heightCm,
      weightKg,
      hairStyle,
      hairColor,
      skinTone,
      faceStyle,
    } as any);

    if (onSave) {
      onSave({
        gender,
        heightCm,
        weightKg,
        hairStyle,
        hairColor,
        skinTone,
        faceStyle,
      });
    }

    onClose();
  };

  const availableHairstyles = gender === 'female' ? FEMALE_HAIRSTYLES : MALE_HAIRSTYLES;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.sheet, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.dragHandle} />

          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={[styles.title, { color: theme.text }]}>Customize Character</Text>
              <Text style={[styles.subtitle, { color: theme.textMuted }]}>
                Personalize your 2D avatar’s hair, skin, and face style
              </Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={theme.textMuted} />
            </Pressable>
          </View>

          {/* ZONE 1: PINNED TOP PREVIEW STAGE (Fixed height: 210, never scrolls away) */}
          <View
            style={[
              styles.previewBox,
              { backgroundColor: theme.mode === 'dark' ? '#231B2C' : '#FAF7F0' },
            ]}
          >
            {/* Zoom Pill Toggle in top-right */}
            <Pressable
              onPress={() => setZoomMode((m) => (m === 'head' ? 'body' : 'head'))}
              style={styles.zoomTogglePill}
              accessibilityLabel="Toggle close-up view"
            >
              <Ionicons
                name={zoomMode === 'head' ? 'body-outline' : 'search-outline'}
                size={12}
                color="#264C3B"
              />
              <Text style={styles.zoomToggleText}>
                {zoomMode === 'head' ? '🧍 Full Body' : '🔍 Zoom Face'}
              </Text>
            </Pressable>

            <View style={styles.mannequinWrap}>
              <Mannequin2D
                compact
                zoomMode={zoomMode}
                profile={{ gender, heightCm, weightKg }}
                skinTone={skinTone}
                hairStyle={hairStyle}
                hairColor={hairColor}
                faceStyle={faceStyle}
                viewBoxOverride={zoomMode === 'head' ? '45 0 150 165' : '0 0 240 385'}
              />
            </View>
          </View>

          {/* PINNED CATEGORY SWITCHER PILL BAR */}
          <View style={styles.tabBar}>
            <Pressable
              onPress={() => setActiveTab('hair')}
              style={[styles.tabBtn, activeTab === 'hair' && styles.tabBtnActive]}
            >
              <Text style={[styles.tabBtnText, activeTab === 'hair' && styles.tabBtnTextActive]}>
                💇 Gender & Hair
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setActiveTab('skin')}
              style={[styles.tabBtn, activeTab === 'skin' && styles.tabBtnActive]}
            >
              <Text style={[styles.tabBtnText, activeTab === 'skin' && styles.tabBtnTextActive]}>
                🎨 Skin & Face
              </Text>
            </Pressable>
          </View>

          {/* ZONE 2: EXPLICIT MIN-HEIGHT OPTIONS CONTAINER (Never collapses to 0px) */}
          <View style={styles.optionsContainer}>
            {activeTab === 'hair' ? (
              <View style={styles.tabPane}>
                {/* Gender + Height/Weight Steppers Row */}
                <View style={styles.topControlsRow}>
                  {/* Gender Toggle */}
                  <View style={styles.genderRow}>
                    <Pressable
                      onPress={() => handleGenderChange('male')}
                      style={[
                        styles.genderBtn,
                        gender === 'male' && styles.genderBtnActive,
                        { borderColor: theme.border },
                      ]}
                    >
                      <Ionicons
                        name="man"
                        size={15}
                        color={gender === 'male' ? '#FFFFFF' : theme.text}
                      />
                      <Text
                        style={[
                          styles.genderBtnText,
                          { color: gender === 'male' ? '#FFFFFF' : theme.text },
                        ]}
                      >
                        Male
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => handleGenderChange('female')}
                      style={[
                        styles.genderBtn,
                        gender === 'female' && styles.genderBtnActive,
                        { borderColor: theme.border },
                      ]}
                    >
                      <Ionicons
                        name="woman"
                        size={15}
                        color={gender === 'female' ? '#FFFFFF' : theme.text}
                      />
                      <Text
                        style={[
                          styles.genderBtnText,
                          { color: gender === 'female' ? '#FFFFFF' : theme.text },
                        ]}
                      >
                        Female
                      </Text>
                    </Pressable>
                  </View>

                  {/* Height & Weight Compact Steppers */}
                  <View style={styles.steppersRow}>
                    <View
                      style={[
                        styles.stepperPill,
                        { borderColor: theme.border, backgroundColor: theme.background },
                      ]}
                    >
                      <Pressable
                        onPress={() => stepValue(heightCm, -1, 140, 210, setHeightCm)}
                        style={styles.stepIconBtn}
                      >
                        <Ionicons name="remove" size={14} color={theme.text} />
                      </Pressable>
                      <Text style={[styles.stepperText, { color: theme.text }]}>
                        {heightCm} cm
                      </Text>
                      <Pressable
                        onPress={() => stepValue(heightCm, 1, 140, 210, setHeightCm)}
                        style={styles.stepIconBtn}
                      >
                        <Ionicons name="add" size={14} color={theme.text} />
                      </Pressable>
                    </View>

                    <View
                      style={[
                        styles.stepperPill,
                        { borderColor: theme.border, backgroundColor: theme.background },
                      ]}
                    >
                      <Pressable
                        onPress={() => stepValue(weightKg, -1, 38, 140, setWeightKg)}
                        style={styles.stepIconBtn}
                      >
                        <Ionicons name="remove" size={14} color={theme.text} />
                      </Pressable>
                      <Text style={[styles.stepperText, { color: theme.text }]}>
                        {weightKg} kg
                      </Text>
                      <Pressable
                        onPress={() => stepValue(weightKg, 1, 38, 140, setWeightKg)}
                        style={styles.stepIconBtn}
                      >
                        <Ionicons name="add" size={14} color={theme.text} />
                      </Pressable>
                    </View>
                  </View>
                </View>

                {/* Hairstyle Chips */}
                <Text style={[styles.sectionTitle, { color: '#4D9A65' }]}>HAIRSTYLE</Text>
                <View style={styles.hairstylesGrid}>
                  {availableHairstyles.map((hs) => {
                    const isActive = hairStyle === hs.id;
                    return (
                      <Pressable
                        key={hs.id}
                        onPress={() => setHairStyle(hs.id)}
                        style={[
                          styles.hairOptionCard,
                          {
                            borderColor: isActive ? '#4D9A65' : theme.border,
                            backgroundColor: isActive ? '#F0F9F1' : theme.surface,
                          },
                        ]}
                      >
                        <Text style={[styles.hairOptionLabel, { color: theme.text }]}>
                          {hs.label}
                        </Text>
                        <Text style={[styles.hairOptionDesc, { color: theme.textMuted }]}>
                          {hs.desc}
                        </Text>
                        {isActive && (
                          <View style={styles.activeCheck}>
                            <Ionicons name="checkmark-circle" size={15} color="#4D9A65" />
                          </View>
                        )}
                      </Pressable>
                    );
                  })}
                </View>

                {/* Hair Color Swatches */}
                <Text style={[styles.sectionTitle, { color: '#4D9A65', marginTop: 10 }]}>
                  HAIR COLOR
                </Text>
                <View style={styles.colorSwatchesRow}>
                  {HAIR_COLORS.map((hc) => {
                    const isActive = hairColor === hc.hex;
                    return (
                      <Pressable
                        key={hc.hex}
                        onPress={() => setHairColor(hc.hex)}
                        style={[
                          styles.colorSwatchWrap,
                          isActive && { borderColor: '#4D9A65', transform: [{ scale: 1.06 }] },
                        ]}
                      >
                        <View style={[styles.colorSwatchCircle, { backgroundColor: hc.hex }]} />
                        <Text
                          style={[styles.colorSwatchLabel, { color: theme.text }]}
                          numberOfLines={1}
                        >
                          {hc.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : (
              <View style={styles.tabPane}>
                {/* 1-Tap Camera Skin Tone Scan Button */}
                <Pressable
                  onPress={() => setCameraScanVisible(true)}
                  style={styles.cameraScanBtn}
                >
                  <Ionicons name="camera" size={17} color="#FFFFFF" />
                  <Text style={styles.cameraScanBtnText}>
                    📸 Scan Skin Tone with Camera
                  </Text>
                </Pressable>

                {/* Skin Tone Selection */}
                <Text style={[styles.sectionTitle, { color: '#4D9A65' }]}>SKIN TONE</Text>
                <View style={styles.colorSwatchesRow}>
                  {SKIN_TONES.map((st) => {
                    const isActive = skinTone === st.hex;
                    return (
                      <Pressable
                        key={st.hex}
                        onPress={() => setSkinTone(st.hex)}
                        style={[
                          styles.colorSwatchWrap,
                          isActive && { borderColor: '#4D9A65', transform: [{ scale: 1.06 }] },
                        ]}
                      >
                        <View style={[styles.colorSwatchCircle, { backgroundColor: st.hex }]} />
                        <Text
                          style={[styles.colorSwatchLabel, { color: theme.text }]}
                          numberOfLines={1}
                        >
                          {st.label.split(' ')[0]}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Face Style Selection */}
                <Text style={[styles.sectionTitle, { color: '#4D9A65', marginTop: 12 }]}>
                  FACE STYLE
                </Text>
                <View style={styles.faceStylesRow}>
                  {FACE_STYLES.map((fs) => {
                    const isActive = faceStyle === fs.id;
                    return (
                      <Pressable
                        key={fs.id}
                        onPress={() => setFaceStyle(fs.id)}
                        style={[
                          styles.faceStyleBtn,
                          {
                            borderColor: isActive ? '#4D9A65' : theme.border,
                            backgroundColor: isActive ? '#F0F9F1' : theme.surface,
                          },
                        ]}
                      >
                        <Ionicons
                          name={fs.icon as any}
                          size={16}
                          color={isActive ? '#2E7D32' : theme.text}
                        />
                        <Text style={[styles.faceStyleLabel, { color: theme.text }]}>
                          {fs.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}
          </View>

          {/* ZONE 3: PINNED BOTTOM ACTION ROW (flexShrink: 0) */}
          <View style={styles.footerRow}>
            <Pressable onPress={onClose} style={[styles.cancelBtn, { borderColor: theme.border }]}>
              <Text style={[styles.cancelBtnText, { color: theme.text }]}>Cancel</Text>
            </Pressable>

            <Pressable onPress={handleSave} style={styles.saveBtn}>
              <Text style={styles.saveBtnText}>Save Changes</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Camera Skin Tone & Hair Scanner Modal */}
      <CameraSkinScanModal
        visible={cameraScanVisible}
        onClose={() => setCameraScanVisible(false)}
        onApplyScan={handleApplyScan}
        currentSkinTone={skinTone}
        currentHairColor={hairColor}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 24,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  title: {
    fontSize: 19,
    fontWeight: '900',
  },
  subtitle: {
    fontSize: 11.5,
    marginTop: 1,
  },
  closeBtn: {
    padding: 4,
  },
  previewBox: {
    height: 210,
    minHeight: 210,
    flexShrink: 0,
    paddingVertical: 4,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  mannequinWrap: {
    width: 145,
    height: 198,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    borderRadius: 12,
    backgroundColor: '#EEF2EA',
    padding: 3,
    gap: 4,
    marginBottom: 4,
    flexShrink: 0,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBtnActive: {
    backgroundColor: '#264C3B',
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#657468',
  },
  tabBtnTextActive: {
    color: '#FFFFFF',
  },
  optionsContainer: {
    minHeight: 240,
    paddingVertical: 12,
    justifyContent: 'flex-start',
  },
  tabPane: {
    gap: 4,
  },
  topControlsRow: {
    gap: 8,
    marginBottom: 8,
  },
  zoomTogglePill: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D4E6BD',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  zoomToggleText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#264C3B',
  },
  genderRow: {
    flexDirection: 'row',
    gap: 8,
  },
  genderBtn: {
    flex: 1,
    height: 36,
    borderRadius: 10,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  genderBtnActive: {
    backgroundColor: '#24513B',
    borderColor: '#24513B',
  },
  genderBtnText: {
    fontSize: 13,
    fontWeight: '800',
  },
  steppersRow: {
    flexDirection: 'row',
    gap: 8,
  },
  stepperPill: {
    flex: 1,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  stepIconBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF2EA',
  },
  stepperText: {
    fontSize: 12,
    fontWeight: '800',
  },
  cameraScanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#264C3B',
    paddingVertical: 11,
    borderRadius: 12,
    marginBottom: 10,
  },
  cameraScanBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '800',
  },
  sectionTitle: {
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 6,
  },
  hairstylesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  hairOptionCard: {
    width: '48.5%',
    borderRadius: 10,
    borderWidth: 1.5,
    paddingVertical: 7,
    paddingHorizontal: 9,
    position: 'relative',
  },
  hairOptionLabel: {
    fontSize: 12,
    fontWeight: '800',
  },
  hairOptionDesc: {
    fontSize: 10,
    marginTop: 1,
  },
  activeCheck: {
    position: 'absolute',
    right: 6,
    top: 6,
  },
  colorSwatchesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  colorSwatchWrap: {
    alignItems: 'center',
    padding: 3,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'transparent',
    width: '18.5%',
  },
  colorSwatchCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  colorSwatchLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    marginTop: 3,
    textAlign: 'center',
  },
  faceStylesRow: {
    flexDirection: 'row',
    gap: 6,
  },
  faceStyleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  faceStyleLabel: {
    fontSize: 11,
    fontWeight: '800',
  },
  footerRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
    flexShrink: 0,
  },
  cancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 999,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 13.5,
    fontWeight: '800',
  },
  saveBtn: {
    flex: 1.5,
    height: 44,
    borderRadius: 999,
    backgroundColor: '#24513B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    fontSize: 13.5,
    fontWeight: '900',
    color: '#FFFFFF',
  },
});
