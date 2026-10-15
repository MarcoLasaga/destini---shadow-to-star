import React, { useState, useMemo, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { GeneratedOutfit } from '../types';
import { publishOutfit } from '../services/communityService';
import { useToast } from '../contexts/ToastContext';
import { useAppTheme } from '../hooks/useAppTheme';
import { useOutfit } from '../contexts/OutfitContext';
import ConfirmDialogModal from './common/ConfirmDialogModal';

export default function ShareOutfitModal({
  outfit,
  visible,
  onClose,
  onPublished,
}: {
  outfit?: GeneratedOutfit | null;
  visible: boolean;
  onClose: () => void;
  onPublished?: () => void;
}) {
  const theme = useAppTheme();
  const { showToast } = useToast();
  const { currentOutfit, currentOutfits, savedOutfits } = useOutfit();

  // Combine and deduplicate candidates
  const candidateOutfits = useMemo(() => {
    const list: GeneratedOutfit[] = [];
    const seen = new Set<string>();

    const addIfUnique = (o: GeneratedOutfit | null | undefined) => {
      if (o && !seen.has(o.id)) {
        seen.add(o.id);
        list.push(o);
      }
    };

    addIfUnique(outfit);
    addIfUnique(currentOutfit);
    (currentOutfits || []).forEach(addIfUnique);
    (savedOutfits || []).forEach(addIfUnique);

    return list;
  }, [outfit, currentOutfit, currentOutfits, savedOutfits]);

  const [selectedOutfitId, setSelectedOutfitId] = useState<string>(
    outfit?.id || currentOutfit?.id || (savedOutfits[0]?.id ?? '')
  );

  useEffect(() => {
    if (outfit?.id) {
      setSelectedOutfitId(outfit.id);
    } else if (candidateOutfits.length > 0 && !candidateOutfits.some((o) => o.id === selectedOutfitId)) {
      setSelectedOutfitId(candidateOutfits[0].id);
    }
  }, [outfit, candidateOutfits]);

  const selectedOutfit = useMemo(() => {
    return candidateOutfits.find((o) => o.id === selectedOutfitId) || candidateOutfits[0] || null;
  }, [candidateOutfits, selectedOutfitId]);

  const [caption, setCaption] = useState('');
  const [saving, setSaving] = useState(false);
  const [moderationError, setModerationError] = useState<string | null>(null);

  const handleShare = async () => {
    if (!selectedOutfit) {
      showToast('Please select an outfit to publish.');
      return;
    }

    setSaving(true);
    setModerationError(null);

    try {
      await publishOutfit(selectedOutfit, caption);
      setCaption('');
      setModerationError(null);
      onClose();
      onPublished?.();
      showToast('Outfit shared with the community!');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unable to share outfit.';
      const isModeration =
        msg.toLowerCase().includes('moderation') ||
        msg.toLowerCase().includes('prohibited') ||
        msg.toLowerCase().includes('slur') ||
        msg.toLowerCase().includes('offensive') ||
        msg.toLowerCase().includes('unapproved');

      if (isModeration) {
        setModerationError(msg);
      } else {
        showToast(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  const activeAccent = theme.accent;

  return (
    <>
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={[styles.sheet, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={[styles.title, { color: theme.text }]}>Share to Community</Text>
              <Text style={[styles.subtitle, { color: theme.textMuted }]}>
                Publish your curated ensemble to the style feed
              </Text>
            </View>
            <Pressable onPress={onClose} style={[styles.closeBtn, { backgroundColor: theme.background }]}>
              <Ionicons name="close" size={18} color={theme.text} />
            </Pressable>
          </View>

          {/* Look Carousel Section */}
          <View style={styles.carouselSection}>
            <View style={styles.carouselHeader}>
              <Text style={[styles.sectionHeading, { color: theme.textMuted }]}>
                SELECT LOOK TO PUBLISH
              </Text>
              <Text style={[styles.lookCount, { color: theme.textMuted }]}>
                {candidateOutfits.length} available
              </Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carouselScroll}
            >
              {candidateOutfits.map((item) => {
                const isSelected = item.id === selectedOutfit?.id;
                const garments = item.clothingItems?.slice(0, 4) || [];
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => {
                      setSelectedOutfitId(item.id);
                      setModerationError(null);
                    }}
                    style={[
                      styles.outfitCard,
                      {
                        backgroundColor: theme.background,
                        borderColor: isSelected ? activeAccent : theme.border,
                        borderWidth: isSelected ? 2 : 1,
                      },
                    ]}
                  >
                    {/* Selected Badge */}
                    {isSelected && (
                      <View style={[styles.checkBadge, { backgroundColor: theme.secondaryAccent }]}>
                        <Ionicons name="checkmark" size={12} color={theme.onAccent} />
                      </View>
                    )}

                    <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={1}>
                      {item.name}
                    </Text>

                    <View style={styles.cardScoreRow}>
                      <View style={[styles.scoreBadge, { backgroundColor: theme.mode === 'dark' ? '#2A2938' : '#ECE8F2' }]}>
                        <Ionicons name="sparkles" size={10} color={activeAccent} />
                        <Text style={[styles.scoreText, { color: activeAccent }]}>
                          {item.hybridScore || item.matchPercent}% Hybrid
                        </Text>
                      </View>
                    </View>

                    {/* Garment Thumbnails (3-4 items) */}
                    <View style={styles.cardThumbnails}>
                      {garments.map((g, idx) => (
                        <View
                          key={g.id || idx}
                          style={[
                            styles.thumbWrap,
                            {
                              borderColor: theme.border,
                              backgroundColor: theme.mode === 'dark' ? '#181A20' : '#EAE7E1',
                            },
                          ]}
                        >
                          {g.image ? (
                            <Image
                              source={{ uri: g.image }}
                              style={styles.thumbImg}
                              contentFit="cover"
                              transition={150}
                            />
                          ) : (
                            <Ionicons name="shirt-outline" size={12} color={theme.textMuted} />
                          )}
                        </View>
                      ))}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Moderation Shield Dialog Card (replaces raw Alert) */}
          {moderationError ? (
            <View style={styles.moderationShieldCard}>
              <View style={styles.shieldHeader}>
                <View style={styles.shieldIconWrap}>
                  <Ionicons name="shield-outline" size={22} color="#E5484D" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.shieldTitle}>Post Blocked by Moderation</Text>
                  <Text style={styles.shieldSubtitle}>Automated Content Safeguard</Text>
                </View>
              </View>

              <Text style={styles.shieldReason}>{moderationError}</Text>

              <Pressable
                onPress={() => setModerationError(null)}
                style={styles.reviseButton}
              >
                <Ionicons name="pencil" size={14} color={theme.onAccent} />
                <Text style={styles.reviseButtonText}>Revise Caption</Text>
              </Pressable>
            </View>
          ) : (
            <View style={[styles.moderationNotice, { backgroundColor: theme.mode === 'dark' ? '#202228' : '#F4F1EA' }]}>
              <Ionicons name="shield-checkmark-outline" size={15} color={activeAccent} />
              <Text style={[styles.noticeText, { color: theme.textMuted }]}>
                All captions undergo automated AI moderation. Respectful, positive styling discussions only.
              </Text>
            </View>
          )}

          {/* Caption Input */}
          <TextInput
            value={caption}
            onChangeText={(text) => {
              setCaption(text);
              if (moderationError) setModerationError(null);
            }}
            placeholder="Write a caption (e.g. Classic campus pairing with breathable tones!)"
            placeholderTextColor={theme.textMuted}
            style={[
              styles.input,
              {
                color: theme.text,
                borderColor: moderationError ? '#E5484D' : theme.border,
                backgroundColor: theme.background,
              },
            ]}
            multiline
            numberOfLines={3}
          />

          {/* Action Buttons */}
          <View style={styles.actions}>
            <Pressable
              onPress={onClose}
              style={[styles.button, { borderColor: theme.border, borderWidth: 1 }]}
            >
              <Text style={{ color: theme.text, fontWeight: '600' }}>Cancel</Text>
            </Pressable>
            <Pressable
              disabled={saving || !selectedOutfit}
              onPress={handleShare}
              style={[
                styles.button,
                {
                  backgroundColor: theme.secondaryAccent,
                  borderColor: 'transparent',
                  borderWidth: theme.mode === 'dark' ? 1 : 0,
                  opacity: saving || !selectedOutfit ? 0.6 : 1,
                },
              ]}
            >
              <Text style={{ color: theme.onAccent, fontWeight: '700' }}>
                {saving ? 'Publishing…' : 'Publish Look'}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>

    {/* Moderation Shield Dialog Modal */}
    <ConfirmDialogModal
      visible={!!moderationError}
      variant="moderation"
      title="Post Blocked by Moderation"
      message={moderationError || ''}
      confirmText="Revise Caption"
      showCancel={false}
      onConfirm={() => setModerationError(null)}
    />
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    padding: 22,
    gap: 14,
    maxHeight: '92%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  subtitle: { fontSize: 12.5, marginTop: 2 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  carouselSection: {
    gap: 8,
  },
  carouselHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  lookCount: {
    fontSize: 11.5,
  },
  carouselScroll: {
    gap: 10,
    paddingVertical: 4,
  },
  outfitCard: {
    width: 200,
    borderRadius: 16,
    padding: 12,
    position: 'relative',
    gap: 8,
  },
  checkBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    paddingRight: 18,
  },
  cardScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  scoreText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  cardThumbnails: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 2,
  },
  thumbWrap: {
    width: 38,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbImg: {
    width: '100%',
    height: '100%',
  },
  moderationNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 12,
  },
  noticeText: { fontSize: 11.5, flex: 1, lineHeight: 15 },
  moderationShieldCard: {
    backgroundColor: '#1E1215',
    borderWidth: 1.5,
    borderColor: '#E5484D',
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  shieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  shieldIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E5484D22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shieldTitle: {
    color: '#FF6B6B',
    fontSize: 14,
    fontWeight: '800',
  },
  shieldSubtitle: {
    color: '#D4A5A5',
    fontSize: 11,
  },
  shieldReason: {
    color: '#F4E8E8',
    fontSize: 12.5,
    lineHeight: 17,
  },
  reviseButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E5484D',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 4,
  },
  reviseButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  input: {
    minHeight: 76,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    textAlignVertical: 'top',
    fontSize: 13.5,
  },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  button: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 14,
    paddingVertical: 13,
  },
});
