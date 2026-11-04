import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppTheme } from '../hooks/useAppTheme';
import { useToast } from '../contexts/ToastContext';
import ConfirmDialogModal from './common/ConfirmDialogModal';

interface UserEntry {
  id: string;
  name: string;
  handle: string;
  styleVibe: string;
  isFollowing: boolean;
}

interface LikeEntry {
  id: string;
  name: string;
  handle: string;
  postTitle: string;
  timeAgo: string;
}

interface SocialListModalProps {
  visible: boolean;
  initialTab?: 'followers' | 'following' | 'likes';
  postTitle?: string;
  onClose: () => void;
  onFollowCountChange?: (followingCount: number, followersCount: number) => void;
}

const FOLLOWING_STORAGE_KEY = '@stylesense_social_following_names';
const FOLLOWERS_STORAGE_KEY = '@stylesense_social_followers';
const LIKES_STORAGE_KEY = '@stylesense_social_likes';

export default function SocialListModal({
  visible,
  initialTab = 'followers',
  postTitle,
  onClose,
  onFollowCountChange,
}: SocialListModalProps) {
  const theme = useAppTheme();
  const isDark = theme.mode === 'dark';
  const { showToast } = useToast();
  const [tab, setTab] = useState<'followers' | 'following' | 'likes'>(initialTab);
  const [followers, setFollowers] = useState<UserEntry[]>([]);
  const [likes, setLikes] = useState<LikeEntry[]>([]);
  const [followingNames, setFollowingNames] = useState<string[]>([]);
  const [unfollowTarget, setUnfollowTarget] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setTab(initialTab);
      AsyncStorage.getItem(FOLLOWING_STORAGE_KEY).then((raw) => {
        if (raw) {
          try {
            const list: string[] = JSON.parse(raw);
            if (Array.isArray(list)) setFollowingNames(list);
          } catch {
            setFollowingNames([]);
          }
        } else {
          setFollowingNames([]);
        }
      });

      AsyncStorage.getItem(FOLLOWERS_STORAGE_KEY).then((raw) => {
        if (raw) {
          try {
            const list: UserEntry[] = JSON.parse(raw);
            if (Array.isArray(list)) setFollowers(list);
          } catch {
            setFollowers([]);
          }
        } else {
          setFollowers([]);
        }
      });

      AsyncStorage.getItem(LIKES_STORAGE_KEY).then((raw) => {
        if (raw) {
          try {
            const list: LikeEntry[] = JSON.parse(raw);
            if (Array.isArray(list)) setLikes(list);
          } catch {
            setLikes([]);
          }
        } else {
          setLikes([]);
        }
      });
    }
  }, [visible, initialTab]);

  const toggleFollow = async (name: string) => {
    const wasFollowing = followingNames.includes(name);
    if (wasFollowing) {
      setUnfollowTarget(name);
      return;
    }

    const next = [...followingNames, name];
    setFollowingNames(next);
    await AsyncStorage.setItem(FOLLOWING_STORAGE_KEY, JSON.stringify(next));

    setFollowers((prev) =>
      prev.map((u) => (u.name === name ? { ...u, isFollowing: true } : u))
    );

    showToast(`Following ${name}`);
    onFollowCountChange?.(next.length, followers.length);
  };

  const confirmUnfollow = async () => {
    if (!unfollowTarget) return;
    const name = unfollowTarget;
    setUnfollowTarget(null);

    const next = followingNames.filter((n) => n !== name);
    setFollowingNames(next);
    await AsyncStorage.setItem(FOLLOWING_STORAGE_KEY, JSON.stringify(next));

    setFollowers((prev) =>
      prev.map((u) => (u.name === name ? { ...u, isFollowing: false } : u))
    );
    onFollowCountChange?.(next.length, followers.length);

    showToast(`Unfollowed ${name}`, {
      variant: 'warning',
      undoLabel: 'Undo',
      onUndo: () => {
        setFollowingNames((curr) => {
          if (curr.includes(name)) return curr;
          const restored = [...curr, name];
          AsyncStorage.setItem(FOLLOWING_STORAGE_KEY, JSON.stringify(restored)).catch(() => {});
          onFollowCountChange?.(restored.length, followers.length);
          return restored;
        });
        setFollowers((prev) =>
          prev.map((u) => (u.name === name ? { ...u, isFollowing: true } : u))
        );
        showToast(`Following ${name}`);
      },
    });
  };

  const followingList = followers.filter((u) => followingNames.includes(u.name));

  return (
    <Modal statusBarTranslucent={true} visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={[styles.dragHandle, { backgroundColor: theme.border }]} />

          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={[styles.title, { color: theme.text }]}>
                {tab === 'followers' ? 'Followers' : tab === 'following' ? 'Following' : 'Likes'}
              </Text>
              <Text style={[styles.subtitle, { color: theme.textMuted }]}>
                {tab === 'followers'
                  ? `${followers.length} people following your fashion space`
                  : tab === 'following'
                  ? `${followingList.length} creators you follow`
                  : postTitle
                  ? `People who liked "${postTitle}"`
                  : 'People who liked your published looks'}
              </Text>
            </View>

            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={theme.textMuted} />
            </Pressable>
          </View>

          {/* Tab Selector */}
          <View style={[styles.tabRow, { borderBottomColor: theme.border }]}>
            <Pressable
              onPress={() => setTab('followers')}
              style={[
                styles.tabBtn,
                tab === 'followers' && {
                  borderBottomColor: isDark ? '#7DD39A' : '#264C3B',
                },
              ]}
            >
              <Text
                style={[
                  styles.tabBtnText,
                  { color: tab === 'followers' ? theme.text : theme.textMuted },
                ]}
              >
                Followers ({followers.length})
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setTab('following')}
              style={[
                styles.tabBtn,
                tab === 'following' && {
                  borderBottomColor: isDark ? '#7DD39A' : '#264C3B',
                },
              ]}
            >
              <Text
                style={[
                  styles.tabBtnText,
                  { color: tab === 'following' ? theme.text : theme.textMuted },
                ]}
              >
                Following ({followingList.length})
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setTab('likes')}
              style={[
                styles.tabBtn,
                tab === 'likes' && {
                  borderBottomColor: isDark ? '#7DD39A' : '#264C3B',
                },
              ]}
            >
              <Text
                style={[
                  styles.tabBtnText,
                  { color: tab === 'likes' ? theme.text : theme.textMuted },
                ]}
              >
                Likes ({likes.length})
              </Text>
            </Pressable>
          </View>

          {/* List Content */}
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
            {tab === 'followers' && (
              followers.length === 0 ? (
                <View style={styles.empty}>
                  <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                    No followers yet. Publish your favorite looks to the Community to inspire others!
                  </Text>
                </View>
              ) : (
                followers.map((user) => {
                  const isFollowing = followingNames.includes(user.name);
                  return (
                    <View
                      key={user.id}
                      style={[
                        styles.userRow,
                        { backgroundColor: theme.surfaceSecondary, borderColor: theme.border },
                      ]}
                    >
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{user.name.charAt(0)}</Text>
                      </View>

                      <View style={styles.userInfo}>
                        <Text style={[styles.userName, { color: theme.text }]}>{user.name}</Text>
                        <Text style={[styles.userHandle, { color: theme.textMuted }]}>
                          {user.handle} · <Text style={{ color: '#4D9A65' }}>{user.styleVibe}</Text>
                        </Text>
                      </View>

                      <Pressable
                        onPress={() => toggleFollow(user.name)}
                        style={[styles.actionBtn, isFollowing && styles.actionBtnActive]}
                      >
                        <Text
                          style={[
                            styles.actionBtnText,
                            isFollowing && styles.actionBtnTextActive,
                          ]}
                        >
                          {isFollowing ? 'Following' : 'Follow Back'}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })
              )
            )}

            {tab === 'following' && (
              followingList.length === 0 ? (
                <View style={styles.empty}>
                  <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                    You aren’t following anyone yet. Explore the community feed to discover creators!
                  </Text>
                </View>
              ) : (
                followingList.map((user) => (
                  <View
                    key={user.id}
                    style={[
                      styles.userRow,
                      { backgroundColor: theme.surfaceSecondary, borderColor: theme.border },
                    ]}
                  >
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{user.name.charAt(0)}</Text>
                    </View>

                    <View style={styles.userInfo}>
                      <Text style={[styles.userName, { color: theme.text }]}>{user.name}</Text>
                      <Text style={[styles.userHandle, { color: theme.textMuted }]}>
                        {user.handle} · <Text style={{ color: '#4D9A65' }}>{user.styleVibe}</Text>
                      </Text>
                    </View>

                    <Pressable
                      onPress={() => toggleFollow(user.name)}
                      style={[styles.actionBtn, styles.actionBtnActive]}
                    >
                      <Text style={[styles.actionBtnText, styles.actionBtnTextActive]}>
                        Following
                      </Text>
                    </Pressable>
                  </View>
                ))
              )
            )}

            {tab === 'likes' && (
              likes.length === 0 ? (
                <View style={styles.empty}>
                  <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                    No likes yet. Tap the heart on looks in the Community feed to save and appreciate styles!
                  </Text>
                </View>
              ) : (
                likes.map((item) => {
                  const isFollowing = followingNames.includes(item.name);
                  return (
                    <View
                      key={item.id}
                      style={[
                        styles.userRow,
                        { backgroundColor: theme.surfaceSecondary, borderColor: theme.border },
                      ]}
                    >
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{item.name.charAt(0)}</Text>
                      </View>

                      <View style={styles.userInfo}>
                        <Text style={[styles.userName, { color: theme.text }]}>{item.name}</Text>
                        <Text style={[styles.userHandle, { color: theme.textMuted }]}>
                          Liked <Text style={{ fontWeight: '800' }}>{item.postTitle}</Text> · {item.timeAgo}
                        </Text>
                      </View>

                      <Pressable
                        onPress={() => toggleFollow(item.name)}
                        style={[styles.actionBtn, isFollowing && styles.actionBtnActive]}
                      >
                        <Text
                          style={[
                            styles.actionBtnText,
                            isFollowing && styles.actionBtnTextActive,
                          ]}
                        >
                          {isFollowing ? 'Following' : 'Follow'}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })
              )
            )}
          </ScrollView>
        </View>
      </View>

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
        onConfirm={confirmUnfollow}
        onCancel={() => setUnfollowTarget(null)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 32,
    maxHeight: '82%',
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    marginBottom: 12,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
  },
  list: {
    gap: 10,
    paddingBottom: 16,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#DCEFCF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#264C3B',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 13.5,
    fontWeight: '800',
  },
  userHandle: {
    fontSize: 11,
    marginTop: 2,
  },
  actionBtn: {
    backgroundColor: '#264C3B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  actionBtnActive: {
    backgroundColor: '#EAF3D9',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  actionBtnTextActive: {
    color: '#264C3B',
  },
  empty: {
    paddingVertical: 36,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 240,
  },
});
