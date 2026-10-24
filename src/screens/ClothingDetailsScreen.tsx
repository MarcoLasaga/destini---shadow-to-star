import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useAppTheme } from '../hooks/useAppTheme';
import { useWardrobe } from '../contexts/WardrobeContext';
import { useToast } from '../contexts/ToastContext';
import { RootStackParamList } from '../types';
import ConfirmDialogModal from '../components/common/ConfirmDialogModal';
import { resolveDatasetGarmentPhoto } from '../data/datasetGarmentCatalog';

export default function ClothingDetailsScreen() {
  const theme = useAppTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'ClothingDetails'>>();
  const { getItem, toggleFavorite, deleteItem } = useWardrobe();
  const { showToast } = useToast();

  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const item = getItem(route.params.id);

  if (!item) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.emptyState}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Item not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteItem(item.id);
      setDeleteModalVisible(false);
      showToast(`${item.name} deleted from wardrobe`);
      navigation.goBack();
    } catch {
      showToast('Could not delete garment');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.iconButton}>
          <Ionicons name="arrow-back" size={20} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Clothing Details</Text>
        <View style={styles.headerRight}>
          <Pressable onPress={() => setDeleteModalVisible(true)} style={styles.iconButton}>
            <Ionicons name="trash-outline" size={20} color="#E5484D" />
          </Pressable>
          <Pressable onPress={() => toggleFavorite(item.id)} style={styles.iconButton}>
            <Ionicons
              name={item.favorite ? 'heart' : 'heart-outline'}
              size={20}
              color={item.favorite ? '#E5484D' : theme.text}
            />
          </Pressable>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Image
          source={{ uri: resolveDatasetGarmentPhoto(item.name, item.category, item.image) }}
          style={styles.image}
          contentFit="cover"
          transition={200}
        />

        {/* Info Card styled with theme.surface & theme.border */}
        <View style={[styles.infoCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.titleRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={[styles.name, { color: theme.text }]}>{item.name}</Text>
              <Text style={[styles.meta, { color: theme.textMuted }]}>
                {item.category} · {item.color}
              </Text>
            </View>
            <Pressable
              onPress={() => navigation.navigate('EditClothing', { id: item.id })}
              style={[styles.editButton, { backgroundColor: theme.secondaryAccent }]}
            >
              <Ionicons name="create-outline" size={17} color={theme.onAccent} />
            </Pressable>
          </View>

          {/* Brand & Style Row */}
          <View style={styles.row}>
            <View style={styles.statBox}>
              <Text style={[styles.statLabel, { color: theme.textMuted }]}>Brand</Text>
              <Text style={[styles.statValue, { color: theme.text }]}>{item.brand || 'Unbranded'}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statLabel, { color: theme.textMuted }]}>Style</Text>
              <Text style={[styles.statValue, { color: theme.text }]}>{item.style || 'Casual'}</Text>
            </View>
          </View>

          {/* Material */}
          <View style={styles.section}>
            <Text style={[styles.statLabel, { color: theme.textMuted }]}>Material</Text>
            <Text style={[styles.sectionValue, { color: theme.text }]}>{item.material || 'Standard Fabric'}</Text>
          </View>

          {/* Seasons */}
          <View style={styles.section}>
            <Text style={[styles.statLabel, { color: theme.textMuted }]}>Seasons</Text>
            <Text style={[styles.sectionValue, { color: theme.text }]}>
              {item.seasons && item.seasons.length > 0 ? item.seasons.join(', ') : 'All Seasons'}
            </Text>
          </View>

          {/* Occasions */}
          <View style={styles.section}>
            <Text style={[styles.statLabel, { color: theme.textMuted }]}>Occasions</Text>
            <Text style={[styles.sectionValue, { color: theme.text }]}>
              {item.occasions && item.occasions.length > 0 ? item.occasions.join(', ') : 'Casual'}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Delete Garment Confirmation Dialog */}
      <ConfirmDialogModal
        visible={deleteModalVisible}
        variant="danger"
        title="Delete Garment"
        message={`Are you sure you want to remove "${item.name}" from your wardrobe? This action cannot be undone.`}
        confirmText="Delete Garment"
        cancelText="Keep"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteModalVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  content: { paddingBottom: 32 },
  image: { width: '100%', height: 320, backgroundColor: '#D9D9D9' },
  infoCard: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 18,
    borderRadius: 22,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  meta: { fontSize: 13.5, marginTop: 4, fontWeight: '500' },
  editButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  row: { flexDirection: 'row', marginTop: 18, gap: 12 },
  statBox: { flex: 1 },
  statLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  statValue: { fontSize: 14.5, fontWeight: '700' },
  section: { marginTop: 14 },
  sectionValue: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
});
