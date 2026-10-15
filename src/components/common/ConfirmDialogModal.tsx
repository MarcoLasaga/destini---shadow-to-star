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

  // Official StyleSense palette matching:
  // Dark: Surface #2E1B38, Border #4B1D6F, Title #FDF3D2, Message #DECFE8, CTA #FBF5A7 w/ #24152C text
  // Light: Surface #FFFFFF, Border #DECFE8, Title #24152C, Message #4B1D6F, CTA #24152C w/ #FBF5A7 text
  const surfaceBg = theme.surface;
  const borderColor = theme.border;
  const titleColor = theme.text;
  const messageColor = theme.mode === 'dark' ? '#DECFE8' : '#4B1D6F';

  const iconBg = isDanger
    ? '#E5484D1A'
    : isModeration
    ? (theme.mode === 'dark' ? '#FDD78B22' : '#DECFE855')
    : theme.mode === 'dark'
    ? '#4B1D6F44'
    : '#DECFE844';

  const iconColor = isDanger
    ? '#E5484D'
    : isModeration
    ? (theme.mode === 'dark' ? '#FDD78B' : '#4B1D6F')
    : theme.secondaryAccent;

  const confirmBg = isDanger
    ? '#E5484D'
    : theme.mode === 'dark'
    ? '#FBF5A7'
    : '#24152C';

  const confirmTextColor = isDanger
    ? '#FFFFFF'
    : theme.mode === 'dark'
    ? '#24152C'
    : '#FBF5A7';

  return (
    <Modal
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
            <Ionicons name={resolvedIcon} size={28} color={iconColor} />
          </View>

          {/* Title & Message */}
          <View style={styles.textWrap}>
            <Text style={[styles.title, { color: titleColor }]}>{title}</Text>
            <Text style={[styles.message, { color: messageColor }]}>{message}</Text>
          </View>

          {/* Action Buttons */}
          <View style={[styles.buttonRow, !showCancel && styles.singleButtonRow]}>
            {showCancel && (
              <Pressable
                disabled={loading}
                onPress={onCancel}
                style={({ pressed }) => [
                  styles.button,
                  styles.cancelButton,
                  {
                    borderColor,
                    backgroundColor: theme.mode === 'dark' ? '#24152C55' : '#FDF3D244',
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}
              >
                <Text style={[styles.cancelText, { color: theme.text }]}>{cancelText}</Text>
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
                  flex: showCancel ? 1 : undefined,
                  width: showCancel ? undefined : '100%',
                  opacity: loading ? 0.7 : pressed ? 0.85 : 1,
                },
              ]}
            >
              {loading ? (
                <ActivityIndicator size="small" color={confirmTextColor} />
              ) : (
                <Text style={[styles.confirmText, { color: confirmTextColor }]}>
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
    backgroundColor: 'rgba(15, 10, 20, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: Math.min(340, width - 40),
    borderRadius: 24,
    borderWidth: 1.5,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 8,
  },
  iconWrap: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
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
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  cancelButton: {
    flex: 1,
    borderWidth: 1,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '600',
  },
  confirmButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  confirmText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});

