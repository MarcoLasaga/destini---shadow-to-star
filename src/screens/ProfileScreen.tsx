import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import { useAppTheme } from '../hooks/useAppTheme';
import { useProfile } from '../contexts/ProfileContext';
import { useCommunity } from '../contexts/CommunityContext';
import { useOutfit } from '../contexts/OutfitContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useSettings } from '../contexts/SettingsContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AltaOutfitCollage from '../components/AltaOutfitCollage';
import SocialListModal from '../components/SocialListModal';
import {
  CommunityOutfit,
  isCurrentUserPost,
} from '../services/communityService';
import { OutfitClothingItem } from '../types';
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
  const { profile, updateProfile } = useProfile();
  const community = useCommunity();
  const { savedOutfits } = useOutfit();
  const { logout, session } = useAuth();
  const { showToast } = useToast();
  const { themePreference, setThemePreference } = useSettings();

  const [settingsVisible, setSettingsVisible] = useState(false);
  const [socialModalVisible, setSocialModalVisible] = useState(false);
  const [socialModalTab, setSocialModalTab] = useState<'followers' | 'following' | 'likes'>('followers');
  const [followingCount, setFollowingCount] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);
  const [tab, setTab] = useState<'Published' | 'Liked' | 'Saved'>('Published');
  const [myPostIds, setMyPostIds] = useState<string[]>([]);

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

  // Synchronize current profile into saved accounts
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
    if (!selectedPost) return;
    try {
      await community.deletePost(selectedPost.id);
      showToast('Post deleted.');
    } catch {
      showToast('Unable to delete post.');
    } finally {
      setManageModalVisible(false);
      setDeleteConfirmStep(false);
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Top Bar */}
        <View style={styles.topBar}>
          <View style={styles.kickerRow}>
            <View style={styles.kickerDot} />
            <Text style={[styles.kicker, { color: isDark ? '#F3F1EF' : '#364536' }]}>
              YOUR STYLE SPACE
            </Text>
          </View>
          <Pressable
            onPress={() => setSettingsVisible(true)}
            style={[
              styles.gear,
              {
                backgroundColor: theme.surfaceSecondary,
                borderColor: theme.border,
                borderWidth: 1,
              },
            ]}
          >
            <Ionicons name="settings-outline" size={20} color={theme.text} />
          </Pressable>
        </View>

        {/* Profile Card */}
        <View style={[styles.profileCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={[styles.avatar, { backgroundColor: '#364536' }]}>
            {profile.avatarUri ? (
              <Image source={{ uri: profile.avatarUri }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.initial}>{initial}</Text>
            )}
          </View>
          <Text style={[styles.name, { color: theme.text }]}>
            {profile.displayName || 'Style Member'}
          </Text>
          <Text style={[styles.handle, { color: theme.textMuted }]}>
            {profile.email || '@stylesense_member'}
          </Text>

          {/* Followers / Following / Likes Stats */}
          <View style={styles.stats}>
            <Pressable
              onPress={() => {
                setSocialModalTab('followers');
                setSocialModalVisible(true);
              }}
              style={[styles.stat, { backgroundColor: theme.surfaceSecondary }]}
              accessibilityLabel="View followers"
            >
              <Text style={[styles.statValue, { color: theme.text }]}>{followersCount}</Text>
              <Text style={[styles.statLabel, { color: theme.textMuted }]}>Followers</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                setSocialModalTab('following');
                setSocialModalVisible(true);
              }}
              style={[styles.stat, { backgroundColor: theme.surfaceSecondary }]}
              accessibilityLabel="View following creators"
            >
              <Text style={[styles.statValue, { color: theme.text }]}>{followingCount}</Text>
              <Text style={[styles.statLabel, { color: theme.textMuted }]}>Following</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                setSocialModalTab('likes');
                setSocialModalVisible(true);
              }}
              style={[styles.stat, { backgroundColor: theme.surfaceSecondary }]}
              accessibilityLabel="View post likes"
            >
              <Text style={[styles.statValue, { color: theme.text }]}>{likesCount}</Text>
              <Text style={[styles.statLabel, { color: theme.textMuted }]}>Likes</Text>
            </Pressable>
          </View>
        </View>

        {/* 3-Column Tab Bar Evenly Flexed Across Full Screen */}
        <View style={[styles.tabs, { borderBottomColor: theme.border }]}>
          {(['Published', 'Liked', 'Saved'] as const).map((value) => {
            const isActive = tab === value;
            return (
              <Pressable
                key={value}
                onPress={() => setTab(value)}
                style={styles.tab}
              >
                <Text
                  style={[
                    styles.tabText,
                    { color: isActive ? theme.text : theme.textMuted },
                  ]}
                >
                  {value}
                </Text>
                {isActive && (
                  <View style={[styles.activeTabIndicator, { backgroundColor: '#E83E35' }]} />
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Grid Content */}
        {tab === 'Saved' ? (
          <View style={styles.grid}>
            {savedOutfits.map((outfit) => (
              <View
                key={outfit.id}
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
                <Text style={[styles.gridKicker, { color: isDark ? '#F3F1EF' : '#364536' }]}>
                  SAVED LOOK
                </Text>
                <Text style={[styles.gridTitle, { color: theme.text }]} numberOfLines={2}>
                  {outfit.name}
                </Text>
                <Text style={[styles.gridMeta, { color: theme.textMuted }]}>
                  {outfit.occasionLabel}
                </Text>
              </View>
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

                  <Text style={[styles.gridTitle, { color: theme.text }]} numberOfLines={2}>
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
                        size={18}
                        color={theme.textMuted}
                      />
                    </Pressable>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Empty State */}
        {((tab !== 'Saved' && posts.length === 0) ||
          (tab === 'Saved' && savedOutfits.length === 0)) && (
          <Text style={[styles.empty, { color: theme.textMuted }]}>
            Nothing here yet. Your next look can live here.
          </Text>
        )}
      </ScrollView>

      {/* ================= 1. ACCOUNT SETTINGS BOTTOM SHEET (Destructive Actions moved to EditProfile & Help per PDF Page 15) ================= */}
      <Modal
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

            {/* ACTION 1: SWITCH ACCOUNT (Fast Account Manager) */}
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

            {/* ACTION 2: LOG OUT */}
            <Pressable
              onPress={() => {
                setSettingsVisible(false);
                logout();
              }}
              style={[styles.settingRow, { borderBottomWidth: 0 }]}
            >
              <Ionicons name="log-out-outline" size={20} color="#E83E35" />
              <Text style={[styles.settingLabel, { color: '#E83E35' }]}>
                Log Out
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ================= 2. SWITCH ACCOUNT MODAL (Fixed Dark Mode Visibility per PDF Page 16) ================= */}
      <Modal
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

            {/* List of Saved Accounts */}
            <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}>
              <View style={{ gap: 10, marginVertical: 12 }}>
                {savedAccounts.map((acc) => {
                  const isActive =
                    acc.email.toLowerCase() === (profile.email || '').toLowerCase() ||
                    acc.displayName.toLowerCase() === (profile.displayName || '').toLowerCase();

                  const activeRowBg = isDark
                    ? 'rgba(54, 69, 54, 0.45)'
                    : '#EBF0EB';
                  const activeRowBorder = isDark ? '#E83E35' : '#364536';

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

            {/* Add Another Account Option */}
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
                  + Add Another Account
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
      <Modal
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
                {/* ACTION ROW 1: HIDE / ARCHIVE */}
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

                {/* ACTION ROW 2: DELETE POST */}
                <Pressable
                  onPress={() => setDeleteConfirmStep(true)}
                  style={[styles.sheetActionRow, { borderBottomColor: theme.border }]}
                >
                  <View
                    style={[
                      styles.actionIconWrap,
                      { backgroundColor: 'rgba(232, 62, 53, 0.14)' },
                    ]}
                  >
                    <Ionicons name="trash-outline" size={20} color="#E83E35" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sheetActionText, { color: '#E83E35' }]}>
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
                    onPress={handleConfirmDelete}
                    style={styles.confirmDestructiveBtn}
                  >
                    <Text style={styles.confirmDestructiveText}>Confirm Delete</Text>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
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
    backgroundColor: '#E83E35',
  },
  kicker: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  gear: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileCard: {
    borderWidth: 1,
    borderRadius: 22,
    alignItems: 'center',
    padding: 20,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 26,
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
    fontSize: 32,
    fontWeight: '900',
  },
  name: {
    fontSize: 22,
    fontWeight: '900',
    marginTop: 10,
  },
  handle: {
    fontSize: 13,
    marginTop: 2,
  },
  stats: {
    flexDirection: 'row',
    marginTop: 18,
    gap: 12,
    width: '100%',
  },
  stat: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '900',
  },
  statLabel: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '700',
  },
  tabs: {
    flexDirection: 'row',
    width: '100%',
    borderBottomWidth: 1,
    marginTop: 20,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    position: 'relative',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '800',
  },
  activeTabIndicator: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    right: 0,
    height: 3,
    borderRadius: 2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  gridCard: {
    width: '48%',
    minHeight: 260,
    borderWidth: 1,
    borderRadius: 16,
    padding: 10,
    position: 'relative',
    marginBottom: 12,
  },
  gridMannequin: {
    height: 195,
    paddingVertical: 8,
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridKicker: {
    fontSize: 9,
    fontWeight: '900',
    marginTop: 8,
    letterSpacing: 0.8,
  },
  gridTitle: {
    fontSize: 13,
    fontWeight: '900',
    marginTop: 4,
  },
  gridMeta: {
    fontSize: 11,
    marginTop: 3,
    fontWeight: '600',
  },
  gridMenu: {
    position: 'absolute',
    right: 8,
    top: 8,
    borderRadius: 10,
    padding: 4,
  },
  empty: {
    textAlign: 'center',
    paddingTop: 44,
    fontSize: 13,
    lineHeight: 18,
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
    fontWeight: '900',
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
    fontWeight: '800',
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
    fontWeight: '900',
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
    backgroundColor: '#E83E35',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmDestructiveText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#F3F1EF',
  },
});
