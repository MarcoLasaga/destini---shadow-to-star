import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import { useAppTheme } from '../hooks/useAppTheme';
import { useProfile } from '../contexts/ProfileContext';
import { useCommunity } from '../contexts/CommunityContext';
import { useOutfit, isPlaceholderOrEmptyOutfit } from '../contexts/OutfitContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useSettings } from '../contexts/SettingsContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AltaOutfitCollage from '../components/AltaOutfitCollage';
import SocialListModal from '../components/SocialListModal';
import ConfirmDialogModal from '../components/common/ConfirmDialogModal';
import {
  CommunityOutfit,
  isCurrentUserPost,
  syncCreatorNickname,
} from '../services/communityService';
import { GeneratedOutfit, OutfitClothingItem } from '../types';
import {
  classifyAnatomicalSlot,
  colorNameToHex,
} from '../services/outfitRecommendationService';
import { formatRelativeTime } from '../utils/timeFormat';
import {
  getSavedAccounts,
  saveAccount,
  SavedAccount,
} from '../services/accountManagerService';

export default function ProfileScreen() {
  const theme = useAppTheme();
  const isDark = theme.mode === 'dark';
  const navigation = useNavigation<any>();
  const { profile, updateProfile, setAvatar } = useProfile();
  const community = useCommunity();
  const { savedOutfits: rawSavedOutfits, toggleSave, deleteSavedOutfit } = useOutfit();
  const savedOutfits = useMemo(
    () => rawSavedOutfits.filter((o) => !isPlaceholderOrEmptyOutfit(o) && o.saved !== false),
    [rawSavedOutfits]
  );
  const { logout, session } = useAuth();
  const { showToast } = useToast();
  const { themePreference, setThemePreference } = useSettings();

  const [settingsVisible, setSettingsVisible] = useState(false);
  const [logoutConfirmVisible, setLogoutConfirmVisible] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [removeSavedTarget, setRemoveSavedTarget] = useState<GeneratedOutfit | null>(null);
  const [removeAvatarConfirmVisible, setRemoveAvatarConfirmVisible] = useState(false);
  const [deletingPost, setDeletingPost] = useState(false);
  const [socialModalVisible, setSocialModalVisible] = useState(false);
  const [socialModalTab, setSocialModalTab] = useState<'followers' | 'following' | 'likes'>('followers');
  const [followingCount, setFollowingCount] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);
  const [tab, setTab] = useState<'Published' | 'Liked' | 'Saved'>('Published');
  const [myPostIds, setMyPostIds] = useState<string[]>([]);

  // Profile Picture Selection & Preview Modal State
  const [avatarModalVisible, setAvatarModalVisible] = useState(false);
  const [pendingAvatarUri, setPendingAvatarUri] = useState<string | null>(null);
  const [savingAvatar, setSavingAvatar] = useState(false);

  const openAvatarEditor = () => {
    setPendingAvatarUri(profile.avatarUri || null);
    setAvatarModalVisible(true);
  };

  const handlePickAvatar = async (useCamera: boolean) => {
    try {
      const permission = useCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        showToast(
          `Please allow ${useCamera ? 'camera' : 'photo library'} access in settings.`
        );
        return;
      }

      const result = useCamera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.85,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.85,
          });

      if (!result.canceled && result.assets?.[0]?.uri) {
        setPendingAvatarUri(result.assets[0].uri);
      }
    } catch {
      showToast('Could not open image picker.');
    }
  };

  const handleConfirmAvatar = async () => {
    if (pendingAvatarUri === (profile.avatarUri || null)) {
      setAvatarModalVisible(false);
      return;
    }
    setSavingAvatar(true);
    try {
      if (!pendingAvatarUri) {
        await updateProfile({ avatarUri: null });
        syncCreatorNickname(profile.displayName, null);
        showToast('Profile picture removed.');
      } else {
        try {
          await setAvatar(pendingAvatarUri);
          syncCreatorNickname(profile.displayName, pendingAvatarUri);
          showToast('Profile picture updated!');
        } catch {
          await updateProfile({ avatarUri: pendingAvatarUri });
          syncCreatorNickname(profile.displayName, pendingAvatarUri);
          showToast('Profile picture updated!');
        }
      }
      setAvatarModalVisible(false);
    } catch {
      showToast('Failed to update profile picture.');
    } finally {
      setSavingAvatar(false);
    }
  };


  useEffect(() => {
    AsyncStorage.getItem('@stylesense_my_post_ids').then((raw) => {
      if (raw) {
        try {
          const list = JSON.parse(raw);
          if (Array.isArray(list)) setMyPostIds(list);
        } catch {
          // ignore
        }
      }
    });
  }, []);

  useEffect(() => {
    AsyncStorage.getItem('@stylesense_social_following_names').then((raw) => {
      if (raw) {
        try {
          const list = JSON.parse(raw);
          if (Array.isArray(list)) setFollowingCount(list.length);
        } catch {
          // ignore
        }
      } else {
        setFollowingCount(0);
      }
    });

    AsyncStorage.getItem('@stylesense_social_followers').then((raw) => {
      if (raw) {
        try {
          const list = JSON.parse(raw);
          if (Array.isArray(list)) setFollowersCount(list.length);
        } catch {
          // ignore
        }
      } else {
        setFollowersCount(0);
      }
    });
  }, [socialModalVisible]);

  // Manage Published Post Bottom Sheet State
  const [manageModalVisible, setManageModalVisible] = useState(false);
  const [selectedPost, setSelectedPost] = useState<CommunityOutfit | null>(null);
  const [deleteConfirmStep, setDeleteConfirmStep] = useState(false);

  // Switch Account Bottom Sheet State
  const [switchModalVisible, setSwitchModalVisible] = useState(false);
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const [addAccountConfirm, setAddAccountConfirm] = useState(false);

  useEffect(() => {
    if (profile.email || profile.displayName) {
      const currentAcc: SavedAccount = {
        id: profile.email || 'active-user',
        displayName: profile.displayName || 'User',
        email: profile.email || '',
        avatarUri: profile.avatarUri || null,
        lastActive: Date.now(),
      };
      saveAccount(currentAcc).then((list) => {
        setSavedAccounts(list);
      });
    } else {
      getSavedAccounts().then(setSavedAccounts);
    }
  }, [profile]);

  const userPublishedPosts = useMemo(() => {
    return community.feed.filter((post) => isCurrentUserPost(post, session?.user, profile, myPostIds));
  }, [community.feed, session?.user, profile, myPostIds]);

  const totalPublishedLikes = useMemo(() => {
    return userPublishedPosts.reduce((acc, p) => acc + (p.like_count || 0), 0);
  }, [userPublishedPosts]);

  const posts = useMemo(() => {
    if (tab === 'Published') {
      return userPublishedPosts;
    }
    if (tab === 'Liked') {
      return community.feed.filter((post) => post.liked);
    }
    return [];
  }, [userPublishedPosts, community.feed, tab]);

  const initial =
    profile.displayName?.trim().charAt(0).toUpperCase() ||
    profile.firstName?.trim().charAt(0).toUpperCase() ||
    'U';
  const likesCount = totalPublishedLikes;

  const openManagePost = (post: CommunityOutfit) => {
    setSelectedPost(post);
    setDeleteConfirmStep(false);
    setManageModalVisible(true);
  };

  const handleHideArchive = async () => {
    if (!selectedPost) return;
    try {
      await community.hidePost(selectedPost.id);
      showToast('Post archived from your public space.');
    } catch {
      showToast('Unable to archive post.');
    } finally {
      setManageModalVisible(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedPost || deletingPost) return;
    setDeletingPost(true);
    try {
      await community.deletePost(selectedPost.id);
      showToast('Post deleted.');
    } catch {
      showToast('Unable to delete post.');
    } finally {
      setDeletingPost(false);
      setManageModalVisible(false);
      setDeleteConfirmStep(false);
    }
  };

  const handleConfirmRemoveSavedOutfit = () => {
    if (!removeSavedTarget) return;
    const target = removeSavedTarget;
    setRemoveSavedTarget(null);
    deleteSavedOutfit(target.id);
    showToast(`"${target.name}" removed from saved looks.`, {
      variant: 'warning',
      undoLabel: 'Undo',
      onUndo: () => {
        toggleSave(target.id);
        showToast(`"${target.name}" restored to saved looks.`);
      },
    });
  };

  const handleConfirmLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      setLogoutConfirmVisible(false);
      await logout();
    } finally {
      setIsLoggingOut(false);
    }
  };

  const openSwitchAccountsModal = async () => {
    const list = await getSavedAccounts();
    setSavedAccounts(list);
    setAddAccountConfirm(false);
    setSettingsVisible(false);
    setSwitchModalVisible(true);
  };

  const handleSwitchAccount = async (acc: SavedAccount) => {
    try {
      await updateProfile({
        displayName: acc.displayName,
        email: acc.email,
        avatarUri: acc.avatarUri || null,
      });
      showToast(`Switched to ${acc.displayName}`);
    } catch {
      showToast(`Switched to ${acc.displayName}`);
    } finally {
      setSwitchModalVisible(false);
    }
  };

  const handleAddAnotherAccount = async () => {
    setSwitchModalVisible(false);
    showToast('Redirecting to sign in with another account...');
    await logout();
  };

  const isEmptyTab =
    (tab !== 'Saved' && posts.length === 0) ||
    (tab === 'Saved' && savedOutfits.length === 0);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['left', 'right']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Top Bar */}
        <View style={styles.topBar}>
          <View>
            <View style={styles.kickerRow}>
              <View style={styles.kickerDot} />
              <Text style={[styles.kicker, { color: isDark ? '#C5DBC9' : '#364536' }]}>
                YOUR STYLE SPACE
              </Text>
            </View>
            <Text style={[styles.screenTitle, { color: theme.text }]}>Account</Text>
          </View>

          <View style={styles.topRightActions}>
            <Pressable
              onPress={() => setSettingsVisible(true)}
              style={[
                styles.gear,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                },
              ]}
              accessibilityLabel="Account settings"
            >
              <Ionicons name="settings-outline" size={19} color={theme.text} />
            </Pressable>
          </View>
        </View>

        {/* Sleek Compact Profile Header Card */}
        <View
          style={[
            styles.profileCard,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <View style={styles.identityRow}>
            <Pressable
              onPress={openAvatarEditor}
              style={styles.avatarOuterWrap}
              accessibilityRole="button"
              accessibilityLabel="Change profile picture"
            >
              <View style={[styles.avatar, { backgroundColor: '#364536' }]}>
                {profile.avatarUri ? (
                  <Image
                    source={{ uri: profile.avatarUri }}
                    style={styles.avatarImage}
                    contentFit="cover"
                  />
                ) : (
                  <Text style={styles.initial}>{initial}</Text>
                )}
              </View>
              <View
                style={[
                  styles.avatarCameraBadge,
                  {
                    backgroundColor: '#E83E35',
                    borderColor: theme.surface,
                  },
                ]}
              >
                <Ionicons name="camera" size={12} color="#F3F1EF" />
              </View>
            </Pressable>

            <View style={styles.identityInfo}>
              <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
                {profile.displayName || 'Style Member'}
              </Text>
              <Text style={[styles.handle, { color: theme.textMuted }]} numberOfLines={1}>
                {profile.email || '@stylesense_member'}
              </Text>
              <View style={styles.metaBadgeRow}>
                {profile.location ? (
                  <View
                    style={[
                      styles.metaBadge,
                      { backgroundColor: theme.surfaceSecondary },
                    ]}
                  >
                    <Ionicons
                      name="location-outline"
                      size={11}
                      color={isDark ? '#8AB896' : '#364536'}
                    />
                    <Text style={[styles.metaBadgeText, { color: theme.textMuted }]}>
                      {profile.location}
                    </Text>
                  </View>
                ) : null}
                {profile.fitPreference ? (
                  <View
                    style={[
                      styles.metaBadge,
                      { backgroundColor: theme.surfaceSecondary },
                    ]}
                  >
                    <Ionicons
                      name="body-outline"
                      size={11}
                      color={isDark ? '#8AB896' : '#364536'}
                    />
                    <Text style={[styles.metaBadgeText, { color: theme.textMuted }]}>
                      {profile.fitPreference} Fit
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>

          {/* Clean Inline Divider Stats Strip (No Nested Dark Boxes) */}
          <View style={[styles.statsBar, { borderTopColor: theme.border }]}>
            <Pressable
              onPress={() => {
                setSocialModalTab('followers');
                setSocialModalVisible(true);
              }}
              style={styles.statCell}
              accessibilityLabel="View followers"
            >
              <Text style={[styles.statValue, { color: theme.text }]}>{followersCount}</Text>
              <Text style={[styles.statLabel, { color: theme.textMuted }]}>Followers</Text>
            </Pressable>

            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />

            <Pressable
              onPress={() => {
                setSocialModalTab('following');
                setSocialModalVisible(true);
              }}
              style={styles.statCell}
              accessibilityLabel="View following creators"
            >
              <Text style={[styles.statValue, { color: theme.text }]}>{followingCount}</Text>
              <Text style={[styles.statLabel, { color: theme.textMuted }]}>Following</Text>
            </Pressable>

            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />

            <Pressable
              onPress={() => {
                setSocialModalTab('likes');
                setSocialModalVisible(true);
              }}
              style={styles.statCell}
              accessibilityLabel="View post likes"
            >
              <Text style={[styles.statValue, { color: theme.text }]}>{likesCount}</Text>
              <Text style={[styles.statLabel, { color: theme.textMuted }]}>Likes</Text>
            </Pressable>
          </View>
        </View>

        {/* 3-Column Tab Bar */}
        <View style={[styles.tabs, { borderBottomColor: theme.border }]}>
          {([
            ['Published', 'grid-outline', userPublishedPosts.length],
            ['Liked', 'heart-outline', community.feed.filter((p) => p.liked).length],
            ['Saved', 'bookmark-outline', savedOutfits.length],
          ] as const).map(([value, iconName, count]) => {
            const isActive = tab === value;
            return (
              <Pressable
                key={value}
                onPress={() => setTab(value)}
                style={styles.tab}
              >
                <View style={styles.tabTitleRow}>
                  <Ionicons
                    name={iconName}
                    size={14}
                    color={isActive ? theme.text : theme.textMuted}
                  />
                  <Text
                    style={[
                      styles.tabText,
                      { color: isActive ? theme.text : theme.textMuted },
                    ]}
                  >
                    {value}
                  </Text>
                  {count > 0 && (
                    <Text
                      style={[
                        styles.tabCountText,
                        { color: isActive ? (isDark ? '#8AB896' : '#364536') : theme.textMuted },
                      ]}
                    >
                      {count}
                    </Text>
                  )}
                </View>
                {isActive && (
                  <View
                    style={[
                      styles.activeTabIndicator,
                      { backgroundColor: isDark ? '#8AB896' : '#364536' },
                    ]}
                  />
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Grid Content */}
        {!isEmptyTab ? (
          tab === 'Saved' ? (
            <View style={styles.grid}>
              {savedOutfits.map((outfit) => (
                <Pressable
                  key={outfit.id}
                  onPress={() => navigation.navigate('OutfitDetails', { outfitId: outfit.id })}
                  style={[
                    styles.gridCard,
                    { backgroundColor: theme.surface, borderColor: theme.border },
                  ]}
                >
                  <View style={styles.gridMannequin}>
                    <AltaOutfitCollage
                      items={outfit.clothingItems || []}
                      compact
                      interactive={false}
                    />
                  </View>
                  <Text style={[styles.gridKicker, { color: isDark ? '#8AB896' : '#364536' }]}>
                    SAVED LOOK
                  </Text>
                  <Text style={[styles.gridTitle, { color: theme.text }]} numberOfLines={1}>
                    {outfit.name}
                  </Text>
                  <Text style={[styles.gridMeta, { color: theme.textMuted }]}>
                    {outfit.occasionLabel || 'Everyday'}
                  </Text>

                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      setRemoveSavedTarget(outfit);
                    }}
                    style={[
                      styles.gridMenu,
                      {
                        backgroundColor: theme.surface,
                        borderColor: theme.border,
                        borderWidth: 1,
                      },
                    ]}
                    hitSlop={8}
                    accessibilityLabel={`Remove ${outfit.name} from saved outfits`}
                  >
                    <Ionicons name="trash-outline" size={15} color="#E84A42" />
                  </Pressable>
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={styles.grid}>
              {posts.map((post) => {
                const collageItems: OutfitClothingItem[] = post.items.map((item) => ({
                  id: item.id,
                  name: item.name,
                  category: (item.category as any) || 'Top',
                  image: item.image,
                  color: item.color,
                  hexColor: colorNameToHex(item.color || ''),
                  slotType: classifyAnatomicalSlot(item.name, item.category),
                }));

                return (
                  <View
                    key={post.id}
                    style={[
                      styles.gridCard,
                      { backgroundColor: theme.surface, borderColor: theme.border },
                    ]}
                  >
                    <View style={styles.gridMannequin}>
                      <AltaOutfitCollage
                        items={collageItems}
                        compact
                        interactive={false}
                      />
                    </View>

                    <Text style={[styles.gridTitle, { color: theme.text }]} numberOfLines={1}>
                      {post.name}
                    </Text>
                    <Text style={[styles.gridMeta, { color: theme.textMuted }]}>
                      {formatRelativeTime(post.created_at)} · {post.like_count} likes
                    </Text>

                    {tab === 'Published' && (
                      <Pressable
                        onPress={() => openManagePost(post)}
                        style={[
                          styles.gridMenu,
                          {
                            backgroundColor: theme.surface,
                            borderColor: theme.border,
                            borderWidth: 1,
                          },
                        ]}
                        hitSlop={8}
                      >
                        <Ionicons
                          name="ellipsis-horizontal"
                          size={16}
                          color={theme.textMuted}
                        />
                      </Pressable>
                    )}
                  </View>
                );
              })}
            </View>
          )
        ) : (
          /* Refined Editorial Empty State Card */
          <View
            style={[
              styles.emptyStateCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <View
              style={[
                styles.emptyIconCircle,
                { backgroundColor: theme.surfaceSecondary, borderColor: theme.border },
              ]}
            >
              <Ionicons
                name={
                  tab === 'Published'
                    ? 'sparkles-outline'
                    : tab === 'Liked'
                    ? 'heart-outline'
                    : 'bookmark-outline'
                }
                size={24}
                color={isDark ? '#8AB896' : '#364536'}
              />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>
              {tab === 'Published'
                ? 'No published looks yet'
                : tab === 'Liked'
                ? 'No liked outfits yet'
                : 'No saved outfits yet'}
            </Text>
            <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>
              {tab === 'Published'
                ? 'Share your favorite AI-curated flat-lay looks with the StyleSense community.'
                : tab === 'Liked'
                ? 'Double-tap looks you love in the Community feed to build your inspiration board.'
                : 'Bookmark outfits from Recommendations or Community so they are always ready to wear.'}
            </Text>
            <Pressable
              onPress={() =>
                navigation.navigate(tab === 'Liked' ? 'Community' : 'Outfit')
              }
              style={[styles.emptyCtaBtn, { backgroundColor: '#364536' }]}
            >
              <Ionicons
                name={tab === 'Liked' ? 'people-outline' : 'sparkles-outline'}
                size={15}
                color="#F3F1EF"
              />
              <Text style={styles.emptyCtaText}>
                {tab === 'Liked' ? 'Explore Community' : 'Open Outfit Studio'}
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* ================= 1. ACCOUNT SETTINGS BOTTOM SHEET ================= */}
      <Modal statusBarTranslucent={true}
        visible={settingsVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSettingsVisible(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setSettingsVisible(false)}
        >
          <Pressable
            style={[
              styles.settingsSheet,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.dragHandle, { backgroundColor: theme.border }]} />

            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: theme.text }]}>
                Account Settings
              </Text>
              <Pressable onPress={() => setSettingsVisible(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color={theme.textMuted} />
              </Pressable>
            </View>

            {/* Row 1: Appearance (Light / Dark Mode Toggle) */}
            <View style={[styles.settingRow, { borderBottomColor: theme.border }]}>
              <Ionicons
                name={themePreference === 'dark' ? 'moon-outline' : 'sunny-outline'}
                size={20}
                color={isDark ? '#F3F1EF' : '#364536'}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingLabel, { color: theme.text }]}>
                  Appearance
                </Text>
                <Text style={[styles.settingSub, { color: theme.textMuted }]}>
                  Switch between Light & Dark mode
                </Text>
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  backgroundColor: theme.surfaceSecondary,
                  borderRadius: 999,
                  padding: 3,
                  borderWidth: 1,
                  borderColor: theme.border,
                }}
              >
                {(['light', 'dark'] as const).map((mode) => {
                  const active = themePreference === mode;
                  return (
                    <Pressable
                      key={mode}
                      onPress={() => setThemePreference(mode)}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 5,
                        borderRadius: 999,
                        backgroundColor: active ? '#364536' : 'transparent',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: '700',
                          color: active ? '#F3F1EF' : theme.textMuted,
                        }}
                      >
                        {mode === 'light' ? 'Light' : 'Dark'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Standard Nav Rows */}
            {[
              ['Edit Profile & Data', 'person-outline', 'EditProfile'],
              ['Notification Preferences', 'notifications-outline', 'Settings'],
              ['Help & Support', 'help-circle-outline', 'Help'],
            ].map(([label, icon, route]) => (
              <Pressable
                key={label}
                onPress={() => {
                  setSettingsVisible(false);
                  navigation.navigate(route);
                }}
                style={[styles.settingRow, { borderBottomColor: theme.border }]}
              >
                <Ionicons
                  name={icon as any}
                  size={20}
                  color={isDark ? '#F3F1EF' : '#364536'}
                />
                <Text style={[styles.settingLabel, { color: theme.text, flex: 1 }]}>
                  {label}
                </Text>
                <Ionicons name="chevron-forward" size={17} color={theme.textMuted} />
              </Pressable>
            ))}

            {/* SWITCH ACCOUNT */}
            <Pressable
              onPress={openSwitchAccountsModal}
              style={[styles.settingRow, { borderBottomColor: theme.border }]}
            >
              <Ionicons
                name="swap-horizontal-outline"
                size={20}
                color={isDark ? '#F3F1EF' : '#364536'}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingLabel, { color: theme.text }]}>
                  Switch Account
                </Text>
                <Text style={[styles.settingSub, { color: theme.textMuted }]}>
                  Manage multiple profiles & switch with 1-tap
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={17} color={theme.textMuted} />
            </Pressable>

            {/* LOG OUT */}
            <Pressable
              onPress={() => {
                setSettingsVisible(false);
                setTimeout(() => setLogoutConfirmVisible(true), 180);
              }}
              style={[styles.settingRow, { borderBottomColor: theme.border }]}
            >
              <Ionicons name="log-out-outline" size={20} color="#E84A42" />
              <Text style={[styles.settingLabel, { color: '#E84A42' }]}>
                Log Out
              </Text>
            </Pressable>

            {/* ABOUT STYLESENSE & DEVELOPER FOOTER */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 14, paddingHorizontal: 4 }}>
              <Image
                source={require('../../assets/icon.png')}
                style={{ width: 34, height: 34 }}
                resizeMode="contain"
              />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12.5, fontWeight: '800', color: theme.text }}>
                  StyleSense
                </Text>
                <Text style={{ fontSize: 11, fontWeight: '600', color: theme.textMuted }}>
                  Developed by Shiloh Dynasty
                </Text>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ================= 2. SWITCH ACCOUNT MODAL ================= */}
      <Modal statusBarTranslucent={true}
        visible={switchModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSwitchModalVisible(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setSwitchModalVisible(false)}
        >
          <Pressable
            style={[
              styles.settingsSheet,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.dragHandle, { backgroundColor: theme.border }]} />

            <View style={styles.sheetHeader}>
              <View>
                <Text style={[styles.sheetTitle, { color: theme.text }]}>
                  Manage Accounts
                </Text>
                <Text style={[styles.sheetSubtitle, { color: theme.textMuted }]}>
                  Switch between accounts saved on this device
                </Text>
              </View>
              <Pressable onPress={() => setSwitchModalVisible(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color={theme.textMuted} />
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}>
              <View style={{ gap: 10, marginVertical: 12 }}>
                {savedAccounts.map((acc) => {
                  const isActive =
                    acc.email.toLowerCase() === (profile.email || '').toLowerCase() ||
                    acc.displayName.toLowerCase() === (profile.displayName || '').toLowerCase();

                  const activeRowBg = isDark
                    ? 'rgba(54, 69, 54, 0.45)'
                    : '#EBF0EB';
                  const activeRowBorder = isDark ? '#8AB896' : '#364536';

                  return (
                    <View
                      key={acc.id}
                      style={[
                        styles.accountRow,
                        {
                          borderColor: isActive ? activeRowBorder : theme.border,
                          backgroundColor: isActive ? activeRowBg : theme.surfaceSecondary,
                        },
                      ]}
                    >
                      <View style={[styles.accountAvatar, { backgroundColor: '#364536' }]}>
                        {acc.avatarUri ? (
                          <Image
                            source={{ uri: acc.avatarUri }}
                            style={styles.avatarImage}
                          />
                        ) : (
                          <Text style={styles.accountInitial}>
                            {acc.displayName.charAt(0).toUpperCase()}
                          </Text>
                        )}
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.accountName,
                            { color: isDark ? '#F3F1EF' : '#18181B' },
                          ]}
                        >
                          {acc.displayName}
                        </Text>
                        <Text
                          style={[
                            styles.accountEmail,
                            { color: isDark ? 'rgba(243, 241, 239, 0.75)' : '#52525B' },
                          ]}
                        >
                          {acc.email || 'No email attached'}
                        </Text>
                      </View>

                      {isActive ? (
                        <View style={styles.activeAccountBadge}>
                          <Ionicons
                            name="checkmark-circle"
                            size={15}
                            color="#F3F1EF"
                          />
                          <Text style={styles.activeAccountText}>Active</Text>
                        </View>
                      ) : (
                        <Pressable
                          onPress={() => handleSwitchAccount(acc)}
                          style={styles.switchBtn}
                        >
                          <Text style={styles.switchBtnText}>Switch</Text>
                        </Pressable>
                      )}
                    </View>
                  );
                })}
              </View>
            </ScrollView>

            {!addAccountConfirm ? (
              <Pressable
                onPress={() => setAddAccountConfirm(true)}
                style={[
                  styles.addAccountBtn,
                  {
                    backgroundColor: isDark
                      ? 'rgba(54, 69, 54, 0.38)'
                      : '#EBF0EB',
                    borderColor: isDark
                      ? 'rgba(243, 241, 239, 0.22)'
                      : 'rgba(54, 69, 54, 0.25)',
                  },
                ]}
              >
                <Ionicons
                  name="add-circle-outline"
                  size={20}
                  color={isDark ? '#F3F1EF' : '#364536'}
                />
                <Text
                  style={[
                    styles.addAccountBtnText,
                    { color: isDark ? '#F3F1EF' : '#364536' },
                  ]}
                >
                  Add Another Account
                </Text>
              </Pressable>
            ) : (
              <View style={styles.confirmBox}>
                <Text style={[styles.confirmQuestion, { color: theme.text }]}>
                  Sign in with another account? Your current profile remains saved on this device.
                </Text>
                <View style={styles.confirmBtnRow}>
                  <Pressable
                    onPress={() => setAddAccountConfirm(false)}
                    style={[styles.confirmSecondaryBtn, { borderColor: theme.border }]}
                  >
                    <Text style={[styles.confirmSecondaryText, { color: theme.text }]}>
                      Cancel
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={handleAddAnotherAccount}
                    style={[styles.confirmDestructiveBtn, { backgroundColor: '#364536' }]}
                  >
                    <Text style={styles.confirmDestructiveText}>Continue to Login</Text>
                  </Pressable>
                </View>
              </View>
            )}

            <Pressable
              onPress={() => setSwitchModalVisible(false)}
              style={[
                styles.cancelBtn,
                {
                  borderColor: theme.border,
                  backgroundColor: theme.surfaceSecondary,
                  marginTop: 12,
                },
              ]}
            >
              <Text style={[styles.cancelBtnText, { color: theme.text }]}>
                Close
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ================= 3. MANAGE PUBLISHED POST BOTTOM SHEET ================= */}
      <Modal statusBarTranslucent={true}
        visible={manageModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setManageModalVisible(false);
          setDeleteConfirmStep(false);
        }}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => {
            setManageModalVisible(false);
            setDeleteConfirmStep(false);
          }}
        >
          <Pressable
            style={[
              styles.settingsSheet,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.dragHandle, { backgroundColor: theme.border }]} />

            <View style={styles.sheetHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sheetTitle, { color: theme.text }]}>
                  {selectedPost?.name || 'Manage Post'}
                </Text>
                <Text style={[styles.sheetSubtitle, { color: theme.textMuted }]}>
                  Published {formatRelativeTime(selectedPost?.created_at)}
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  setManageModalVisible(false);
                  setDeleteConfirmStep(false);
                }}
              >
                <Ionicons name="close" size={22} color={theme.textMuted} />
              </Pressable>
            </View>

            {!deleteConfirmStep ? (
              <View style={{ marginVertical: 8 }}>
                <Pressable
                  onPress={handleHideArchive}
                  style={[styles.sheetActionRow, { borderBottomColor: theme.border }]}
                >
                  <View style={[styles.actionIconWrap, { backgroundColor: '#364536' }]}>
                    <Ionicons name="eye-off-outline" size={20} color="#F3F1EF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sheetActionText, { color: theme.text }]}>
                      Hide / Archive Post
                    </Text>
                    <Text style={[styles.sheetActionSub, { color: theme.textMuted }]}>
                      Keep in your wardrobe, hide from public community feed
                    </Text>
                  </View>
                </Pressable>

                <Pressable
                  onPress={() => setDeleteConfirmStep(true)}
                  style={[styles.sheetActionRow, { borderBottomColor: theme.border }]}
                >
                  <View
                    style={[
                      styles.actionIconWrap,
                      { backgroundColor: 'rgba(232, 74, 66, 0.14)' },
                    ]}
                  >
                    <Ionicons name="trash-outline" size={20} color="#E84A42" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sheetActionText, { color: '#E84A42' }]}>
                      Delete Post
                    </Text>
                    <Text style={[styles.sheetActionSub, { color: theme.textMuted }]}>
                      Permanently remove this outfit from the feed
                    </Text>
                  </View>
                </Pressable>
              </View>
            ) : (
              <View style={styles.confirmBox}>
                <Text style={[styles.confirmQuestion, { color: theme.text }]}>
                  Are you sure you want to delete this post? This action cannot be undone.
                </Text>
                <View style={styles.confirmBtnRow}>
                  <Pressable
                    onPress={() => setDeleteConfirmStep(false)}
                    style={[styles.confirmSecondaryBtn, { borderColor: theme.border }]}
                  >
                    <Text style={[styles.confirmSecondaryText, { color: theme.text }]}>
                      Back
                    </Text>
                  </Pressable>

                  <Pressable
                    disabled={deletingPost}
                    onPress={handleConfirmDelete}
                    style={[styles.confirmDestructiveBtn, deletingPost && { opacity: 0.7 }]}
                  >
                    {deletingPost ? (
                      <ActivityIndicator size="small" color="#F3F1EF" />
                    ) : (
                      <Text style={styles.confirmDestructiveText}>Confirm Delete</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            )}

            <Pressable
              onPress={() => {
                setManageModalVisible(false);
                setDeleteConfirmStep(false);
              }}
              style={[styles.cancelBtn, { borderColor: theme.border, marginTop: 10 }]}
            >
              <Text style={[styles.cancelBtnText, { color: theme.text }]}>
                Cancel
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      
      {/* ================= 5. CHANGE PROFILE PICTURE MODAL ================= */}
      <Modal statusBarTranslucent={true}
        visible={avatarModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => !savingAvatar && setAvatarModalVisible(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => !savingAvatar && setAvatarModalVisible(false)}
        >
          <Pressable
            style={[
              styles.settingsSheet,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.dragHandle, { backgroundColor: theme.border }]} />

            <View style={styles.sheetHeader}>
              <View>
                <Text style={[styles.sheetTitle, { color: theme.text }]}>
                  Change Profile Picture
                </Text>
                <Text style={[styles.sheetSubtitle, { color: theme.textMuted }]}>
                  Choose a photo from your device or take a new one
                </Text>
              </View>
              <Pressable
                disabled={savingAvatar}
                onPress={() => setAvatarModalVisible(false)}
                hitSlop={8}
              >
                <Ionicons name="close" size={22} color={theme.textMuted} />
              </Pressable>
            </View>

            {/* Circular / Rounded Square Live Preview */}
            <View style={styles.avatarPreviewContainer}>
              <View
                style={[
                  styles.avatarPreviewFrame,
                  { backgroundColor: '#364536', borderColor: theme.border },
                ]}
              >
                {pendingAvatarUri ? (
                  <Image
                    source={{ uri: pendingAvatarUri }}
                    style={styles.avatarImage}
                    contentFit="cover"
                  />
                ) : (
                  <Text style={styles.avatarPreviewInitial}>{initial}</Text>
                )}
              </View>
            </View>

            {/* Image Source Picker Buttons */}
            <View style={styles.avatarSourceRow}>
              <Pressable
                disabled={savingAvatar}
                onPress={() => handlePickAvatar(false)}
                style={[
                  styles.avatarSourceBtn,
                  { backgroundColor: theme.surfaceSecondary, borderColor: theme.border },
                ]}
              >
                <Ionicons name="images-outline" size={18} color={theme.text} />
                <Text style={[styles.avatarSourceBtnText, { color: theme.text }]}>
                  Choose Photo
                </Text>
              </Pressable>

              <Pressable
                disabled={savingAvatar}
                onPress={() => handlePickAvatar(true)}
                style={[
                  styles.avatarSourceBtn,
                  { backgroundColor: theme.surfaceSecondary, borderColor: theme.border },
                ]}
              >
                <Ionicons name="camera-outline" size={18} color={theme.text} />
                <Text style={[styles.avatarSourceBtnText, { color: theme.text }]}>
                  Take Photo
                </Text>
              </Pressable>
            </View>

            {pendingAvatarUri && (
              <Pressable
                disabled={savingAvatar}
                onPress={() => setRemoveAvatarConfirmVisible(true)}
                style={styles.removeAvatarBtn}
              >
                <Ionicons name="trash-outline" size={15} color="#E84A42" />
                <Text style={styles.removeAvatarText}>Remove Current Photo</Text>
              </Pressable>
            )}

            {/* Confirm / Cancel Action Row */}
            <View style={styles.avatarConfirmRow}>
              <Pressable
                disabled={savingAvatar}
                onPress={() => setAvatarModalVisible(false)}
                style={[
                  styles.confirmSecondaryBtn,
                  { borderColor: theme.border, backgroundColor: theme.surfaceSecondary },
                ]}
              >
                <Text style={[styles.confirmSecondaryText, { color: theme.text }]}>
                  Cancel
                </Text>
              </Pressable>

              <Pressable
                disabled={savingAvatar}
                onPress={handleConfirmAvatar}
                style={[
                  styles.confirmDestructiveBtn,
                  { backgroundColor: '#364536', opacity: savingAvatar ? 0.7 : 1 },
                ]}
              >
                {savingAvatar ? (
                  <ActivityIndicator size="small" color="#F3F1EF" />
                ) : (
                  <Text style={styles.confirmDestructiveText}>Save Photo</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ================= 4. SOCIAL FOLLOWERS / FOLLOWING / LIKES MODAL ================= */}
      <SocialListModal
        visible={socialModalVisible}
        initialTab={socialModalTab}
        onClose={() => setSocialModalVisible(false)}
        onFollowCountChange={(fCount, flwCount) => {
          setFollowingCount(fCount);
          setFollowersCount(flwCount);
        }}
      />

      {/* ================= 6. LOGOUT CONFIRMATION DIALOG ================= */}
      <ConfirmDialogModal
        visible={logoutConfirmVisible}
        variant="danger"
        icon="log-out-outline"
        title="Log out?"
        message="Are you sure you want to log out of your account?"
        confirmText="Log Out"
        cancelText="Cancel"
        loading={isLoggingOut}
        onConfirm={handleConfirmLogout}
        onCancel={() => setLogoutConfirmVisible(false)}
      />

      {/* ================= 7. REMOVE SAVED OUTFIT CONFIRMATION DIALOG ================= */}
      <ConfirmDialogModal
        visible={!!removeSavedTarget}
        variant="danger"
        title="Remove saved outfit?"
        message={
          removeSavedTarget
            ? `Are you sure you want to remove "${removeSavedTarget.name}" from your saved looks?`
            : 'Are you sure you want to remove this outfit from your saved looks?'
        }
        confirmText="Remove"
        cancelText="Cancel"
        onConfirm={handleConfirmRemoveSavedOutfit}
        onCancel={() => setRemoveSavedTarget(null)}
      />

      {/* ================= 8. REMOVE PROFILE PHOTO CONFIRMATION DIALOG ================= */}
      <ConfirmDialogModal
        visible={removeAvatarConfirmVisible}
        variant="danger"
        title="Remove profile photo?"
        message="Are you sure you want to remove your current profile picture? Tap Save Photo afterward to apply."
        confirmText="Remove Photo"
        cancelText="Cancel"
        onConfirm={() => {
          setPendingAvatarUri(null);
          setRemoveAvatarConfirmVisible(false);
        }}
        onCancel={() => setRemoveAvatarConfirmVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 24,
    paddingBottom: 36,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
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
  screenTitle: {
    fontSize: 23,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginTop: 2,
  },
  topRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 38,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  editPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  gear: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    gap: 14,
  },

  avatarOuterWrap: {
    position: 'relative',
    width: 68,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCameraBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPreviewContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
  },
  avatarPreviewFrame: {
    width: 112,
    height: 112,
    borderRadius: 34,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarPreviewInitial: {
    color: '#F3F1EF',
    fontSize: 42,
    fontWeight: '800',
  },
  avatarSourceRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  avatarSourceBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  avatarSourceBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  removeAvatarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    marginBottom: 4,
  },
  removeAvatarText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#E84A42',
  },
  avatarConfirmRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  initial: {
    color: '#F3F1EF',
    fontSize: 26,
    fontWeight: '800',
  },
  identityInfo: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  handle: {
    fontSize: 12.5,
    fontWeight: '500',
  },
  metaBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 5,
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  metaBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 12,
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statDivider: {
    width: 1,
    height: 26,
  },
  statValue: {
    fontSize: 17,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 11,
    marginTop: 1,
    fontWeight: '600',
  },
  tabs: {
    flexDirection: 'row',
    width: '100%',
    borderBottomWidth: 1,
    marginTop: 16,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    position: 'relative',
  },
  tabTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  tabText: {
    fontSize: 13.5,
    fontWeight: '800',
  },
  tabCountText: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  activeTabIndicator: {
    position: 'absolute',
    bottom: -1,
    left: 16,
    right: 16,
    height: 2.5,
    borderRadius: 2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  gridCard: {
    width: '48.2%',
    borderWidth: 1,
    borderRadius: 16,
    padding: 10,
    position: 'relative',
    marginBottom: 12,
  },
  gridMannequin: {
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridKicker: {
    fontSize: 9,
    fontWeight: '800',
    marginTop: 8,
    letterSpacing: 0.8,
  },
  gridTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 4,
  },
  gridMeta: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '600',
  },
  gridMenu: {
    position: 'absolute',
    right: 8,
    top: 8,
    borderRadius: 10,
    padding: 4,
  },
  emptyStateCard: {
    marginTop: 18,
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },
  emptyIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 12.5,
    lineHeight: 18,
    textAlign: 'center',
    maxWidth: 260,
  },
  emptyCtaBtn: {
    marginTop: 6,
    height: 42,
    paddingHorizontal: 18,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  emptyCtaText: {
    color: '#F3F1EF',
    fontSize: 12.5,
    fontWeight: '800',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  settingsSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  sheetSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  settingSub: {
    fontSize: 11,
    marginTop: 2,
  },
  sheetActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  actionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetActionText: {
    fontSize: 15,
    fontWeight: '800',
  },
  sheetActionSub: {
    fontSize: 11,
    marginTop: 2,
  },
  cancelBtn: {
    height: 48,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '800',
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 12,
  },
  accountAvatar: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  accountInitial: {
    color: '#F3F1EF',
    fontWeight: '800',
    fontSize: 16,
  },
  accountName: {
    fontSize: 14.5,
    fontWeight: '800',
  },
  accountEmail: {
    fontSize: 11.5,
    marginTop: 2,
    fontWeight: '500',
  },
  activeAccountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#364536',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
  },
  activeAccountText: {
    color: '#F3F1EF',
    fontSize: 11,
    fontWeight: '800',
  },
  switchBtn: {
    backgroundColor: '#364536',
    paddingHorizontal: 13,
    paddingVertical: 6.5,
    borderRadius: 999,
  },
  switchBtnText: {
    color: '#F3F1EF',
    fontSize: 12,
    fontWeight: '800',
  },
  addAccountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginVertical: 8,
  },
  addAccountBtnText: {
    fontSize: 14,
    fontWeight: '800',
  },
  confirmBox: {
    paddingVertical: 12,
    gap: 12,
  },
  confirmQuestion: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
  },
  confirmBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  confirmSecondaryBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmSecondaryText: {
    fontSize: 13,
    fontWeight: '800',
  },
  confirmDestructiveBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#E84A42',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmDestructiveText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#F3F1EF',
  },
});
