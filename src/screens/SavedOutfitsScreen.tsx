import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Modal,
  TextInput,
} from 'react-native';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../hooks/useAppTheme';
import { useOutfit } from '../contexts/OutfitContext';
import { useToast } from '../contexts/ToastContext';
import ScreenHeader from '../components/ScreenHeader';
import { GeneratedOutfit } from '../types';
import ConfirmDialogModal from '../components/common/ConfirmDialogModal';

export default function SavedOutfitsScreen() {
  const theme = useAppTheme();
  const navigation = useNavigation<any>();
  const { savedOutfits, renameSavedOutfit, deleteSavedOutfit } = useOutfit();
  const { showToast } = useToast();

  const [renameTarget, setRenameTarget] = useState<GeneratedOutfit | null>(null);
  const [newName, setNewName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<GeneratedOutfit | null>(null);

  const openRenameModal = (outfit: GeneratedOutfit) => {
    setRenameTarget(outfit);
    setNewName(outfit.name);
  };

  const handleSaveRename = () => {
    if (!renameTarget) return;
    const trimmed = newName.trim();
    if (!trimmed) {
      showToast('Outfit name cannot be empty');
      return;
    }
    renameSavedOutfit(renameTarget.id, trimmed);
    setRenameTarget(null);
    showToast('Outfit renamed successfully');
  };

  const handleDelete = (outfit: GeneratedOutfit) => {
    setDeleteTarget(outfit);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteSavedOutfit(deleteTarget.id);
    showToast(`"${deleteTarget.name}" removed from saved looks`);
    setDeleteTarget(null);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader title="Saved Outfits" />

      {savedOutfits.length === 0 ? (
        <Animated.View entering={FadeInDown.duration(400)} style={styles.empty}>
          <View style={[styles.emptyIcon, { backgroundColor: theme.primaryAccent + '26' }]}>
            <Ionicons name="shirt-outline" size={34} color={theme.accent} />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No Saved Outfits</Text>
          <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>
            Generate looks with our AI stylist and tap Save to curate your personal fashion book.
          </Text>
          <Pressable
            onPress={() => navigation.navigate('Outfit')}
            style={[styles.generateButton, { backgroundColor: theme.secondaryAccent }]}
          >
            <Text style={[styles.generateLabel, { color: theme.onAccent }]}>Generate Outfit</Text>
          </Pressable>
        </Animated.View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.listHeader, { color: theme.textMuted }]}>
            {savedOutfits.length} {savedOutfits.length === 1 ? 'CURATED LOOK' : 'CURATED LOOKS'}
          </Text>

          {savedOutfits.map((outfit) => {
            const garments = outfit.clothingItems?.slice(0, 4) || [];
            return (
              <Animated.View
                key={outfit.id}
                entering={FadeInDown.duration(350)}
                style={[
                  styles.card,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                  },
                ]}
              >
                {/* Top Row: Title + Match Badge */}
                <Pressable
                  onPress={() => navigation.navigate('OutfitDetails', { outfitId: outfit.id })}
                >
                  <View style={styles.cardHeader}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={[styles.outfitTitle, { color: theme.text }]} numberOfLines={1}>
                        {outfit.name}
                      </Text>
                      <View style={styles.badgeRow}>
                        <View
                          style={[
                            styles.badge,
                            {
                              backgroundColor:
                                theme.mode === 'dark' ? '#2A2938' : '#ECE8F2',
                            },
                          ]}
                        >
                          <Text style={[styles.badgeText, { color: theme.accent, fontWeight: '700' }]}>
                            {outfit.occasionLabel || 'Casual'}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.scoreBadge,
                            {
                              backgroundColor:
                                theme.mode === 'dark' ? '#272C25' : '#EAF4E8',
                            },
                          ]}
                        >
                          <Ionicons name="sparkles" size={11} color="#2E7D32" />
                          <Text style={styles.scoreText}>
                            {outfit.hybridScore || outfit.matchPercent}% Hybrid
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* Garment Thumbnails Row (3-4 items) */}
                  <View style={styles.thumbnailsContainer}>
                    {garments.map((g, idx) => (
                      <View
                        key={g.id || idx}
                        style={[
                          styles.thumbnailWrapper,
                          {
                            borderColor: theme.border,
                            backgroundColor:
                              theme.mode === 'dark' ? '#202229' : '#F5F3EF',
                          },
                        ]}
                      >
                        {g.image ? (
                          <Image
                            source={{ uri: g.image }}
                            style={styles.thumbnailImage}
                            contentFit="cover"
                            transition={150}
                          />
                        ) : (
                          <View style={styles.thumbnailFallback}>
                            <Ionicons name="shirt-outline" size={16} color={theme.textMuted} />
                          </View>
                        )}
                        <Text
                          style={[styles.thumbnailCategory, { color: theme.textMuted }]}
                          numberOfLines={1}
                        >
                          {g.category || 'Garment'}
                        </Text>
                      </View>
                    ))}
                  </View>
                </Pressable>

                {/* Bottom Actions Row: Rename + Delete */}
                <View style={[styles.actionsRow, { borderTopColor: theme.border }]}>
                  <Pressable
                    onPress={() => openRenameModal(outfit)}
                    style={styles.actionBtn}
                    hitSlop={6}
                  >
                    <Ionicons name="pencil-outline" size={15} color={theme.text} />
                    <Text style={[styles.actionBtnText, { color: theme.text }]}>Rename</Text>
                  </Pressable>

                  <View style={[styles.actionDivider, { backgroundColor: theme.border }]} />

                  <Pressable
                    onPress={() => handleDelete(outfit)}
                    style={styles.actionBtn}
                    hitSlop={6}
                  >
                    <Ionicons name="trash-outline" size={15} color="#E5484D" />
                    <Text style={[styles.actionBtnText, { color: '#E5484D' }]}>Delete</Text>
                  </Pressable>
                </View>
              </Animated.View>
            );
          })}
        </ScrollView>
      )}

      {/* Rename Modal */}
      <Modal
        visible={renameTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameTarget(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalIconWrap, { backgroundColor: theme.primaryAccent + '26' }]}>
                <Ionicons name="pencil" size={18} color={theme.accent} />
              </View>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Rename Saved Outfit</Text>
            </View>

            <Text style={[styles.modalSubtitle, { color: theme.textMuted }]}>
              Give this curated ensemble a memorable title for your wardrobe journal.
            </Text>

            <TextInput
              value={newName}
              onChangeText={setNewName}
              placeholder="e.g. Autumn Campus Trench Combo"
              placeholderTextColor={theme.textMuted}
              style={[
                styles.modalInput,
                {
                  color: theme.text,
                  backgroundColor: theme.background,
                  borderColor: theme.border,
                },
              ]}
              autoFocus
              selectTextOnFocus
            />

            <View style={styles.modalButtons}>
              <Pressable
                onPress={() => setRenameTarget(null)}
                style={[styles.modalBtn, { borderColor: theme.border, borderWidth: 1 }]}
              >
                <Text style={{ color: theme.text, fontWeight: '600', fontSize: 14 }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleSaveRename}
                style={[styles.modalBtn, { backgroundColor: theme.secondaryAccent }]}
              >
                <Text style={{ color: theme.onAccent, fontWeight: '700', fontSize: 14 }}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Outfit Confirmation Dialog */}
      <ConfirmDialogModal
        visible={!!deleteTarget}
        variant="danger"
        title="Delete Saved Outfit"
        message={deleteTarget ? `Are you sure you want to remove "${deleteTarget.name}" from your saved looks?` : ''}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 8,
  },
  emptyIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: { fontSize: 19, fontWeight: '800', letterSpacing: -0.2 },
  emptySubtitle: { fontSize: 13.5, textAlign: 'center', lineHeight: 19, marginBottom: 14 },
  generateButton: { borderRadius: 999, paddingHorizontal: 28, paddingVertical: 13 },
  generateLabel: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  listContent: { paddingHorizontal: 18, paddingBottom: 40, paddingTop: 10 },
  listHeader: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.3,
    marginBottom: 12,
    paddingLeft: 4,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  cardHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
  },
  outfitTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.2, marginBottom: 6 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeText: { fontSize: 11, fontWeight: '700' },
  scoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  scoreText: { color: '#2E7D32', fontSize: 11, fontWeight: '700' },
  thumbnailsContainer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  thumbnailWrapper: {
    flex: 1,
    aspectRatio: 0.85,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailImage: {
    width: '100%',
    height: '75%',
  },
  thumbnailFallback: {
    width: '100%',
    height: '75%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailCategory: {
    fontSize: 9.5,
    fontWeight: '600',
    paddingVertical: 2,
    textTransform: 'uppercase',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingVertical: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  actionBtnText: { fontSize: 13, fontWeight: '600' },
  actionDivider: { width: 1, height: 18 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    borderRadius: 22,
    borderWidth: 1,
    padding: 22,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modalIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: { fontSize: 17, fontWeight: '800' },
  modalSubtitle: { fontSize: 13, lineHeight: 18 },
  modalInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    marginTop: 4,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  modalBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
  },
});
