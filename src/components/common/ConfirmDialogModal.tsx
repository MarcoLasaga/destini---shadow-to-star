import React from 'react';
import { View, Text, Pressable, Modal, StyleSheet, Dimensions, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useAppTheme } from '../../hooks/useAppTheme';

const { width } = Dimensions.get('window');

export type ConfirmDialogVariant = 'default' | 'danger' | 'moderation' | 'info';

export interface ConfirmDialogModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  showCancel?: boolean;
  variant?: ConfirmDialogVariant;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
}

export default function ConfirmDialogModal({
  visible,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  showCancel = true,
  variant = 'default',
  icon,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogModalProps) {
  const theme = useAppTheme();
  const isDark = theme.mode === 'dark';

  if (!visible) return null;

  // Resolve icon based on variant if not explicitly provided
  const resolvedIcon: keyof typeof Ionicons.glyphMap =
    icon ||
    (variant === 'danger'
      ? 'trash-outline'
      : variant === 'moderation'
      ? 'shield-half-outline'
      : variant === 'info'
      ? 'information-circle-outline'
      : 'alert-circle-outline');

  const isDanger = variant === 'danger';
  const isModeration = variant === 'moderation';

  const surfaceBg = theme.surface;
  const borderColor = theme.border;
  const titleColor = theme.text;
  const messageColor = theme.textMuted;

  const iconBg = isDanger
    ? 'rgba(232, 62, 53, 0.14)'
    : isModeration
    ? 'rgba(54, 69, 54, 0.16)'
    : isDark
    ? 'rgba(54, 69, 54, 0.35)'
    : '#EBF0EB';

  const iconColor = isDanger
    ? '#E83E35'
    : isModeration
    ? (isDark ? '#F3F1EF' : '#364536')
    : (isDark ? '#F3F1EF' : '#364536');

  const confirmBg = isDanger ? '#E83E35' : '#364536';
  const confirmTextColor = '#F3F1EF';

  return (
    <Modal statusBarTranslucent={true}
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.backdrop}>
        <Animated.View
          entering={FadeInDown.duration(240)}
          style={[
            styles.card,
            {
              backgroundColor: surfaceBg,
              borderColor,
            },
          ]}
        >
          {/* Icon Bubble */}
          <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
            <Ionicons name={resolvedIcon} size={26} color={iconColor} />
          </View>

          {/* Title & Message */}
          <View style={styles.textWrap}>
            <Text style={[styles.title, { color: titleColor }]}>{title}</Text>
            <Text style={[styles.message, { color: messageColor }]}>{message}</Text>
          </View>

          {/* Redesigned Balanced Action Buttons (PDF Page 11) */}
          <View style={[styles.buttonRow, !showCancel && styles.singleButtonRow]}>
            {showCancel && (
              <Pressable
                disabled={loading}
                onPress={onCancel}
                style={({ pressed }) => [
                  styles.button,
                  styles.cancelButton,
                  {
                    borderColor: isDark ? '#3F3F46' : '#D4D4D8',
                    backgroundColor: isDark ? '#27272A' : '#F3F1EF',
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}
              >
                <Text
                  style={[styles.cancelText, { color: isDark ? '#F3F1EF' : '#18181B' }]}
                  numberOfLines={1}
                >
                  {cancelText}
                </Text>
              </Pressable>
            )}

            <Pressable
              disabled={loading}
              onPress={onConfirm}
              style={({ pressed }) => [
                styles.button,
                styles.confirmButton,
                {
                  backgroundColor: confirmBg,
                  flex: showCancel ? 1.25 : undefined,
                  width: showCancel ? undefined : '100%',
                  opacity: loading ? 0.7 : pressed ? 0.85 : 1,
                },
              ]}
            >
              {loading ? (
                <ActivityIndicator size="small" color={confirmTextColor} />
              ) : (
                <Text
                  style={[styles.confirmText, { color: confirmTextColor }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {confirmText}
                </Text>
              )}
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(18, 18, 20, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: Math.min(348, width - 36),
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 8,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  textWrap: {
    alignItems: 'center',
    marginBottom: 22,
    paddingHorizontal: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  message: {
    fontSize: 13.5,
    lineHeight: 19.5,
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
  },
  singleButtonRow: {
    flexDirection: 'column',
  },
  button: {
    height: 48,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  cancelButton: {
    flex: 1,
    borderWidth: 1,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '700',
  },
  confirmButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 6,
    elevation: 3,
  },
  confirmText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
});
