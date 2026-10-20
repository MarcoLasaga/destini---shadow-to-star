import React, { useMemo, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, Modal, ScrollView, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { useAppTheme } from '../hooks/useAppTheme';
import { useWardrobe, isAccessoryItem } from '../contexts/WardrobeContext';
import { useToast } from '../contexts/ToastContext';
import ClothingCard from '../components/ClothingCard';
import ConfirmDialogModal from '../components/common/ConfirmDialogModal';

// Five unified categories per thesis Chapters 1–3 (Dresses removed)
export const FILTER_CATEGORIES = ['ALL', 'TOP', 'BOTTOM', 'SHOES', 'OUTERWEAR', 'ACCESSORIES'] as const;
export type FilterCategory = (typeof FILTER_CATEGORIES)[number];

// Five thesis occasions
export const FILTER_OCCASIONS = ['ALL', 'Academic', 'Office', 'Formal', 'Casual', 'Workout'] as const;
export type FilterOccasion = (typeof FILTER_OCCASIONS)[number];

// Laundry statuses
export const FILTER_LAUNDRY = ['ALL', 'CLEAN', 'NEEDS_WASHING'] as const;
export type FilterLaundry = (typeof FILTER_LAUNDRY)[number];

function normalizeCategory(cat: string): string {
  const c = (cat || '').toUpperCase().trim();
  if (c.startsWith('TOP')) return 'TOP';
  if (c.startsWith('BOTTOM')) return 'BOTTOM';
  if (c.startsWith('SHOE')) return 'SHOES';
  if (c.startsWith('OUTER')) return 'OUTERWEAR';
  if (c.startsWith('ACCESSOR')) return 'ACCESSORIES';
  return c;
}

export default function WardrobeScreen() {
  const theme = useAppTheme();
  const navigation = useNavigation<any>();
  const { items, toggleFavorite, deleteItems } = useWardrobe();
  const { showToast } = useToast();

  // Multi-select & Batch Delete State
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Unified Filter State
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<FilterCategory>('ALL');
  const [selectedOccasion, setSelectedOccasion] = useState<FilterOccasion>('ALL');
  const [selectedLaundry, setSelectedLaundry] = useState<FilterLaundry>('ALL');
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  // Active filter count (excluding 'ALL')
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedCategory !== 'ALL') count++;
    if (selectedOccasion !== 'ALL') count++;
    if (selectedLaundry !== 'ALL') count++;
    if (favoritesOnly) count++;
    return count;
  }, [selectedCategory, selectedOccasion, selectedLaundry, favoritesOnly]);

  const toggleItemSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const startSelectionWith = (id: string) => {
    setSelectionMode(true);
    setSelectedIds(new Set([id]));
  };

  const cancelSelection = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((item) => item.id)));
    }
  };

  // Batch Delete Confirmation Dialog State
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{
    visible: boolean;
    itemIds: string[];
    title: string;
    message: string;
  }>({
    visible: false,
    itemIds: [],
    title: '',
    message: '',
  });
  const [deletingBatch, setDeletingBatch] = useState(false);

  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    setDeleteConfirmModal({
      visible: true,
      itemIds: Array.from(selectedIds),
      title: `Delete Selected ${count === 1 ? 'Garment' : 'Garments'}`,
      message: `Are you sure you want to delete ${count} ${count === 1 ? 'garment' : 'garments'} from your wardrobe? This cannot be undone.`,
    });
  };

  const executeDelete = async () => {
    const idsToDelete = deleteConfirmModal.itemIds;
    const count = idsToDelete.length;
    setDeletingBatch(true);
    cancelSelection();
    try {
      await deleteItems(idsToDelete);
      showToast(`${count} ${count === 1 ? 'garment' : 'garments'} deleted`);
      setDeleteConfirmModal({ visible: false, itemIds: [], title: '', message: '' });
    } catch {
      showToast('Error deleting garments');
    } finally {
      setDeletingBatch(false);
    }
  };

  const resetFilters = () => {
    setSelectedCategory('ALL');
    setSelectedOccasion('ALL');
    setSelectedLaundry('ALL');
    setFavoritesOnly(false);
  };

  const filtered = useMemo(() => {
    return items.filter((item) => {
      // 1. Category filter
      if (selectedCategory !== 'ALL') {
        const itemCat = normalizeCategory(item.category);
        if (itemCat !== selectedCategory) return false;
      }

      // 2. Occasion filter
      if (selectedOccasion !== 'ALL') {
        const occasions = (item.occasions || []).map((o) => o.toLowerCase());
        const target = selectedOccasion.toLowerCase();
        const matchesOccasion = occasions.some((occ) => {
          if (occ === target) return true;
          if (target === 'office' && (occ === 'work' || occ === 'business')) return true;
          if (target === 'workout' && (occ === 'sport' || occ === 'athletic' || occ === 'gym')) return true;
          return false;
        });
        if (!matchesOccasion) return false;
      }

      // 3. Laundry Status filter (Accessories are always treated as Clean)
      if (selectedLaundry !== 'ALL') {
        const isAcc = isAccessoryItem(item.category, item.name);
        const itemStatus = isAcc ? 'clean' : (item.status || '').toLowerCase();
        if (selectedLaundry === 'CLEAN' && itemStatus !== 'clean') return false;
        if (selectedLaundry === 'NEEDS_WASHING' && itemStatus !== 'needs-washing') return false;
      }

      // 4. Favorites Only
      if (favoritesOnly && !item.favorite) {
        return false;
      }

      return true;
    });
  }, [items, selectedCategory, selectedOccasion, selectedLaundry, favoritesOnly]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
        <View>
          <Text style={[styles.title, { color: theme.text }]}>Wardrobe</Text>
          <Text
            style={[
              styles.itemCount,
              {
                color: selectionMode
                  ? theme.text
                  : theme.textMuted,
                fontWeight: selectionMode ? '700' : '500',
              },
            ]}
          >
            {selectionMode
              ? `${selectedIds.size} ${selectedIds.size === 1 ? 'item selected' : 'items selected'}`
              : `${filtered.length} ${filtered.length === 1 ? 'item' : 'items'}`}
          </Text>
        </View>
        <View style={styles.headerActions}>
          {selectionMode ? (
            <Pressable
              onPress={cancelSelection}
              style={[
                styles.doneButton,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.doneButtonText, { color: theme.text }]}>Done</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => navigation.navigate('AddClothes')}
              style={[styles.addButton, { backgroundColor: theme.secondaryAccent }]}
            >
              <Ionicons name="add" size={16} color={theme.onAccent} />
              <Text style={[styles.addLabel, { color: theme.onAccent }]}>Add Clothes</Text>
            </Pressable>
          )}
        </View>
      </Animated.View>

      {/* Unified Filter Bar Button */}
      <View style={styles.filterBarContainer}>
        <Pressable
          onPress={() => setFilterModalVisible(true)}
          style={[
            styles.filterByButton,
            {
              backgroundColor: activeFilterCount > 0 ? theme.secondaryAccent : theme.surface,
              borderColor: activeFilterCount > 0 ? theme.secondaryAccent : theme.border,
            },
          ]}
        >
          <Ionicons
            name="options-outline"
            size={16}
            color={activeFilterCount > 0 ? theme.onAccent : theme.text}
          />
          <Text
            style={[
              styles.filterByButtonText,
              { color: activeFilterCount > 0 ? theme.onAccent : theme.text },
            ]}
          >
            Filter By {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}
          </Text>
          <Ionicons
            name="chevron-down"
            size={14}
            color={activeFilterCount > 0 ? theme.onAccent : theme.textMuted}
          />
        </Pressable>

        {activeFilterCount > 0 && (
          <Pressable onPress={resetFilters} style={styles.clearBadge}>
            <Text style={[styles.clearBadgeText, { color: theme.textMuted }]}>Reset</Text>
          </Pressable>
        )}
      </View>

      {/* Active filter pills summary */}
      {activeFilterCount > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0, maxHeight: 40, marginVertical: 8 }}
          contentContainerStyle={styles.activePillsScroll}
        >
          {selectedCategory !== 'ALL' && (
            <Pressable
              onPress={() => setSelectedCategory('ALL')}
              style={[
                styles.activePill,
                { backgroundColor: theme.mode === 'dark' ? '#4B1D6F' : '#DECFE8', borderColor: theme.mode === 'dark' ? '#FDD78B' : '#4B1D6F' },
              ]}
            >
              <Text style={[styles.activePillText, { color: theme.mode === 'dark' ? '#FDF3D2' : '#24152C' }]}>Category: {selectedCategory}</Text>
              <Ionicons name="close-circle" size={14} color={theme.mode === 'dark' ? '#FDF3D2' : '#24152C'} />
            </Pressable>
          )}
          {selectedOccasion !== 'ALL' && (
            <Pressable
              onPress={() => setSelectedOccasion('ALL')}
              style={[
                styles.activePill,
                { backgroundColor: theme.mode === 'dark' ? '#4B1D6F' : '#DECFE8', borderColor: theme.mode === 'dark' ? '#FDD78B' : '#4B1D6F' },
              ]}
            >
              <Text style={[styles.activePillText, { color: theme.mode === 'dark' ? '#FDF3D2' : '#24152C' }]}>Occasion: {selectedOccasion}</Text>
              <Ionicons name="close-circle" size={14} color={theme.mode === 'dark' ? '#FDF3D2' : '#24152C'} />
            </Pressable>
          )}
          {selectedLaundry !== 'ALL' && (
            <Pressable
              onPress={() => setSelectedLaundry('ALL')}
              style={[
                styles.activePill,
                { backgroundColor: theme.mode === 'dark' ? '#4B1D6F' : '#DECFE8', borderColor: theme.mode === 'dark' ? '#FDD78B' : '#4B1D6F' },
              ]}
            >
              <Text style={[styles.activePillText, { color: theme.mode === 'dark' ? '#FDF3D2' : '#24152C' }]}>
                {selectedLaundry === 'CLEAN' ? 'Status: Clean' : 'Status: Needs Washing'}
              </Text>
              <Ionicons name="close-circle" size={14} color={theme.mode === 'dark' ? '#FDF3D2' : '#24152C'} />
            </Pressable>
          )}
          {favoritesOnly && (
            <Pressable
              onPress={() => setFavoritesOnly(false)}
              style={[
                styles.activePill,
                { backgroundColor: theme.mode === 'dark' ? '#4B1D6F' : '#DECFE8', borderColor: theme.mode === 'dark' ? '#FDD78B' : '#4B1D6F' },
              ]}
            >
              <Text style={[styles.activePillText, { color: theme.mode === 'dark' ? '#FDF3D2' : '#24152C' }]}>★ Favorites Only</Text>
              <Ionicons name="close-circle" size={14} color={theme.mode === 'dark' ? '#FDF3D2' : '#24152C'} />
            </Pressable>
          )}
        </ScrollView>
      )}

      {/* Wardrobe Items Grid */}
      <FlatList
        style={{ flex: 1 }}
        data={filtered}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.columnWrap}
        contentContainerStyle={styles.gridContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <ClothingCard
            item={item}
            onToggleFavorite={toggleFavorite}
            selectionMode={selectionMode}
            isSelected={selectedIds.has(item.id)}
            onSelect={toggleItemSelection}
            onLongPress={startSelectionWith}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="shirt-outline" size={36} color={theme.textMuted} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No items match these filters</Text>
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>
              Try adjusting your category, occasion, or laundry status filters.
            </Text>
            {activeFilterCount > 0 && (
              <Pressable
                onPress={resetFilters}
                style={[styles.resetButton, { backgroundColor: theme.secondaryAccent }]}
              >
                <Text style={[styles.resetButtonText, { color: theme.onAccent }]}>Reset All Filters</Text>
              </Pressable>
            )}
          </View>
        }
      />

      {/* Floating Multi-Select & Batch Delete Action Bar */}
      {selectionMode && (
        <Animated.View
          entering={FadeInUp.duration(200)}
          style={[
            styles.floatingBar,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
            },
          ]}
        >
          <View style={styles.floatingLeft}>
            <Pressable
              onPress={cancelSelection}
              style={[styles.barButton, { borderColor: theme.border }]}
            >
              <Text style={[styles.barButtonText, { color: theme.text }]}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={toggleSelectAll}
              style={[styles.barButton, { borderColor: theme.border }]}
            >
              <Text style={[styles.barButtonText, { color: theme.text }]}>
                {selectedIds.size === filtered.length && filtered.length > 0
                  ? 'Deselect All'
                  : 'Select All'}
              </Text>
            </Pressable>
          </View>

          <Pressable
            disabled={selectedIds.size === 0}
            onPress={handleBatchDelete}
            style={[
              styles.deleteBatchBtn,
              { opacity: selectedIds.size === 0 ? 0.45 : 1 },
            ]}
          >
            <Ionicons name="trash" size={14} color="#FFFFFF" />
            <Text style={styles.deleteBatchText}>
              Delete Selected ({selectedIds.size})
            </Text>
          </Pressable>
        </Animated.View>
      )}

      {/* Unified Filter By Modal */}
      <Modal visible={filterModalVisible} animationType="slide" transparent onRequestClose={() => setFilterModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <SafeAreaView style={[styles.modalSheet, { backgroundColor: theme.background }]} edges={['bottom']}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <View>
                <Text style={[styles.modalTitle, { color: theme.text }]}>Filter Wardrobe</Text>
                <Text style={[styles.modalSubtitle, { color: theme.textMuted }]}>
                  Unified garment & laundry filters
                </Text>
              </View>
              <Pressable
                onPress={() => setFilterModalVisible(false)}
                style={[styles.modalCloseButton, { backgroundColor: theme.surface }]}
              >
                <Ionicons name="close" size={18} color={theme.text} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScrollContent}>
              {/* Category Filter */}
              <View style={styles.filterSection}>
                <Text style={[styles.filterSectionTitle, { color: theme.text }]}>Category</Text>
                <View style={styles.optionsWrap}>
                  {FILTER_CATEGORIES.map((cat) => {
                    const isSelected = selectedCategory === cat;
                    const label = cat === 'ALL' ? 'All Categories' : cat;
                    return (
                      <Pressable
                        key={cat}
                        onPress={() => setSelectedCategory(cat)}
                        style={[
                          styles.optionPill,
                          {
                            backgroundColor: isSelected ? theme.secondaryAccent : theme.surface,
                            borderColor: isSelected ? theme.secondaryAccent : theme.border,
                          },
                        ]}
                      >
                        <Text style={[styles.optionPillText, { color: isSelected ? theme.onAccent : theme.text }]}>
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Occasion Filter */}
              <View style={styles.filterSection}>
                <Text style={[styles.filterSectionTitle, { color: theme.text }]}>Occasion</Text>
                <View style={styles.optionsWrap}>
                  {FILTER_OCCASIONS.map((occ) => {
                    const isSelected = selectedOccasion === occ;
                    const label = occ === 'ALL' ? 'All Occasions' : occ;
                    return (
                      <Pressable
                        key={occ}
                        onPress={() => setSelectedOccasion(occ)}
                        style={[
                          styles.optionPill,
                          {
                            backgroundColor: isSelected ? theme.secondaryAccent : theme.surface,
                            borderColor: isSelected ? theme.secondaryAccent : theme.border,
                          },
                        ]}
                      >
                        <Text style={[styles.optionPillText, { color: isSelected ? theme.onAccent : theme.text }]}>
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Laundry Status Filter */}
              <View style={styles.filterSection}>
                <Text style={[styles.filterSectionTitle, { color: theme.text }]}>Laundry Status</Text>
                <View style={styles.optionsWrap}>
                  {FILTER_LAUNDRY.map((status) => {
                    const isSelected = selectedLaundry === status;
                    const label =
                      status === 'ALL' ? 'All Items' : status === 'CLEAN' ? 'Clean' : 'Needs Washing';
                    return (
                      <Pressable
                        key={status}
                        onPress={() => setSelectedLaundry(status)}
                        style={[
                          styles.optionPill,
                          {
                            backgroundColor: isSelected ? theme.secondaryAccent : theme.surface,
                            borderColor: isSelected ? theme.secondaryAccent : theme.border,
                          },
                        ]}
                      >
                        <Text style={[styles.optionPillText, { color: isSelected ? theme.onAccent : theme.text }]}>
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Favorites Only Switch */}
              <View style={[styles.switchRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <View style={styles.switchLabelWrap}>
                  <Ionicons name="heart" size={18} color="#E5484D" />
                  <View>
                    <Text style={[styles.switchTitle, { color: theme.text }]}>Favorites Only</Text>
                    <Text style={[styles.switchSubtitle, { color: theme.textMuted }]}>
                      Show only starred garments
                    </Text>
                  </View>
                </View>
                <Switch
                  value={favoritesOnly}
                  onValueChange={setFavoritesOnly}
                  trackColor={{ false: theme.border, true: theme.mode === 'dark' ? '#FDD78B' : '#4B1D6F' }}
                  thumbColor={theme.mode === 'dark' ? '#24152C' : '#FBF5A7'}
                />
              </View>
            </ScrollView>

            {/* Modal Bottom Actions */}
            <View style={[styles.modalFooter, { borderTopColor: theme.border }]}>
              <Pressable
                onPress={resetFilters}
                style={[styles.modalResetButton, { borderColor: theme.border, backgroundColor: theme.surface }]}
              >
                <Text style={[styles.modalResetText, { color: theme.text }]}>Reset</Text>
              </Pressable>
              <Pressable
                onPress={() => setFilterModalVisible(false)}
                style={[styles.modalApplyButton, { backgroundColor: theme.secondaryAccent }]}
              >
                <Text style={[styles.modalApplyText, { color: theme.onAccent }]}>
                  Show {filtered.length} {filtered.length === 1 ? 'Item' : 'Items'}
                </Text>
              </Pressable>
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Batch Delete Confirmation Dialog */}
      <ConfirmDialogModal
        visible={deleteConfirmModal.visible}
        variant="danger"
        title={deleteConfirmModal.title}
        message={deleteConfirmModal.message}
        confirmText={`Delete (${deleteConfirmModal.itemIds.length})`}
        cancelText="Cancel"
        loading={deletingBatch}
        onConfirm={executeDelete}
        onCancel={() => setDeleteConfirmModal({ visible: false, itemIds: [], title: '', message: '' })}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  title: { fontSize: 26, fontWeight: '800' },
  itemCount: { fontSize: 13, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  addLabel: { color: '#FFFFFF', fontWeight: '700', fontSize: 13.5 },
  filterBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 10,
    marginBottom: 6,
    gap: 10,
  },
  filterByButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  filterByButtonText: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  clearBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  clearBadgeText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  activePillsScroll: {
    paddingHorizontal: 20,
    gap: 8,
    alignItems: 'center',
  },
  activePill: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
  },
  activePillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  columnWrap: { paddingHorizontal: 20, gap: 12 },
  gridContent: { paddingTop: 6, paddingBottom: 24 },
  empty: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 8, paddingHorizontal: 30 },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  emptyText: { fontSize: 13, textAlign: 'center', lineHeight: 18 },
  resetButton: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
  },
  resetButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  // Modal styles
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingTop: 18,
    maxHeight: '88%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#DDD',
  },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  modalSubtitle: { fontSize: 12, marginTop: 2 },
  modalCloseButton: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  modalScrollContent: { paddingHorizontal: 20, paddingVertical: 16, gap: 20 },
  filterSection: { gap: 10 },
  filterSectionTitle: { fontSize: 13.5, fontWeight: '700', letterSpacing: 0.3 },
  optionsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  optionPillText: { fontSize: 12.5, fontWeight: '600' },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginTop: 4,
  },
  switchLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  switchTitle: { fontSize: 14, fontWeight: '700' },
  switchSubtitle: { fontSize: 11.5, marginTop: 2 },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#DDD',
  },
  modalResetButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalResetText: { fontSize: 14, fontWeight: '700' },
  modalApplyButton: {
    flex: 2,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalApplyText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  doneButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  doneButtonText: { fontSize: 13, fontWeight: '700' },
  floatingBar: {
    position: 'absolute',
    bottom: 20,
    left: 18,
    right: 18,
    borderRadius: 20,
    borderWidth: 1,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 8,
  },
  floatingLeft: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  barButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  barButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  deleteBatchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E5484D',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 14,
  },
  deleteBatchText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
});