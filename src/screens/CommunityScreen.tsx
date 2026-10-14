import React, { useEffect } from 'react';
import { View, Text, Pressable, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../hooks/useAppTheme';
import { useCommunity } from '../contexts/CommunityContext';
import CommunityOutfitCard from '../components/CommunityOutfitCard';
import { useToast } from '../contexts/ToastContext';

const filters = ['All', 'Casual', 'Work', 'Formal', 'Streetwear'];
export default function CommunityScreen() {
  const theme = useAppTheme(); const community = useCommunity(); const { showToast } = useToast();
  useEffect(() => { community.refresh(); }, [community.mode, community.occasion]);
  const action = (fn: () => Promise<void>) => fn().catch((error) => showToast(error instanceof Error ? error.message : 'Action failed'));
  return <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
    <View style={styles.header}><Text style={[styles.title, { color: theme.text }]}>Community</Text><Text style={[styles.subtitle, { color: theme.textMuted }]}>Find your next favorite look</Text></View>
    <View style={styles.modes}>{(['recent', 'trending'] as const).map((value) => <Pressable key={value} onPress={() => community.setMode(value)} style={[styles.mode, { backgroundColor: community.mode === value ? theme.secondaryAccent : theme.surface }]}><Text style={{ color: community.mode === value ? '#FFF' : theme.text }}>{value === 'recent' ? 'Recent' : 'Trending'}</Text></Pressable>)}</View>
    <FlatList data={community.feed} keyExtractor={(item) => item.id} contentContainerStyle={styles.list} renderItem={({ item }) => <CommunityOutfitCard outfit={item} onLike={() => action(() => community.toggleLike(item))} onSave={() => action(() => community.toggleSave(item))} onRate={(rating) => action(() => community.rate(item, rating))} />} onEndReached={community.loadMore} onEndReachedThreshold={0.5} refreshControl={<RefreshControl refreshing={community.refreshing} onRefresh={community.refresh} tintColor={theme.secondaryAccent} />} ListHeaderComponent={<View style={styles.filters}>{filters.map((filter) => <Pressable key={filter} onPress={() => community.setOccasion(filter)} style={[styles.filter, { borderColor: theme.border, backgroundColor: community.occasion === filter ? theme.primaryAccent : theme.surface }]}><Text style={{ color: theme.text, fontSize: 12 }}>{filter}</Text></Pressable>)}</View>} ListEmptyComponent={community.loading ? <Text style={[styles.empty, { color: theme.textMuted }]}>Loading community looks...</Text> : <View style={styles.empty}><Text style={{ color: theme.text }}>No shared outfits yet.</Text><Text style={{ color: theme.textMuted }}>Share a generated look to start the conversation.</Text>{community.error ? <Pressable onPress={community.refresh}><Text style={{ color: theme.secondaryAccent, marginTop: 10 }}>Try again</Text></Pressable> : null}</View>} />
  </SafeAreaView>;
}
const styles = StyleSheet.create({ container: { flex: 1 }, header: { paddingHorizontal: 20, paddingTop: 8 }, title: { fontSize: 24, fontWeight: '800' }, subtitle: { fontSize: 13, marginTop: 3 }, modes: { flexDirection: 'row', gap: 8, padding: 16, paddingBottom: 8 }, mode: { borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9 }, filters: { flexDirection: 'row', gap: 8, paddingBottom: 16 }, filter: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 }, list: { paddingHorizontal: 16, paddingBottom: 30 }, empty: { alignItems: 'center', gap: 6, paddingTop: 60 } });
