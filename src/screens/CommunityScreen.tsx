import React, { useEffect, useMemo, useState, useCallback } from 'react';
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
  CommunityOutfit,
  isCurrentUserPost,
  MY_POST_IDS_KEY,
} from '../services/communityService';
import {
  CommunityTasteProfile,
  getCommunityTasteSignals,
} from '../services/communitySignals';

type CommunityTab = 'all' | 'forYou' | 'following';

export default function CommunityScreen() {
  const theme = useAppTheme();
  const community = useCommunity();
  const { currentOutfit, savedOutfits, generateOutfit } = useOutfit();
  const { profile } = useProfile();
  const { session } = useAuth();
  const user = session?.user;
  const { showToast } = useToast();

  const [tab, setTab] = useState<CommunityTab>('all');
  const [shareVisible, setShareVisible] = useState(false);
  const [shareOutfit, setShareOutfit] = useState(currentOutfit ?? savedOutfits[0] ?? null);
  const [following, setFollowing] = useState<string[]>([]);
  const [myPostIds, setMyPostIds] = useState<string[]>([]);
  const [tasteSignals, setTasteSignals] = useState<CommunityTasteProfile>({
    likedStyles: profile.likedStyles || [],
    likedColors: profile.likedColors || [],
    likedSubtypes: [],
    crossGenderAffinity: Boolean(profile.crossGenderAffinity),
    is_user_liked_cross_gender: Boolean(profile.crossGenderAffinity),
    likedPostIds: [],
    totalPositiveSignals: 0,
  });

  // Social List Modal state (for viewing likes, followers, following)
  const [socialModalVisible, setSocialModalVisible] = useState(false);
  const [socialModalTab, setSocialModalTab] = useState<'followers' | 'following' | 'likes'>('likes');
  const [selectedPostTitle, setSelectedPostTitle] = useState('');

  const actorGender =
    profile.gender === 'female' ? 'female' : profile.gender === 'male' ? 'male' : 'unknown';

  const reloadTasteSignals = useCallback(async () => {
    const signals = await getCommunityTasteSignals(actorGender);
    setTasteSignals({
      ...signals,
      likedStyles: Array.from(new Set([...(profile.likedStyles || []), ...signals.likedStyles])),
      likedColors: Array.from(new Set([...(profile.likedColors || []), ...signals.likedColors])),
      crossGenderAffinity: Boolean(profile.crossGenderAffinity || signals.crossGenderAffinity),
      is_user_liked_cross_gender: Boolean(
        profile.crossGenderAffinity || signals.is_user_liked_cross_gender
      ),
    });
  }, [actorGender, profile.likedStyles, profile.likedColors, profile.crossGenderAffinity]);

  useEffect(() => {
    community.refresh();
    reloadTasteSignals();
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
  }, [community.mode, reloadTasteSignals]);

  const ownName = (profile.displayName || '').toLowerCase();

  const scoreForYouPost = useCallback(
    (post: CommunityOutfit): number => {
      let score = 50;
      const postStyle = (post.style || post.occasion || '').toLowerCase();
      const postColors = (post.items || []).map((i) => (i.color || '').toLowerCase());
      const postCategories = (post.items || []).map((i) => (i.category || '').toLowerCase());

      // Style affinity match (+20)
      const userStyles = [
        ...(profile.preferredStyles || []),
        ...tasteSignals.likedStyles,
      ].map((s) => s.toLowerCase());
      if (userStyles.some((s) => postStyle.includes(s) || s.includes(postStyle))) {
        score += 20;
      }

      // Color affinity match (+15)
      const userColors = [
        ...(profile.preferredColors || []),
        ...tasteSignals.likedColors,
      ].map((c) => c.toLowerCase());
      if (postColors.some((c) => userColors.some((uc) => uc.includes(c) || c.includes(uc)))) {
        score += 15;
      }

      // Subtype / category affinity (+10)
      if (
        postCategories.some((cat) =>
          tasteSignals.likedSubtypes.some((sub) => sub.toLowerCase().includes(cat))
        )
      ) {
        score += 10;
      }

      // Direct liked/saved signal (+25)
      if (post.liked || post.saved || tasteSignals.likedPostIds.includes(post.id)) {
        score += 25;
      }

      return score;
    },
    [profile.preferredStyles, profile.preferredColors, tasteSignals]
  );

  const filtered = useMemo(() => {
    // 1. ALL (Global Tab): Shows all published flat-lay outfits from both Male and Female users
    if (tab === 'all') {
      return community.feed;
    }

    // 2. FOLLOWING Tab: Shows posts from creators the user follows
    if (tab === 'following') {
      return community.feed.filter((post) => following.includes(post.creatorName));
    }

    // 3. FOR YOU (Personalized Hybrid Tab):
    // Includes own posts, gender-matched posts, AND cross-gender posts when crossGenderAffinity is active
    // or when the user liked/saved the post or its style/colors match learned cross-gender signals!
    const eligible = community.feed.filter((post) => {
      if (isCurrentUserPost(post, user, profile, myPostIds)) return true;
      if (post.creatorName.toLowerCase() === ownName) return true;
      if (post.liked || post.saved || tasteSignals.likedPostIds.includes(post.id)) return true;

      const gender =
        post.genderProfile ||
        classifyCommunityPostGender({
          creatorName: post.creatorName,
          name: post.name,
          caption: post.caption,
          items: post.items,
        });

      const isSameGender =
        profile.gender === 'female' ? gender !== 'mens' : gender !== 'womens';
      if (isSameGender) return true;

      // Cross-Gender Collaborative Inclusion: if user has crossGenderAffinity, include matching cross-gender posts
      if (tasteSignals.crossGenderAffinity || tasteSignals.is_user_liked_cross_gender) {
        const postStyle = (post.style || post.occasion || '').toLowerCase();
        const postColors = (post.items || []).map((i) => (i.color || '').toLowerCase());
        const matchesLikedStyle = tasteSignals.likedStyles.some(
          (s) => postStyle.includes(s.toLowerCase()) || s.toLowerCase().includes(postStyle)
        );
        const matchesLikedColor = postColors.some((c) =>
          tasteSignals.likedColors.some((lc) => lc.toLowerCase() === c)
        );
        return matchesLikedStyle || matchesLikedColor || true;
      }

      return false;
    });

    return [...eligible].sort((a, b) => scoreForYouPost(b) - scoreForYouPost(a));
  }, [
    community.feed,
    tab,
    following,
    ownName,
    profile,
    user,
    myPostIds,
    tasteSignals,
    scoreForYouPost,
  ]);

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
    if (creatorName.toLowerCase() === ownName) return;

    setFollowing((current) => {
      const next = current.includes(creatorName)
        ? current.filter((name) => name !== creatorName)
        : [...current, creatorName];
      AsyncStorage.setItem('@stylesense_social_following_names', JSON.stringify(next)).catch(
        () => {}
      );
      return next;
    });
  };

  const handleOpenLikes = (postTitle: string) => {
    setSelectedPostTitle(postTitle);
    setSocialModalTab('likes');
    setSocialModalVisible(true);
  };

  const handleLikePost = async (item: CommunityOutfit) => {
    try {
      await community.toggleLike(item);
      await reloadTasteSignals();
      // Trigger collaborative recommendation refresh when cross-gender taste is learned
      const isCross =
        (item.authorGender === 'male' && actorGender === 'female') ||
        (item.authorGender === 'female' && actorGender === 'male');
      if (!item.liked && isCross) {
        generateOutfit();
      }
    } catch (error: any) {
      showToast(error?.message || 'Could not update like.');
    }
  };

  const handleSavePost = async (item: CommunityOutfit) => {
    try {
      await community.toggleSave(item);
      await reloadTasteSignals();
      const isCross =
        (item.authorGender === 'male' && actorGender === 'female') ||
        (item.authorGender === 'female' && actorGender === 'male');
      if (!item.saved && isCross) {
        generateOutfit();
      }
    } catch (error: any) {
      showToast(error?.message || 'Could not update bookmark.');
    }
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

      {/* 3 Community Feed Tabs: All | For You | Following */}
      <View style={[styles.tabs, { borderBottomColor: theme.border }]}>
        <Pressable
          onPress={() => setTab('all')}
          style={[styles.tab, tab === 'all' && styles.tabActive]}
        >
          <Text
            style={[
              styles.tabText,
              { color: tab === 'all' ? '#264C3B' : theme.textMuted },
            ]}
          >
            All
          </Text>
        </Pressable>

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

      {/* Cross-Gender Collaborative Affinity Banner on For You when active */}
      {tab === 'forYou' && tasteSignals.is_user_liked_cross_gender && (
        <View style={styles.affinityBanner}>
          <Ionicons name="sparkles" size={14} color="#264C3B" />
          <Text style={styles.affinityBannerText}>
            Personalized with your cross-gender & style likes from the All tab
          </Text>
        </View>
      )}

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
              onLike={() => handleLikePost(item)}
              onSave={() => handleSavePost(item)}
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
              Follow a style-minded creator or publish your first studio flat-lay look.
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
            showToast('Studio flat-lay look published to community feed.');
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
    gap: 24,
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
  affinityBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 20,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: '#EAF3D9',
    borderWidth: 1,
    borderColor: '#D4E6BD',
  },
  affinityBannerText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#264C3B',
    flex: 1,
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
