import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Svg, { Path, Circle, Rect, Text as SvgText } from 'react-native-svg';
import { useAppTheme } from '../hooks/useAppTheme';
import { useAuth } from '../contexts/AuthContext';
import {
  verifyFullBodyPhoto,
  verifyNsfw5ClassSafety,
} from '../services/imageAnalysisService';

interface FullBodyTryOnModalProps {
  visible: boolean;
  onClose: () => void;
  onPhotoSaved: (uri: string, base64?: string) => void;
}

export default function FullBodyTryOnModal({
  visible,
  onClose,
  onPhotoSaved,
}: FullBodyTryOnModalProps) {
  const theme = useAppTheme();
  const { session } = useAuth();
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [verifying, setVerifying] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleCaptureOrPick = async (useCamera: boolean) => {
    setErrorMessage(null);
    const perm = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!perm.granted) {
      setErrorMessage(
        `Please allow ${useCamera ? 'camera' : 'photo library'} access in Settings to verify your full-body photo.`
      );
      return;
    }

    const result = useCamera
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          allowsEditing: false,
          quality: 0.9,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: false,
          quality: 0.9,
        });

    if (result.canceled || !result.assets?.[0]?.uri) return;

    const capturedUri = result.assets[0].uri;
    setPreviewUri(capturedUri);
    setVerifying(true);

    try {
      const safety = await verifyNsfw5ClassSafety(capturedUri, session?.access_token);
      if (!safety.isSafe) {
        setPreviewUri(null);
        setErrorMessage(
          safety.moderationReason ||
            'Photo rejected by 5-Class NSFWJS safety check. Please use a standard clothed standing photo.'
        );
        return;
      }

      const fullBodyRes = await verifyFullBodyPhoto(capturedUri, session?.access_token);
      if (!fullBodyRes.verified || !fullBodyRes.is_full_body) {
        setErrorMessage(
          fullBodyRes.reason ||
            'Full-body standing photo required (Head-to-Toe): We detected a selfie or cropped photo. Please step back so your head, torso, legs, and shoes are all visible to unlock See It On Me.'
        );
        return;
      }

      onPhotoSaved(capturedUri, fullBodyRes.userPhotoBase64);
      onClose();
    } catch {
      setErrorMessage(
        'Full-body standing photo required (Head-to-Toe): We detected a selfie or cropped photo. Please step back so your head, torso, legs, and shoes are all visible to unlock See It On Me.'
      );
    } finally {
      setVerifying(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View
          style={[
            styles.sheet,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <View style={[styles.dragHandle, { backgroundColor: theme.border }]} />

          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.kicker, { color: theme.accent }]}>
                HEAD-TO-TOE VERIFICATION GATE
              </Text>
              <Text style={[styles.title, { color: theme.text }]}>
                🔒 Unlock “See It On Me”
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: theme.badgeBg }]}
            >
              <Ionicons name="close" size={20} color={theme.textMuted} />
            </Pressable>
          </View>

          {/* Privacy Guarantee Banner */}
          <View
            style={[
              styles.privacyBanner,
              { backgroundColor: theme.badgeBg, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.privacyBannerText, { color: theme.text }]}>
              Step back so your Head, Torso, Legs, and Shoes/Feet are all inside the frame. 🔒 Kept 100% private on your device—never shared in Community.
            </Text>
          </View>

          {/* Head-to-Toe Standing Silhouette Guide Overlay */}
          <View
            style={[
              styles.guideBox,
              {
                backgroundColor: theme.collageCanvas,
                borderColor: theme.border,
              },
            ]}
          >
            {previewUri ? (
              <Image
                source={{ uri: previewUri }}
                style={styles.previewImg}
                resizeMode="contain"
              />
            ) : (
              <Svg width={210} height={225} viewBox="0 0 210 230">
                <Rect
                  x="20"
                  y="6"
                  width="170"
                  height="218"
                  rx="16"
                  fill="none"
                  stroke={theme.textMuted}
                  strokeWidth="1.5"
                  strokeDasharray="6 4"
                />
                {/* Head */}
                <Circle
                  cx="105"
                  cy="36"
                  r="14"
                  fill="none"
                  stroke={theme.text}
                  strokeWidth="1.8"
                  strokeDasharray="4 3"
                />
                {/* Standing Torso, Legs, Feet */}
                <Path
                  d="M 80,56 Q 105,50 130,56 L 140,112 L 126,112 L 120,76 L 118,128 L 122,202 L 107,202 L 105,142 L 103,202 L 88,202 L 92,128 L 90,76 L 84,112 L 70,112 Z"
                  fill="none"
                  stroke={theme.text}
                  strokeWidth="1.8"
                  strokeDasharray="5 3"
                />
                {/* Zone Callout Labels */}
                <SvgText x="148" y="40" fill={theme.textMuted} fontSize="9" fontWeight="700">
                  Head
                </SvgText>
                <SvgText x="148" y="92" fill={theme.textMuted} fontSize="9" fontWeight="700">
                  Torso
                </SvgText>
                <SvgText x="148" y="156" fill={theme.textMuted} fontSize="9" fontWeight="700">
                  Legs
                </SvgText>
                <SvgText x="136" y="206" fill={theme.textMuted} fontSize="9" fontWeight="700">
                  Shoes/Feet
                </SvgText>
              </Svg>
            )}

            <View
              style={[
                styles.guideHintPill,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <Ionicons name="shield-checkmark-outline" size={12} color={theme.text} />
              <Text style={[styles.guideHintText, { color: theme.text }]}>
                Head · Torso · Legs · Shoes/Feet Required
              </Text>
            </View>
          </View>

          {verifying && (
            <View
              style={[
                styles.verifyingRow,
                { backgroundColor: theme.badgeBg, borderColor: theme.border },
              ]}
            >
              <ActivityIndicator size="small" color={theme.text} />
              <Text style={[styles.verifyingText, { color: theme.text }]}>
                Verifying full-body standing pose (Head-to-Toe)...
              </Text>
            </View>
          )}

          {errorMessage && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>⚠️ {errorMessage}</Text>
            </View>
          )}

          {/* Camera & Gallery Action Buttons */}
          <View style={styles.actionsWrap}>
            <Pressable
              disabled={verifying}
              onPress={() => handleCaptureOrPick(true)}
              style={[
                styles.primaryCameraBtn,
                { backgroundColor: theme.secondaryAccent },
              ]}
            >
              <Ionicons name="camera-outline" size={18} color={theme.onAccent} />
              <Text style={[styles.primaryCameraBtnText, { color: theme.onAccent }]}>
                📷 Scan Full Body via Camera
              </Text>
            </Pressable>

            <Pressable
              disabled={verifying}
              onPress={() => handleCaptureOrPick(false)}
              style={[
                styles.secondaryGalleryBtn,
                { backgroundColor: theme.background, borderColor: theme.border },
              ]}
            >
              <Ionicons name="images-outline" size={17} color={theme.text} />
              <Text style={[styles.secondaryGalleryBtnText, { color: theme.text }]}>
                🖼️ Upload Full-Body Photo
              </Text>
            </Pressable>

            <Pressable onPress={onClose} style={styles.skipBtn}>
              <Text style={[styles.skipBtnText, { color: theme.textMuted }]}>
                Cancel
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(18, 18, 20, 0.68)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 24,
    gap: 12,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  kicker: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  title: {
    fontSize: 19,
    fontWeight: '700',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  privacyBanner: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  privacyBannerText: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  guideBox: {
    height: 235,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  previewImg: {
    width: '100%',
    height: '100%',
  },
  guideHintPill: {
    position: 'absolute',
    bottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  guideHintText: {
    fontSize: 10,
    fontWeight: '700',
  },
  verifyingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
  },
  verifyingText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
  },
  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
  },
  errorBannerText: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
    color: '#991B1B',
  },
  actionsWrap: {
    gap: 8,
  },
  primaryCameraBtn: {
    height: 46,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryCameraBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryGalleryBtn: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryGalleryBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  skipBtn: {
    paddingVertical: 6,
    alignItems: 'center',
  },
  skipBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
