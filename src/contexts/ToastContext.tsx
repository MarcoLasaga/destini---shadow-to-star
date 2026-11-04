import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../hooks/useAppTheme';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ToastOptions {
  variant?: ToastVariant;
  undoLabel?: string;
  onUndo?: () => void;
  duration?: number;
}

interface ToastContextValue {
  showToast: (message: string, variantOrOptions?: ToastVariant | ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

function detectToastVariant(msg: string, explicit?: ToastVariant): ToastVariant {
  if (explicit) return explicit;
  const lower = msg.toLowerCase();
  if (
    /error|fail|could not|couldn't|invalid|missing|unable|denied|problem|limit/i.test(lower)
  ) {
    return 'error';
  }
  if (/remove|delete|unfollow|unmark|pass|skip|dislike|clear|reset/i.test(lower)) {
    return 'warning';
  }
  if (
    /save|add|publish|confirm|update|follow|like|worn|complete|ready|copied|mark|equip|match|restored/i.test(
      lower
    )
  ) {
    return 'success';
  }
  return 'info';
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const [variant, setVariant] = useState<ToastVariant>('info');
  const [undoLabel, setUndoLabel] = useState<string>('Undo');
  const [onUndoAction, setOnUndoAction] = useState<(() => void) | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const theme = useAppTheme();
  const isDark = theme.mode === 'dark';

  const dismiss = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setMessage(null);
    setOnUndoAction(null);
  }, []);

  const showToast = useCallback(
    (msg: string, variantOrOptions?: ToastVariant | ToastOptions) => {
      const isOptionsObj =
        typeof variantOrOptions === 'object' && variantOrOptions !== null;
      const explicitVariant = isOptionsObj
        ? variantOrOptions.variant
        : (variantOrOptions as ToastVariant | undefined);
      const resolved = detectToastVariant(msg, explicitVariant);

      setVariant(resolved);
      setMessage(msg);

      if (isOptionsObj && variantOrOptions.onUndo) {
        setUndoLabel(variantOrOptions.undoLabel || 'Undo');
        setOnUndoAction(() => variantOrOptions.onUndo!);
      } else {
        setOnUndoAction(null);
      }

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      const duration =
        isOptionsObj && variantOrOptions.duration
          ? variantOrOptions.duration
          : isOptionsObj && variantOrOptions.onUndo
          ? 4200
          : 2600;
      timeoutRef.current = setTimeout(() => {
        setMessage(null);
        setOnUndoAction(null);
      }, duration);
    },
    []
  );

  const handlePressUndo = useCallback(() => {
    if (onUndoAction) {
      const fn = onUndoAction;
      dismiss();
      fn();
    }
  }, [onUndoAction, dismiss]);

  const accentConfig: Record<
    ToastVariant,
    { icon: keyof typeof Ionicons.glyphMap; color: string; badgeBg: string }
  > = {
    success: {
      icon: 'checkmark-circle',
      color: '#34D399',
      badgeBg: 'rgba(52, 211, 153, 0.16)',
    },
    error: {
      icon: 'alert-circle',
      color: '#F87171',
      badgeBg: 'rgba(248, 113, 113, 0.18)',
    },
    warning: {
      icon: 'information-circle',
      color: '#FBBF24',
      badgeBg: 'rgba(251, 191, 36, 0.18)',
    },
    info: {
      icon: 'sparkles',
      color: '#E83E35',
      badgeBg: 'rgba(232, 62, 53, 0.16)',
    },
  };

  const currentAccent = accentConfig[variant];

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {message && (
        <Animated.View
          entering={FadeInDown.duration(230)}
          exiting={FadeOutDown.duration(210)}
          style={[
            styles.toast,
            {
              bottom: Math.max(insets.bottom, 10) + 74,
              backgroundColor: isDark ? '#1D2620' : '#263328',
              borderColor: isDark ? '#324237' : 'rgba(243, 241, 239, 0.22)',
              borderLeftColor: currentAccent.color,
            },
          ]}
        >
          <View style={styles.contentRow}>
            <Pressable onPress={dismiss} style={styles.leftContent}>
              <View style={[styles.iconBadge, { backgroundColor: currentAccent.badgeBg }]}>
                <Ionicons name={currentAccent.icon} size={17} color={currentAccent.color} />
              </View>
              <Text style={styles.text} numberOfLines={2}>
                {message}
              </Text>
            </Pressable>

            {onUndoAction && (
              <Pressable
                onPress={handlePressUndo}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.undoPill,
                  {
                    backgroundColor: 'rgba(243, 241, 239, 0.16)',
                    borderColor: 'rgba(243, 241, 239, 0.35)',
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}
              >
                <Ionicons name="arrow-undo-outline" size={13} color="#F3F1EF" />
                <Text style={styles.undoText}>{undoLabel}</Text>
              </Pressable>
            )}
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: 20,
    right: 20,
    borderWidth: 1,
    borderLeftWidth: 4,
    borderRadius: 16,
    paddingVertical: 11,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.26,
    shadowRadius: 14,
    elevation: 8,
    zIndex: 9999,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  leftContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    color: '#F3F1EF',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    letterSpacing: 0.1,
  },
  undoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  undoText: {
    color: '#F3F1EF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
