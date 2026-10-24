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
import { formatRelativeTime } from '../utils/timeFormat';
import {
  getSocialNotifications,
  markAllNotificationsRead,
  SocialNotification,
} from '../services/socialNotificationService';

interface NotificationsModalProps {
  visible: boolean;
  onClose: () => void;
  onNotificationCountChange?: (unreadCount: number) => void;
}

export default function NotificationsModal({
  visible,
  onClose,
  onNotificationCountChange,
}: NotificationsModalProps) {
  const theme = useAppTheme();
  const [notifications, setNotifications] = useState<SocialNotification[]>([]);
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});

  const loadNotifications = async () => {
    const list = await getSocialNotifications();
    setNotifications(list);
    const unread = list.filter((n) => !n.read).length;
    onNotificationCountChange?.(unread);

    const rawFollowing = await AsyncStorage.getItem('@stylesense_social_following_names');
    if (rawFollowing) {
      try {
        const names: string[] = JSON.parse(rawFollowing);
        const map: Record<string, boolean> = {};
        names.forEach((n) => {
          map[n] = true;
        });
        setFollowingMap(map);
      } catch {
        // ignore
      }
    }
  };

  useEffect(() => {
    if (visible) {
      loadNotifications();
    }
  }, [visible]);

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead();
    await loadNotifications();
    onNotificationCountChange?.(0);
  };

  const toggleFollowBack = (name: string) => {
    setFollowingMap((prev) => ({
      ...prev,
      [name]: !prev[name],
    }));
  };

  const getActionIcon = (type: SocialNotification['type']) => {
    switch (type) {
      case 'like':
        return <Ionicons name="heart" size={12} color="#EF4444" />;
      case 'repost':
        return <Ionicons name="repeat" size={12} color="#10B981" />;
      case 'follow':
      default:
        return <Ionicons name="person-add" size={12} color="#3B82F6" />;
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.dragHandle} />

          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={[styles.title, { color: theme.text }]}>Activity</Text>
              <Text style={[styles.subtitle, { color: theme.textMuted }]}>
                Likes, follows & reposts on your outfits
              </Text>
            </View>

            <View style={styles.headerActions}>
              <Pressable onPress={handleMarkAllRead} style={styles.markReadBtn}>
                <Ionicons name="checkmark-done" size={15} color="#4D9A65" />
                <Text style={styles.markReadText}>Mark read</Text>
              </Pressable>
              <Pressable onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={theme.textMuted} />
              </Pressable>
            </View>
          </View>

          {/* Notifications List */}
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
            {notifications.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="notifications-off-outline" size={38} color={theme.textMuted} />
                <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                  No notifications yet. Publish a look to start the conversation!
                </Text>
              </View>
            ) : (
              notifications.map((item) => {
                const isFollowing = followingMap[item.actorName];
                return (
                  <View
                    key={item.id}
                    style={[
                      styles.itemRow,
                      { borderColor: theme.border },
                      !item.read && styles.unreadItem,
                    ]}
                  >
                    {/* Avatar with Action Icon Badge */}
                    <View style={styles.avatarWrap}>
                      <View style={styles.avatarCircle}>
                        <Text style={styles.avatarInitial}>
                          {item.actorName.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.actionIconBadge}>{getActionIcon(item.type)}</View>
                    </View>

                    {/* Content */}
                    <View style={styles.itemContent}>
                      <Text style={[styles.messageText, { color: theme.text }]}>
                        <Text style={styles.actorName}>{item.actorName} </Text>
                        {item.message}
                      </Text>
                      <Text style={[styles.timeText, { color: theme.textMuted }]}>
                        {formatRelativeTime(item.createdAt)}
                      </Text>
                    </View>

                    {/* Quick Action Button */}
                    {item.type === 'follow' ? (
                      <Pressable
                        onPress={() => toggleFollowBack(item.actorName)}
                        style={[
                          styles.followBtn,
                          isFollowing && styles.followingBtn,
                        ]}
                      >
                        <Text
                          style={[
                            styles.followBtnText,
                            isFollowing && styles.followingBtnText,
                          ]}
                        >
                          {isFollowing ? 'Following' : 'Follow Back'}
                        </Text>
                      </Pressable>
                    ) : (
                      <View style={styles.miniLookPill}>
                        <Ionicons name="shirt-outline" size={12} color="#4D9A65" />
                        <Text style={styles.miniLookText} numberOfLines={1}>
                          Look
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
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
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  markReadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EAF3D9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  markReadText: {
    color: '#264C3B',
    fontSize: 11,
    fontWeight: '800',
  },
  closeBtn: {
    padding: 4,
  },
  list: {
    gap: 10,
    paddingBottom: 16,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    gap: 12,
  },
  unreadItem: {
    backgroundColor: '#F8FAF5',
    borderColor: '#C6D9BC',
  },
  avatarWrap: {
    position: 'relative',
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#DCEFCF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 16,
    fontWeight: '900',
    color: '#264C3B',
  },
  actionIconBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  itemContent: {
    flex: 1,
  },
  messageText: {
    fontSize: 12.5,
    lineHeight: 17,
  },
  actorName: {
    fontWeight: '900',
  },
  timeText: {
    fontSize: 10.5,
    marginTop: 3,
    fontWeight: '600',
  },
  followBtn: {
    backgroundColor: '#264C3B',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  followingBtn: {
    backgroundColor: '#EAF3D9',
  },
  followBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  followingBtnText: {
    color: '#264C3B',
  },
  miniLookPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#EAF3D9',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
  },
  miniLookText: {
    color: '#264C3B',
    fontSize: 10,
    fontWeight: '800',
  },
  empty: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  emptyText: {
    fontSize: 12,
    textAlign: 'center',
    maxWidth: 240,
    lineHeight: 18,
  },
});

