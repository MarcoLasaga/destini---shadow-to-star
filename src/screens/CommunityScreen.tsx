import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../hooks/useAppTheme';
import { useCommunity } from '../contexts/CommunityContext';
import { useOutfit } from '../contexts/OutfitContext';
import { useProfile } from '../contexts/ProfileContext';
import CommunityOutfitCard from '../components/CommunityOutfitCard';
import ShareOutfitModal from '../components/ShareOutfitModal';
import { useToast } from '../contexts/ToastContext';
import { classifyCommunityPostGender } from '../services/communityService';

export default function CommunityScreen() {
  const theme = useAppTheme();
  const community = useCommunity();
  const { currentOutfit, savedOutfits } = useOutfit();
  const { profile } = useProfile();
  const { showToast } = useToast();

  const [tab, setTab] = useState<'forYou' | 'following'>('forYou');
  const [shareVisible, setShareVisible] = useState(false);
  const [shareOutfit, setShareOutfit] = useState(currentOutfit ?? savedOutfits[0] ?? null);
  const [following, setFollowing] = useState<string[]>([]);

  useEffect(() => {
    community.refresh();
  }, [community.mode]);

  const ownName = (profile.displayName || '').toLowerCase();
  const filtered = useMemo(() => {
    return community.feed.filter((post) => {
      if (tab === 'following') return following.includes(post.creatorName);
      if (post.creatorName.toLowerCase() === ownName) return true;
      const gender =
        post.genderProfile ||
        classifyCommunityPostGender({
          creatorName: post.creatorName,
          name: post.name,
          caption: post.caption,
          items: post.items,
        });
      return profile.gender === 'female' ? gender !== 'mens' : gender !== 'womens';
    });
  }, [community.feed, tab, following, ownName, profile.gender]);

  const openShare = () => {
    const candidate = currentOutfit ?? savedOutfits[0];
    if (!candidate) {
      showToast('Generate an outfit recommendation first before publishing a look.');
      return;
    }
    setShareOutfit(candidate);
    setShareVisible(true);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      {/* Top Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.kicker, { color: '#4D9A65' }]}>STYLE COMMUNITY</Text>
          <Text style={[styles.title, { color: theme.text }]}>Looks worth saving</Text>
        </View>

        <Pressable onPress={openShare} style={styles.postButton}>
          <Ionicons name="add" size={16} color="#FFFFFF" />
          <Text style={styles.postText}>Post Look</Text>
        </Pressable>
      </View>

      {/* Tabs */}
      <View style={[styles.tabs, { borderBottomColor: theme.border }]}>
        <Pressable
          onPress={() => setTab('forYou')}
          style={[styles.tab, tab === 'forYou' && styles.tabActive]}
        >
          <Text
            style={[
              styles.tabText,
              { color: tab === 'forYou' ? '#264C3B' : theme.textMuted },
            ]}
          >
            For You
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setTab('following')}
          style={[styles.tab, tab === 'following' && styles.tabActive]}
        >
          <Text
            style={[
              styles.tabText,
              { color: tab === 'following' ? '#264C3B' : theme.textMuted },
            ]}
          >
            Following
          </Text>
        </Pressable>
      </View>

      {/* Community Feed List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <CommunityOutfitCard
            outfit={item}
            following={following.includes(item.creatorName)}
            onFollow={() =>
              setFollowing((current) =>
                current.includes(item.creatorName)
                  ? current.filter((name) => name !== item.creatorName)
                  : [...current, item.creatorName]
              )
            }
            onLike={() =>
              community.toggleLike(item).catch((error) => showToast(error.message))
            }
            onSave={() =>
              community.toggleSave(item).catch((error) => showToast(error.message))
            }
            onDislike={() => showToast('Thanks, we’ll show fewer looks like this.')}
            onRepost={() => showToast('Look added to your reposts.')}
          />
        )}
        onEndReached={community.loadMore}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={community.refreshing}
            onRefresh={community.refresh}
            tintColor={theme.accent}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={40} color={theme.textMuted} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>
              No looks here yet
            </Text>
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>
              Follow a style-minded creator or publish your first dressed mannequin look.
            </Text>
            <Pressable onPress={openShare} style={styles.emptyButton}>
              <Text style={styles.emptyButtonText}>Post Look</Text>
            </Pressable>
          </View>
        }
      />

      {shareOutfit && (
        <ShareOutfitModal
          outfit={shareOutfit}
          visible={shareVisible}
          onClose={() => setShareVisible(false)}
          onPublished={() => {
            community.refresh();
            showToast('Look published to community feed.');
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  kicker: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    marginTop: 4,
  },
  postButton: {
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
    backgroundColor: '#264C3B',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  postText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 24,
    borderBottomWidth: 1,
  },
  tab: {
    paddingVertical: 12,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#4D9A65',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '900',
  },
  list: {
    padding: 16,
    paddingBottom: 32,
  },
  empty: {
    alignItems: 'center',
    gap: 10,
    paddingTop: 72,
    paddingHorizontal: 28,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  emptyText: {
    textAlign: 'center',
    lineHeight: 20,
    fontSize: 13,
  },
  emptyButton: {
    marginTop: 10,
    backgroundColor: '#264C3B',
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 13,
  },
});
