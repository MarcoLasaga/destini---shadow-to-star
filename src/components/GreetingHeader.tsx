import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { useAppTheme } from '../hooks/useAppTheme';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning,';
  if (hour < 18) return 'Good afternoon,';
  return 'Good evening,';
}

export default function GreetingHeader({
  name,
  hasNotifications = true,
  unreadCount = 0,
  onPressNotifications,
}: {
  name: string;
  hasNotifications?: boolean;
  unreadCount?: number;
  onPressNotifications?: () => void;
}) {
  const theme = useAppTheme();
  const navigation = useNavigation<any>();

  const showBadge = unreadCount > 0 || hasNotifications;

  return (
    <Animated.View entering={FadeInDown.duration(400)} style={styles.row}>
      <View>
        <Text style={[styles.greeting, { color: theme.textMuted }]}>{getGreeting()}</Text>
        <View style={styles.nameRow}>
          <Text style={[styles.name, { color: theme.text }]}>{name}</Text>
          <Text style={styles.sparkle}> ✨</Text>
        </View>
      </View>

      <Pressable
        onPress={() => {
          if (onPressNotifications) {
            onPressNotifications();
          } else {
            navigation.navigate('Notifications');
          }
        }}
        accessibilityLabel="Notifications"
        style={({ pressed }) => [
          styles.bellButton,
          { backgroundColor: theme.surface, opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <Ionicons name="notifications-outline" size={22} color={theme.text} />
        {showBadge && (
          <View style={[styles.badge, unreadCount > 0 ? styles.countBadge : null]}>
            {unreadCount > 0 ? (
              <Text style={styles.countText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            ) : null}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  greeting: { fontSize: 15, marginBottom: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  name: { fontSize: 24, fontWeight: '700' },
  sparkle: { fontSize: 18 },
  bellButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 9,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#E5484D',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  countBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    top: 5,
    right: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  countText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    lineHeight: 11,
  },
});
