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
import ConfirmDialogModal from '../components/common/ConfirmDialogModal';
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
  const isDark = theme.mode === 'dark';
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

  const [socialModalVisible, setSocialModalVisible] = useState(false);
  const [socialModalTab, setSocialModalTab] = useState<'followers' | 'following' | 'likes'>('likes');
  const [selectedPostTitle, setSelectedPostTitle] = useState('');
  const [unfollowTarget, setUnfollowTarget] = useState<string | null>(null);

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

      const userStyles = [
        ...(profile.preferredStyles || []),
        ...tasteSignals.likedStyles,
      ].map((s) => s.toLowerCase());
      if (userStyles.some((s) => postStyle.includes(s) || s.includes(postStyle))) {
        score += 20;
      }

      const userColors = [
        ...(profile.preferredColors || []),
        ...tasteSignals.likedColors,
      ].map((c) => c.toLowerCase());
      if (postColors.some((c) => userColors.some((uc) => uc.includes(c) || c.includes(uc)))) {
        score += 15;
      }

      if (
        postCategories.some((cat) =>
          tasteSignals.likedSubtypes.some((sub) => sub.toLowerCase().includes(cat))
        )
      ) {
        score += 10;
      }

      if (post.liked || post.saved || tasteSignals.likedPostIds.includes(post.id)) {
        score += 25;
      }

      return score;
    },
    [profile.preferredStyles, profile.preferredColors, tasteSignals]
  );

  const filtered = useMemo(() => {
    if (tab === 'all') {
      return community.feed;
    }

    if (tab === 'following') {
      return community.feed.filter((post) => following.includes(post.creatorName));
    }

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

    if (following.includes(creatorName)) {
      setUnfollowTarget(creatorName);
      return;
    }

    setFollowing((current) => {
      const next = [...current, creatorName];
      AsyncStorage.setItem('@stylesense_social_following_names', JSON.stringify(next)).catch(
        () => {}
      );
      showToast(`Following ${creatorName}`);
      return next;
    });
  };

  const handleConfirmUnfollow = () => {
    if (!unfollowTarget) return;
    const creatorName = unfollowTarget;
    setUnfollowTarget(null);

    setFollowing((current) => {
      const next = current.filter((name) => name !== creatorName);
      AsyncStorage.setItem('@stylesense_social_following_names', JSON.stringify(next)).catch(
        () => {}
      );
      return next;
    });

    showToast(`Unfollowed ${creatorName}`, {
      variant: 'warning',
      undoLabel: 'Undo',
      onUndo: () => {
        setFollowing((current) => {
          if (current.includes(creatorName)) return current;
          const restored = [...current, creatorName];
          AsyncStorage.setItem(
            '@stylesense_social_following_names',
            JSON.stringify(restored)
          ).catch(() => {});
          return restored;
        });
        showToast(`Following ${creatorName}`);
      },
    });
  };

  const handleOpenLikes = (postTitle: string) => {
    setSelectedPostTitle(postTitle);
    setSocialModalTab('likes');
    setSocialModalVisible(true);
  };

  const handleLikePost = async (item: CommunityOutfit) => {
    try {
      const wasLiked = !!item.liked;
      await community.toggleLike(item);
      showToast(wasLiked ? 'Removed from liked looks.' : 'Added to your liked looks!');
      await reloadTasteSignals();
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
      const wasSaved = !!item.saved;
      await community.toggleSave(item);
      if (wasSaved) {
        showToast('Removed from saved looks.', {
          variant: 'warning',
          undoLabel: 'Undo',
          onUndo: () => {
            community.toggleSave(item).catch(() => {});
            showToast('Look restored to saved looks.');
          },
        });
      } else {
        showToast('Look saved to your collection!');
      }
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

  const activeTabColor = isDark ? '#F3F1EF' : '#364536';
  const activeIndicatorColor = isDark ? '#8AB896' : '#364536';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['left', 'right']}>
      {/* Top Header */}
      <View style={styles.header}>
        <View>
          <View style={styles.kickerRow}>
            <View style={styles.kickerDot} />
            <Text style={[styles.kicker, { color: isDark ? '#C5DBC9' : '#364536' }]}>
              STYLE COMMUNITY
            </Text>
          </View>
          <Text style={[styles.title, { color: theme.text }]}>Looks worth saving</Text>
        </View>

        <Pressable onPress={openShare} style={styles.postButton}>
          <Ionicons name="add" size={16} color="#F3F1EF" />
          <Text style={styles.postText}>Post Look</Text>
        </Pressable>
      </View>

      {/* 3 Community Feed Tabs: All | For You | Following */}
      <View style={[styles.tabs, { borderBottomColor: theme.border }]}>
        {([
          ['all', 'All'],
          ['forYou', 'For You'],
          ['following', 'Following'],
        ] as const).map(([key, label]) => {
          const isActive = tab === key;
          return (
            <Pressable
              key={key}
              onPress={() => setTab(key)}
              style={[
                styles.tab,
                isActive && { borderBottomColor: activeIndicatorColor },
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: isActive ? activeTabColor : theme.textMuted },
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Cross-Gender Collaborative Affinity Banner on For You when active */}
      {tab === 'forYou' && tasteSignals.is_user_liked_cross_gender && (
        <View
          style={[
            styles.affinityBanner,
            { backgroundColor: theme.aiBannerBg, borderColor: theme.aiBannerBorder },
          ]}
        >
          <Ionicons name="sparkles" size={14} color={theme.aiBannerText} />
          <Text style={[styles.affinityBannerText, { color: theme.aiBannerText }]}>
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
            <View
              style={[
                styles.emptyIconCircle,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <Ionicons
                name="people-outline"
                size={28}
                color={isDark ? '#8AB896' : '#364536'}
              />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>
              No looks here yet
            </Text>
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>
              Follow a style-minded creator or publish your first studio flat-lay look.
            </Text>
            <Pressable onPress={openShare} style={styles.emptyButton}>
              <Ionicons name="add" size={16} color="#F3F1EF" />
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

      {/* Unfollow Creator Confirmation Dialog */}
      <ConfirmDialogModal
        visible={!!unfollowTarget}
        variant="danger"
        icon="person-remove-outline"
        title="Unfollow creator?"
        message={
          unfollowTarget
            ? `Are you sure you want to unfollow ${unfollowTarget}?`
            : 'Are you sure you want to unfollow this creator?'
        }
        confirmText="Unfollow"
        cancelText="Cancel"
        onConfirm={handleConfirmUnfollow}
        onCancel={() => setUnfollowTarget(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: 24,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  kickerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E84A42',
  },
  kicker: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  title: {
    fontSize: 23,
    lineHeight: 28,
    fontWeight: '800',
    marginTop: 2,
    letterSpacing: -0.3,
  },
  postButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#364536',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
  },
  postText: {
    color: '#F3F1EF',
    fontWeight: '800',
    fontSize: 12.5,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    gap: 24,
  },
  tab: {
    paddingVertical: 11,
    borderBottomWidth: 2.5,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontSize: 13.5,
    fontWeight: '800',
  },
  affinityBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 18,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  affinityBannerText: {
    fontSize: 11.5,
    fontWeight: '700',
    flex: 1,
  },
  list: {
    paddingTop: 14,
    paddingBottom: 28,
  },
  empty: {
    padding: 36,
    alignItems: 'center',
    gap: 10,
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 250,
    lineHeight: 18.5,
  },
  emptyButton: {
    marginTop: 6,
    backgroundColor: '#364536',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  emptyButtonText: {
    color: '#F3F1EF',
    fontWeight: '800',
    fontSize: 12.5,
  },
});
