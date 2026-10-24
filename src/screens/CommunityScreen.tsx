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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppTheme } from '../hooks/useAppTheme';
import { useCommunity } from '../contexts/CommunityContext';
import { useOutfit } from '../contexts/OutfitContext';
import { useProfile } from '../contexts/ProfileContext';
import { useAuth } from '../contexts/AuthContext';
import CommunityOutfitCard from '../components/CommunityOutfitCard';
import ShareOutfitModal from '../components/ShareOutfitModal';
import SocialListModal from '../components/SocialListModal';
import { useToast } from '../contexts/ToastContext';
import {
  classifyCommunityPostGender,
  isCurrentUserPost,
  MY_POST_IDS_KEY,
} from '../services/communityService';

export default function CommunityScreen() {
  const theme = useAppTheme();
  const community = useCommunity();
  const { currentOutfit, savedOutfits } = useOutfit();
  const { profile } = useProfile();
  const { session } = useAuth();
  const user = session?.user;
  const { showToast } = useToast();

  const [tab, setTab] = useState<'forYou' | 'following'>('forYou');
  const [shareVisible, setShareVisible] = useState(false);
  const [shareOutfit, setShareOutfit] = useState(currentOutfit ?? savedOutfits[0] ?? null);
  const [following, setFollowing] = useState<string[]>([]);
  const [myPostIds, setMyPostIds] = useState<string[]>([]);

  // Social List Modal state (for viewing likes, followers, following)
  const [socialModalVisible, setSocialModalVisible] = useState(false);
  const [socialModalTab, setSocialModalTab] = useState<'followers' | 'following' | 'likes'>('likes');
  const [selectedPostTitle, setSelectedPostTitle] = useState('');

  useEffect(() => {
    community.refresh();
    AsyncStorage.getItem('@stylesense_social_following_names').then((raw) => {
      if (raw) {
        try {
          const list = JSON.parse(raw);
          if (Array.isArray(list)) setFollowing(list);
        } catch {
          // ignore
        }
      }
    });
    AsyncStorage.getItem(MY_POST_IDS_KEY).then((raw) => {
      if (raw) {
        try {
          setMyPostIds(JSON.parse(raw));
        } catch {
          // ignore
        }
      }
    });
  }, [community.mode]);

  const ownName = (profile.displayName || '').toLowerCase();
  const filtered = useMemo(() => {
    return community.feed.filter((post) => {
      if (tab === 'following') return following.includes(post.creatorName);
      if (isCurrentUserPost(post, user, profile, myPostIds)) return true;
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
  }, [community.feed, tab, following, ownName, profile, user, myPostIds]);

  const openShare = () => {
    const candidate = currentOutfit ?? savedOutfits[0];
    if (!candidate) {
      showToast('Generate an outfit recommendation first before publishing a look.');
      return;
    }
    setShareOutfit(candidate);
    setShareVisible(true);
  };

  const handleToggleFollow = (creatorName: string) => {
    // Filter out self-follows completely
    if (creatorName.toLowerCase() === ownName) return;

    setFollowing((current) =>
      current.includes(creatorName)
        ? current.filter((name) => name !== creatorName)
        : [...current, creatorName]
    );
  };

  const handleOpenLikes = (postTitle: string) => {
    setSelectedPostTitle(postTitle);
    setSocialModalTab('likes');
    setSocialModalVisible(true);
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
        renderItem={({ item }) => {
          const isOwn = isCurrentUserPost(item, user, profile, myPostIds);
          return (
            <CommunityOutfitCard
              outfit={item}
              isOwnPost={isOwn}
              following={following.includes(item.creatorName)}
              onFollow={() => handleToggleFollow(item.creatorName)}
              onViewLikes={() => handleOpenLikes(item.name)}
              onLike={() =>
                community.toggleLike(item).catch((error) => showToast(error.message))
              }
              onSave={() =>
                community.toggleSave(item).catch((error) => showToast(error.message))
              }
              onDislike={() => showToast('Thanks, we’ll show fewer looks like this.')}
              onRepost={() => showToast('Look added to your reposts.')}
            />
          );
        }}
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

      {/* Social Followers / Following / Likes Modal */}
      <SocialListModal
        visible={socialModalVisible}
        initialTab={socialModalTab}
        postTitle={selectedPostTitle}
        onClose={() => setSocialModalVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  kicker: {
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 1.3,
  },
  title: {
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '900',
    marginTop: 2,
  },
  postButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#264C3B',
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 18,
    shadowColor: '#264C3B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 3,
  },
  postText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    gap: 20,
  },
  tab: {
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#264C3B',
  },
  tabText: {
    fontSize: 13.5,
    fontWeight: '800',
  },
  list: {
    paddingTop: 12,
    paddingBottom: 28,
  },
  empty: {
    padding: 36,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 240,
    lineHeight: 18,
  },
  emptyButton: {
    marginTop: 8,
    backgroundColor: '#264C3B',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
});
