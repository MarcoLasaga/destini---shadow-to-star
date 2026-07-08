import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useAppTheme } from '../hooks/useAppTheme';
import { useWardrobe } from '../contexts/WardrobeContext';
import { RootStackParamList } from '../types';

export default function ClothingDetailsScreen() {
  const theme = useAppTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'ClothingDetails'>>();
  const { getItem, toggleFavorite } = useWardrobe();

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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Clothing Details</Text>
        <Pressable onPress={() => toggleFavorite(item.id)} style={styles.favoriteButton}>
          <Ionicons name={item.favorite ? 'heart' : 'heart-outline'} size={20} color={item.favorite ? '#E5484D' : theme.text} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Image source={{ uri: item.image }} style={styles.image} contentFit="cover" transition={200} />

        <View style={styles.infoCard}>
          <View style={styles.titleRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: theme.text }]}>{item.name}</Text>
              <Text style={[styles.meta, { color: theme.textMuted }]}>{item.category} · {item.color}</Text>
            </View>
            <Pressable
              onPress={() => navigation.navigate('EditClothing', { id: item.id })}
              style={[styles.editButton, { backgroundColor: theme.secondaryAccent }]}
            >
              <Ionicons name="create-outline" size={16} color="#FFFFFF" />
            </Pressable>
          </View>

          <View style={styles.row}>
            <View style={styles.statBox}>
              <Text style={[styles.statLabel, { color: theme.textMuted }]}>Brand</Text>
              <Text style={[styles.statValue, { color: theme.text }]}>{item.brand}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statLabel, { color: theme.textMuted }]}>Style</Text>
              <Text style={[styles.statValue, { color: theme.text }]}>{item.style}</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Material</Text>
            <Text style={[styles.sectionText, { color: theme.textMuted }]}>{item.material}</Text>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Seasons</Text>
            <Text style={[styles.sectionText, { color: theme.textMuted }]}>{item.seasons.join(', ')}</Text>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Occasions</Text>
            <Text style={[styles.sectionText, { color: theme.textMuted }]}>{item.occasions.join(', ')}</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 },
  backButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  favoriteButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  content: { paddingBottom: 24 },
  image: { width: '100%', height: 280, backgroundColor: '#D9D9D9' },
  infoCard: { marginHorizontal: 16, marginTop: 16, padding: 16, borderRadius: 20, backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { fontSize: 22, fontWeight: '800' },
  meta: { fontSize: 13.5, marginTop: 4 },
  editButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', marginTop: 16 },
  statBox: { flex: 1, paddingRight: 8 },
  statLabel: { fontSize: 12, marginBottom: 2 },
  statValue: { fontSize: 14, fontWeight: '700' },
  section: { marginTop: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '700' },
  sectionText: { fontSize: 13.5, marginTop: 4, lineHeight: 20 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
});
