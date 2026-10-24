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
import Mannequin2D from '../components/Mannequin2D';
import { CommunityOutfit } from '../services/communityService';
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
  const { logout } = useAuth();
  const { showToast } = useToast();

  const [settingsVisible, setSettingsVisible] = useState(false);
  const [tab, setTab] = useState<'Published' | 'Liked' | 'Saved'>('Published');

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

  const posts = useMemo(() => {
    if (tab === 'Published') {
      const own = (profile.displayName || '').toLowerCase();
      return community.feed.filter(
        (post) => (post.creatorName || '').toLowerCase() === own
      );
    }
    if (tab === 'Liked') {
      return community.feed.filter((post) => post.liked);
    }
    return [];
  }, [community.feed, tab, profile.displayName]);

  const initial =
    profile.displayName?.trim().charAt(0).toUpperCase() ||
    profile.firstName?.trim().charAt(0).toUpperCase() ||
    'U';
  const likesCount = community.feed.filter((post) => post.liked).length;

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

          {/* Followers / Likes Stats */}
          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: theme.text }]}>0</Text>
              <Text style={[styles.statLabel, { color: theme.textMuted }]}>Following</Text>
            </View>
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: theme.text }]}>{likesCount}</Text>
              <Text style={[styles.statLabel, { color: theme.textMuted }]}>Likes</Text>
            </View>
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
                  <Mannequin2D items={outfit.clothingItems} compact />
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
                    <Mannequin2D items={mannequinItems} compact />
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

            {/* Standard Nav Rows */}
            {[
              ['Edit Profile', 'person-outline', 'EditProfile'],
              ['Appearance', 'color-palette-outline', 'Settings'],
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
              style={[styles.settingRow, { borderBottomWidth: 0, marginTop: 4 }]}
            >
              <Ionicons name="log-out-outline" size={20} color="#DC2626" />
              <Text style={[styles.settingLabel, { color: '#DC2626' }]}>
                Log Out
              </Text>
            </Pressable>
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
    minHeight: 220,
    borderWidth: 1,
    borderRadius: 16,
    padding: 10,
    position: 'relative',
    marginBottom: 12,
  },
  gridMannequin: {
    height: 155,
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
});
