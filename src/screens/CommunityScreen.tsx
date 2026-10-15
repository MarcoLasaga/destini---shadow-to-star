import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, FlatList, StyleSheet, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../hooks/useAppTheme';
import { useCommunity } from '../contexts/CommunityContext';
import { useOutfit } from '../contexts/OutfitContext';
import CommunityOutfitCard from '../components/CommunityOutfitCard';
import ShareOutfitModal from '../components/ShareOutfitModal';
import { useToast } from '../contexts/ToastContext';

const filters = ['All', 'Academic', 'Office', 'Formal', 'Casual', 'Workout'];

export default function CommunityScreen() {
  const theme = useAppTheme();
  const community = useCommunity();
  const { currentOutfit, savedOutfits } = useOutfit();
  const { showToast } = useToast();

  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [outfitToShare, setOutfitToShare] = useState(currentOutfit ?? savedOutfits[0] ?? null);

  useEffect(() => {
    community.refresh();
  }, [community.mode, community.occasion]);

  const action = (fn: () => Promise<void>) =>
    fn().catch((error) => showToast(error instanceof Error ? error.message : 'Action failed'));

  const handleOpenShare = () => {
    const candidate = currentOutfit ?? savedOutfits[0];
    if (!candidate) {
      Alert.alert(
        'No Outfits Available',
        'Generate an outfit recommendation first or save an outfit to your wardrobe before sharing with the community.'
      );
      return;
    }
    setOutfitToShare(candidate);
    setShareModalVisible(true);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: theme.text }]}>Community</Text>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>Find and share your favorite looks</Text>
        </View>
        <Pressable
          onPress={handleOpenShare}
          style={[
            styles.postButton,
            {
              backgroundColor: theme.secondaryAccent,
              borderColor: 'transparent',
              borderWidth: theme.mode === 'dark' ? 1 : 0,
            },
          ]}
        >
          <Ionicons name="add" size={16} color={theme.onAccent} />
          <Text style={[styles.postButtonText, { color: theme.onAccent }]}>Post Look</Text>
        </Pressable>
      </View>

      <View style={styles.modes}>
        {(['recent', 'trending'] as const).map((value) => {
          const isActive = community.mode === value;
          const bg = isActive ? theme.secondaryAccent : theme.surface;
          const textColor = isActive ? theme.onAccent : theme.text;
          const borderColor = isActive ? theme.secondaryAccent : theme.border;

          return (
            <Pressable
              key={value}
              onPress={() => community.setMode(value)}
              style={[
                styles.mode,
                {
                  backgroundColor: bg,
                  borderColor,
                  borderWidth: 1,
                },
              ]}
            >
              <Text style={{ color: textColor, fontWeight: '700', fontSize: 13 }}>
                {value === 'recent' ? 'Recent' : 'Trending'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <FlatList
        data={community.feed}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <CommunityOutfitCard
            outfit={item}
            onLike={() => action(() => community.toggleLike(item))}
            onSave={() => action(() => community.toggleSave(item))}
            onRate={(rating) => action(() => community.rate(item, rating))}
          />
        )}
        onEndReached={community.loadMore}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={community.refreshing}
            onRefresh={community.refresh}
            tintColor={theme.secondaryAccent}
          />
        }
        ListHeaderComponent={
          <View style={styles.filters}>
            {filters.map((filter) => (
              <Pressable
                key={filter}
                onPress={() => community.setOccasion(filter)}
                style={[
                  styles.filter,
                  {
                    borderColor: theme.border,
                    backgroundColor: community.occasion === filter ? theme.primaryAccent : theme.surface,
                  },
                ]}
              >
                <Text
                  style={{
                    color: community.occasion === filter ? '#3D2E10' : theme.text,
                    fontSize: 12.5,
                    fontWeight: '600',
                  }}
                >
                  {filter}
                </Text>
              </Pressable>
            ))}
          </View>
        }
        ListEmptyComponent={
          community.loading ? (
            <Text style={[styles.empty, { color: theme.textMuted }]}>Loading community looks...</Text>
          ) : (
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={36} color={theme.textMuted} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No shared outfits yet</Text>
              <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>
                Share a recommended look with a caption to inspire others!
              </Text>
              <Pressable
                onPress={handleOpenShare}
                style={[
                  styles.shareCta,
                  {
                    backgroundColor: theme.secondaryAccent,
                    borderColor: 'transparent',
                    borderWidth: theme.mode === 'dark' ? 1 : 0,
                  },
                ]}
              >
                <Text style={[styles.shareCtaText, { color: theme.onAccent }]}>Publish First Look</Text>
              </Pressable>
            </View>
          )
        }
      />

      {outfitToShare && (
        <ShareOutfitModal
          outfit={outfitToShare}
          visible={shareModalVisible}
          onClose={() => setShareModalVisible(false)}
          onPublished={() => {
            community.refresh();
            showToast('Look published to community feed!');
          }}
        />
      )}
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
  },
  title: { fontSize: 24, fontWeight: '800' },
  subtitle: { fontSize: 13, marginTop: 2 },
  postButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
  },
  postButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  modes: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 6 },
  mode: { borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 14 },
  filter: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 7 },
  list: { paddingHorizontal: 16, paddingBottom: 30 },
  empty: { alignItems: 'center', gap: 8, paddingTop: 60, paddingHorizontal: 30 },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  emptySubtitle: { fontSize: 13, textAlign: 'center' },
  shareCta: { marginTop: 12, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 999 },
  shareCtaText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
});
