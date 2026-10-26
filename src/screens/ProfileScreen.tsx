import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../integrations/supabase/client';
import Mannequin2D from '../components/Mannequin2D';
import CharacterCustomizeModal from '../components/CharacterCustomizeModal';
import SocialListModal from '../components/SocialListModal';
import {
  CommunityOutfit,
  isCurrentUserPost,
  syncCreatorNickname,
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
  const navigation = useNavigation<any>();
  const { profile, updateProfile } = useProfile();
  const community = useCommunity();
  const { savedOutfits } = useOutfit();
  const { logout, session } = useAuth();
  const { showToast } = useToast();

  const [settingsVisible, setSettingsVisible] = useState(false);
  const [characterModalVisible, setCharacterModalVisible] = useState(false);
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

  const [deleteAllPostsModalVisible, setDeleteAllPostsModalVisible] = useState(false);
  const [terminateAccountModalVisible, setTerminateAccountModalVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteAllMyPosts = () => {
    setDeleteAllPostsModalVisible(true);
  };

  const handleTerminateAccount = () => {
    setTerminateAccountModalVisible(true);
  };

  const executeDeleteAllMyPosts = async () => {
    setIsDeleting(true);
    try {
      const currentUserId = session?.user?.id;
      const currentEmail = session?.user?.email || profile.email;
      const currentName = profile.displayName;

      const anyClient = supabase as any;
      if (currentUserId) {
        try { await anyClient.from('shared_outfits').delete().eq('user_id', currentUserId); } catch {}
        try { await anyClient.from('community_posts').delete().eq('user_id', currentUserId); } catch {}
      }
      const orConditions: string[] = ['author_name.eq.Jdyy', 'author_name.eq.Jdyyy1'];
      if (currentName) orConditions.push(`author_name.eq.${currentName}`);
      if (currentEmail) orConditions.push(`author_email.eq.${currentEmail}`);

      try { await anyClient.from('shared_outfits').delete().or(orConditions.join(',')); } catch {}
      try { await anyClient.from('community_posts').delete().or(orConditions.join(',')); } catch {}

      await AsyncStorage.removeItem('@stylesense_my_post_ids');
      await AsyncStorage.removeItem('@stylesense_published_posts');
      setMyPostIds([]);
      await community.refresh();
      showToast('🗑️ All your published & legacy posts have been purged.');
      setDeleteAllPostsModalVisible(false);
      setSettingsVisible(false);
    } catch (err) {
      console.error('Failed to purge user posts:', err);
      await AsyncStorage.removeItem('@stylesense_my_post_ids');
      await AsyncStorage.removeItem('@stylesense_published_posts');
      setMyPostIds([]);
      await community.refresh();
      showToast('Purged local published posts.');
      setDeleteAllPostsModalVisible(false);
      setSettingsVisible(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const executeTerminateAccount = async () => {
    setIsDeleting(true);
    try {
      const currentUserId = session?.user?.id;
      const currentEmail = session?.user?.email || profile.email;
      const currentName = profile.displayName;

      const anyClient = supabase as any;
      // 1. Delete all Supabase cloud database records
      if (currentUserId) {
        try { await anyClient.from('wardrobe_items').delete().eq('user_id', currentUserId); } catch {}
        try { await anyClient.from('garments').delete().eq('user_id', currentUserId); } catch {}
        try { await anyClient.from('clothing_items').delete().eq('user_id', currentUserId); } catch {}
        try { await anyClient.from('saved_outfits').delete().eq('user_id', currentUserId); } catch {}
        try { await anyClient.from('outfits').delete().eq('user_id', currentUserId); } catch {}
        try { await anyClient.from('profiles').delete().eq('id', currentUserId); } catch {}
      }

      const orConditions: string[] = ['author_name.eq.Jdyy', 'author_name.eq.Jdyyy1'];
      if (currentUserId) orConditions.push(`user_id.eq.${currentUserId}`);
      if (currentEmail) orConditions.push(`author_email.eq.${currentEmail}`);
      if (currentName) orConditions.push(`author_name.eq.${currentName}`);

      try { await anyClient.from('shared_outfits').delete().or(orConditions.join(',')); } catch {}
      try { await anyClient.from('community_posts').delete().or(orConditions.join(',')); } catch {}

      // Call RPC delete_user_account if available
      try {
        await anyClient.rpc('delete_user_account');
      } catch {}

      // Call backend API if available
      try {
        const token = session?.access_token;
        if (token) {
          const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';
          await fetch(`${apiUrl}/api/users/me`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          }).catch(() => {});
        }
      } catch {}

      // 2. Wipe Local Device State Completely
      await AsyncStorage.clear();

      // 3. Sign Out Globally
      try {
        await supabase.auth.signOut({ scope: 'global' });
      } catch {}
      try {
        await logout();
      } catch {}

      setTerminateAccountModalVisible(false);
      setSettingsVisible(false);
      showToast('Account successfully terminated.');

      navigation.reset({
        index: 0,
        routes: [{ name: 'Onboarding' }],
      });
    } catch (err) {
      console.error('Termination error:', err);
      await AsyncStorage.clear();
      try {
        await supabase.auth.signOut({ scope: 'global' });
      } catch {}
      try {
        await logout();
      } catch {}
      setTerminateAccountModalVisible(false);
      setSettingsVisible(false);
      navigation.reset({
        index: 0,
        routes: [{ name: 'Onboarding' }],
      });
    } finally {
      setIsDeleting(false);
    }
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
          <Text style={[styles.kicker, { color: '#4D9A65' }]}>YOUR STYLE SPACE</Text>
          <Pressable onPress={() => setSettingsVisible(true)} style={styles.gear}>
            <Ionicons name="settings-outline" size={21} color="#264C3B" />
          </Pressable>
        </View>

        {/* Profile Card */}
        <View style={[styles.profileCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.avatar}>
            {profile.avatarUri ? (
              <Image source={{ uri: profile.avatarUri }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.initial}>{initial}</Text>
            )}
          </View>
          <Text style={[styles.name, { color: theme.text }]}>{profile.displayName || 'Style Member'}</Text>
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
              style={styles.stat}
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
              style={styles.stat}
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
              style={styles.stat}
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
                    { color: isActive ? '#264C3B' : theme.textMuted },
                  ]}
                >
                  {value}
                </Text>
                {isActive && (
                  <View style={[styles.activeTabIndicator, { backgroundColor: '#4D9A65' }]} />
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
                <View
                  style={[
                    styles.gridMannequin,
                    { backgroundColor: theme.mode === 'dark' ? '#231B2C' : '#FAF7F0' },
                  ]}
                >
                  <Mannequin2D
                    items={outfit.clothingItems}
                    compact
                    staticPreview
                    occasionScene={outfit.occasionLabel}
                  />
                </View>
                <Text style={[styles.gridKicker, { color: '#4D9A65' }]}>SAVED LOOK</Text>
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
              const mannequinItems: OutfitClothingItem[] = post.items.map((item) => ({
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
                  <View
                    style={[
                      styles.gridMannequin,
                      { backgroundColor: theme.mode === 'dark' ? '#231B2C' : '#FAF7F0' },
                    ]}
                  >
                    <Mannequin2D
                      items={mannequinItems}
                      compact
                      staticPreview
                      occasionScene={post.occasion || post.style}
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
                      style={styles.gridMenu}
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

      {/* ================= 1. ACCOUNT SETTINGS BOTTOM SHEET ================= */}
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
            <View style={styles.dragHandle} />

            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: theme.text }]}>
                Account Settings
              </Text>
              <Pressable onPress={() => setSettingsVisible(false)}>
                <Ionicons name="close" size={22} color={theme.textMuted} />
              </Pressable>
            </View>

            {/* Row 1: Appearance / Edit Character */}
            <Pressable
              onPress={() => {
                setSettingsVisible(false);
                setCharacterModalVisible(true);
              }}
              style={styles.settingRow}
            >
              <Ionicons name="color-palette-outline" size={20} color="#4D9A65" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingLabel, { color: theme.text }]}>
                  Appearance / Edit Character
                </Text>
                <Text style={[styles.settingSub, { color: theme.textMuted }]}>
                  Personalize hair style, color, skin tone & face expression
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={17} color={theme.textMuted} />
            </Pressable>

            {/* Standard Nav Rows */}
            {[
              ['Edit Profile', 'person-outline', 'EditProfile'],
              ['Notification Preferences', 'notifications-outline', 'Settings'],
              ['Help & Support', 'help-circle-outline', 'Help'],
            ].map(([label, icon, route]) => (
              <Pressable
                key={label}
                onPress={() => {
                  setSettingsVisible(false);
                  navigation.navigate(route);
                }}
                style={styles.settingRow}
              >
                <Ionicons name={icon as any} size={20} color="#4D9A65" />
                <Text style={[styles.settingLabel, { color: theme.text }]}>
                  {label}
                </Text>
                <Ionicons name="chevron-forward" size={17} color={theme.textMuted} />
              </Pressable>
            ))}

            {/* ACTION 1: SWITCH ACCOUNT (Fast Account Manager) */}
            <Pressable onPress={openSwitchAccountsModal} style={styles.settingRow}>
              <Ionicons name="swap-horizontal-outline" size={20} color="#2563EB" />
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

            {/* ACTION 2: LOG OUT (Distinct Red Action) */}
            <Pressable
              onPress={() => {
                setSettingsVisible(false);
                logout();
              }}
              style={styles.settingRow}
            >
              <Ionicons name="log-out-outline" size={20} color="#DC2626" />
              <Text style={[styles.settingLabel, { color: '#DC2626' }]}>
                Log Out
              </Text>
            </Pressable>

            {/* DESTRUCTIVE ACTIONS SECTION */}
            <View style={styles.destructiveSection}>
              <Text style={styles.destructiveHeader}>DESTRUCTIVE ACTIONS</Text>

              {/* Action 1: Delete All My Published & Legacy Posts */}
              <Pressable
                onPress={handleDeleteAllMyPosts}
                style={[styles.settingRow, styles.destructiveRow]}
              >
                <Ionicons name="trash-outline" size={20} color="#DC2626" />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.settingLabel, { color: '#DC2626' }]}>
                    Delete All My Published & Legacy Posts
                  </Text>
                  <Text style={[styles.settingSub, { color: theme.textMuted }]}>
                    Permanently delete all your shared and legacy community looks
                  </Text>
                </View>
              </Pressable>

              {/* Action 2: Terminate Account */}
              <Pressable
                onPress={handleTerminateAccount}
                style={[styles.settingRow, styles.destructiveRow, { borderBottomWidth: 0 }]}
              >
                <Ionicons name="alert-circle-outline" size={20} color="#B91C1C" />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.settingLabel, { color: '#B91C1C', fontWeight: '900' }]}>
                    Terminate Account
                  </Text>
                  <Text style={[styles.settingSub, { color: theme.textMuted }]}>
                    Wipe all account data, reset app preferences & return to onboarding
                  </Text>
                </View>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ================= 2. SWITCH ACCOUNT MODAL ================= */}
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
            <View style={styles.dragHandle} />

            <View style={styles.sheetHeader}>
              <View>
                <Text style={[styles.sheetTitle, { color: theme.text }]}>
                  Manage Accounts
                </Text>
                <Text style={[styles.sheetSubtitle, { color: theme.textMuted }]}>
                  Switch between accounts saved on this device
                </Text>
              </View>
              <Pressable onPress={() => setSwitchModalVisible(false)}>
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

                  return (
                    <View
                      key={acc.id}
                      style={[
                        styles.accountRow,
                        {
                          borderColor: isActive ? '#4D9A65' : theme.border,
                          backgroundColor: isActive ? '#F0F9F1' : theme.surface,
                        },
                      ]}
                    >
                      <View style={styles.accountAvatar}>
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
                        <Text style={[styles.accountName, { color: theme.text }]}>
                          {acc.displayName}
                        </Text>
                        <Text style={[styles.accountEmail, { color: theme.textMuted }]}>
                          {acc.email || 'No email attached'}
                        </Text>
                      </View>

                      {isActive ? (
                        <View style={styles.activeAccountBadge}>
                          <Ionicons
                            name="checkmark-circle"
                            size={16}
                            color="#2E7D32"
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
                style={styles.addAccountBtn}
              >
                <Ionicons name="add-circle-outline" size={20} color="#2563EB" />
                <Text style={styles.addAccountBtnText}>+ Add Another Account</Text>
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
                    style={[styles.confirmDestructiveBtn, { backgroundColor: '#2563EB' }]}
                  >
                    <Text style={styles.confirmDestructiveText}>Continue to Login</Text>
                  </Pressable>
                </View>
              </View>
            )}

            <Pressable
              onPress={() => setSwitchModalVisible(false)}
              style={[styles.cancelBtn, { borderColor: theme.border, marginTop: 12 }]}
            >
              <Text style={[styles.cancelBtnText, { color: theme.text }]}>
                Close
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ================= 3. MANAGE PUBLISHED POST BOTTOM SHEET (REPLACES ALERT.ALERT) ================= */}
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
            <View style={styles.dragHandle} />

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
                  style={styles.sheetActionRow}
                >
                  <View style={[styles.actionIconWrap, { backgroundColor: '#EAF3D9' }]}>
                    <Ionicons name="eye-off-outline" size={20} color="#264C3B" />
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

                {/* ACTION ROW 2: DELETE POST (Destructive Red) */}
                <Pressable
                  onPress={() => setDeleteConfirmStep(true)}
                  style={styles.sheetActionRow}
                >
                  <View style={[styles.actionIconWrap, { backgroundColor: '#FEE2E2' }]}>
                    <Ionicons name="trash-outline" size={20} color="#DC2626" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sheetActionText, { color: '#DC2626' }]}>
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

      {/* ================= 4. CHARACTER CUSTOMIZER MODAL ================= */}
      <CharacterCustomizeModal
        visible={characterModalVisible}
        onClose={() => setCharacterModalVisible(false)}
        initialGender={profile?.gender === 'female' ? 'female' : 'male'}
      />

      {/* ================= 5. SOCIAL FOLLOWERS / FOLLOWING / LIKES MODAL ================= */}
      <SocialListModal
        visible={socialModalVisible}
        initialTab={socialModalTab}
        onClose={() => setSocialModalVisible(false)}
        onFollowCountChange={(fCount, flwCount) => {
          setFollowingCount(fCount);
          setFollowersCount(flwCount);
        }}
      />

      {/* ================= 6. CUSTOM MODAL: DELETE ALL POSTS ================= */}
      <Modal
        visible={deleteAllPostsModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => !isDeleting && setDeleteAllPostsModalVisible(false)}
      >
        <View style={styles.confirmBackdrop}>
          <View style={styles.confirmDialogCard}>
            <View style={styles.confirmIconCircle}>
              <Ionicons name="trash-outline" size={26} color="#C93B2B" />
            </View>

            <Text style={styles.confirmDialogTitle}>Delete All Published & Legacy Posts?</Text>

            <Text style={styles.confirmDialogSubtitle}>
              This will permanently purge your shared community looks from the server and live feed.
            </Text>

            <View style={styles.bulletList}>
              <View style={styles.bulletItem}>
                <Ionicons name="close-circle-outline" size={16} color="#C93B2B" />
                <Text style={styles.bulletText}>All public looks in the Community feed will be removed</Text>
              </View>
              <View style={styles.bulletItem}>
                <Ionicons name="close-circle-outline" size={16} color="#C93B2B" />
                <Text style={styles.bulletText}>Removes posts under current account and aliases (Jdyy, Jdyyy1)</Text>
              </View>
              <View style={styles.bulletItem}>
                <Ionicons name="close-circle-outline" size={16} color="#C93B2B" />
                <Text style={styles.bulletText}>This action is permanent and cannot be undone</Text>
              </View>
            </View>

            <View style={styles.dialogBtnRow}>
              <Pressable
                disabled={isDeleting}
                onPress={() => setDeleteAllPostsModalVisible(false)}
                style={styles.dialogCancelBtn}
              >
                <Text style={styles.dialogCancelText}>Cancel</Text>
              </Pressable>

              <Pressable
                disabled={isDeleting}
                onPress={executeDeleteAllMyPosts}
                style={[styles.dialogCrimsonBtn, isDeleting && { opacity: 0.7 }]}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.dialogCrimsonText}>Delete All Posts</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ================= 7. CUSTOM MODAL: TERMINATE ACCOUNT ================= */}
      <Modal
        visible={terminateAccountModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => !isDeleting && setTerminateAccountModalVisible(false)}
      >
        <View style={styles.confirmBackdrop}>
          <View style={styles.confirmDialogCard}>
            <View style={styles.confirmIconCircle}>
              <Ionicons name="warning-outline" size={28} color="#C93B2B" />
            </View>

            <Text style={[styles.confirmDialogTitle, { color: '#991B1B' }]}>Terminate Account?</Text>

            <Text style={styles.confirmDialogSubtitle}>
              This permanently deletes all of your wardrobe items, saved outfits, published community posts, and profile data from the cloud. (If you sign in again later with Google or Facebook, it will start as a brand-new blank account).
            </Text>

            <View style={styles.bulletList}>
              <View style={styles.bulletItem}>
                <Ionicons name="trash-bin-outline" size={16} color="#C93B2B" />
                <Text style={styles.bulletText}>All uploaded clothes & cutout data permanently deleted</Text>
              </View>
              <View style={styles.bulletItem}>
                <Ionicons name="sparkles-outline" size={16} color="#C93B2B" />
                <Text style={styles.bulletText}>All saved outfits & recommendation history cleared</Text>
              </View>
              <View style={styles.bulletItem}>
                <Ionicons name="people-outline" size={16} color="#C93B2B" />
                <Text style={styles.bulletText}>Community posts & creator profile purged from cloud</Text>
              </View>
              <View style={styles.bulletItem}>
                <Ionicons name="log-out-outline" size={16} color="#C93B2B" />
                <Text style={styles.bulletText}>All local data on this device wiped; global sign out</Text>
              </View>
            </View>

            <View style={styles.dialogBtnRow}>
              <Pressable
                disabled={isDeleting}
                onPress={() => setTerminateAccountModalVisible(false)}
                style={styles.dialogCancelBtn}
              >
                <Text style={styles.dialogCancelText}>Cancel</Text>
              </Pressable>

              <Pressable
                disabled={isDeleting}
                onPress={executeTerminateAccount}
                style={[styles.dialogCrimsonBtn, isDeleting && { opacity: 0.7 }]}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.dialogCrimsonText}>Terminate Account</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  kicker: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  gear: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EAF3D9',
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
    backgroundColor: '#DCEFCF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  initial: {
    color: '#264C3B',
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
    backgroundColor: '#F2F6EA',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '900',
  },
  statLabel: {
    color: '#718078',
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
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
    backgroundColor: '#D1D5DB',
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
    borderBottomColor: '#E5EAE1',
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '800',
  },
  settingSub: {
    fontSize: 11,
    marginTop: 2,
  },
  destructiveSection: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1.5,
    borderTopColor: '#FEE2E2',
  },
  destructiveHeader: {
    fontSize: 10,
    fontWeight: '900',
    color: '#DC2626',
    letterSpacing: 1.1,
    marginBottom: 4,
  },
  destructiveRow: {
    borderBottomColor: '#FEE2E2',
  },
  sheetActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
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
    borderWidth: 1.5,
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
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#DCEFCF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  accountInitial: {
    color: '#264C3B',
    fontWeight: '900',
    fontSize: 16,
  },
  accountName: {
    fontSize: 14,
    fontWeight: '800',
  },
  accountEmail: {
    fontSize: 11,
    marginTop: 2,
  },
  activeAccountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  activeAccountText: {
    color: '#2E7D32',
    fontSize: 11,
    fontWeight: '800',
  },
  switchBtn: {
    backgroundColor: '#264C3B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  switchBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  addAccountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    marginVertical: 8,
  },
  addAccountBtnText: {
    color: '#2563EB',
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
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmDestructiveText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  confirmBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.58)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  confirmDialogCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FAF8F3',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E6E1D6',
    padding: 22,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 8,
  },
  confirmIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FDECEC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  confirmDialogTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1C1917',
    textAlign: 'center',
    marginBottom: 8,
  },
  confirmDialogSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: '#57534E',
    textAlign: 'center',
    marginBottom: 14,
  },
  bulletList: {
    width: '100%',
    gap: 8,
    marginBottom: 20,
    backgroundColor: '#F5F2EA',
    borderRadius: 14,
    padding: 12,
  },
  bulletItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bulletText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    color: '#44403C',
    fontWeight: '500',
  },
  dialogBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
  },
  dialogCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: '#EAE6DF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogCancelText: {
    color: '#44403C',
    fontSize: 13.5,
    fontWeight: '700',
  },
  dialogCrimsonBtn: {
    flex: 1.2,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: '#C93B2B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogCrimsonText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
  },
});
