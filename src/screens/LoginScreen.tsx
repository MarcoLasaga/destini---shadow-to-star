import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useAppTheme } from '../hooks/useAppTheme';
import { useAuth } from '../contexts/AuthContext';
import TextField from '../components/TextField';

export default function LoginScreen() {
  const theme = useAppTheme();
  const isDark = theme.mode === 'dark';
  const navigation = useNavigation<any>();
  const { loginWithEmail, loginWithOAuth } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }
    setErrorMsg(null);
    setLoading(true);
    try {
      await loginWithEmail(email.trim(), password);
      await AsyncStorage.setItem('@stylesense_onboarding_complete', 'true');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to sign in. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: 'google' | 'facebook') => {
    setErrorMsg(null);
    setLoading(true);
    try {
      await loginWithOAuth(provider);
      await AsyncStorage.setItem('@stylesense_onboarding_complete', 'true');
    } catch (err: any) {
      setErrorMsg(err.message || `Failed to sign in with ${provider}.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Redesigned Brand Emblem & Greeting (PDF Page 8) */}
        <Animated.View entering={FadeInUp.duration(600).delay(100)} style={styles.header}>
          <View style={styles.emblemWrapper}>
            <View style={styles.logoOuterRing}>
              <View style={styles.logoContainer}>
                <Ionicons name="shirt-outline" size={30} color="#F3F1EF" />
              </View>
            </View>
            <View style={styles.logoAccentBadge}>
              <Ionicons name="sparkles" size={12} color="#F3F1EF" />
            </View>
          </View>

          <View style={styles.brandWordmarkPill}>
            <View style={styles.brandDot} />
            <Text style={styles.brandWordmarkText}>STYLESENSE</Text>
          </View>

          <Text style={[styles.title, { color: theme.text }]}>Welcome Back</Text>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>
            Sign in to your personal wardrobe studio
          </Text>
        </Animated.View>

        {/* Input Card */}
        <Animated.View
          entering={FadeInDown.duration(600).delay(200)}
          style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
        >
          {errorMsg && (
            <View style={[styles.errorContainer, { backgroundColor: 'rgba(232, 62, 53, 0.12)' }]}>
              <Ionicons name="alert-circle" size={18} color="#E83E35" />
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          )}

          {/* Social Buttons */}
          <View style={styles.socialRow}>
            <Pressable
              onPress={() => handleSocialLogin('google')}
              disabled={loading}
              style={[styles.socialButton, { borderColor: theme.border }]}
            >
              <Ionicons name="logo-google" size={18} color="#EA4335" />
              <Text style={[styles.socialText, { color: theme.text }]}>Google</Text>
            </Pressable>

            <Pressable
              onPress={() => handleSocialLogin('facebook')}
              disabled={loading}
              style={[styles.socialButton, { borderColor: theme.border }]}
            >
              <Ionicons name="logo-facebook" size={18} color="#1877F2" />
              <Text style={[styles.socialText, { color: theme.text }]}>Facebook</Text>
            </Pressable>
          </View>

          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
            <Text style={[styles.dividerText, { color: theme.textMuted }]}>OR</Text>
            <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
          </View>

          {/* Email / Password Form */}
          <View style={styles.form}>
            <TextField
              label="Email"
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />

            <View style={styles.passwordWrapper}>
              <TextField
                label="Password"
                placeholder="••••••••"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <Pressable
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeIcon}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={theme.textMuted}
                />
              </Pressable>
            </View>

            <Pressable
              onPress={handleLogin}
              disabled={loading}
              style={[styles.submitButton, { backgroundColor: '#364536' }]}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#F3F1EF" />
              ) : (
                <Text style={styles.submitButtonText}>Sign In</Text>
              )}
            </Pressable>
          </View>
        </Animated.View>

        {/* Footer */}
        <Animated.View entering={FadeInDown.duration(600).delay(300)} style={styles.footer}>
          <Text style={[styles.footerText, { color: theme.textMuted }]}>
            Don&apos;t have an account?{' '}
            <Text
              onPress={() => navigation.navigate('Signup')}
              style={[
                styles.linkText,
                { color: isDark ? '#F3F1EF' : '#364536', fontWeight: '800' },
              ]}
            >
              Sign Up
            </Text>
          </Text>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  emblemWrapper: {
    position: 'relative',
    marginBottom: 14,
  },
  logoOuterRing: {
    width: 82,
    height: 82,
    borderRadius: 26,
    backgroundColor: 'rgba(54, 69, 54, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(54, 69, 54, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    width: 68,
    height: 68,
    borderRadius: 21,
    backgroundColor: '#364536',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#364536',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 4,
  },
  logoAccentBadge: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#E83E35',
    borderWidth: 2.5,
    borderColor: '#F3F1EF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandWordmarkPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(54, 69, 54, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 10,
  },
  brandDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#E83E35',
  },
  brandWordmarkText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: '#364536',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 4,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#E83E35',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  socialRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  socialButton: {
    flex: 1,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 99,
  },
  socialText: {
    fontSize: 14,
    fontWeight: '700',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  form: {
    gap: 16,
  },
  passwordWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  eyeIcon: {
    position: 'absolute',
    right: 14,
    top: 38,
    padding: 4,
  },
  submitButton: {
    height: 52,
    borderRadius: 99,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  submitButtonText: {
    color: '#F3F1EF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  footer: {
    alignItems: 'center',
    marginTop: 28,
  },
  footerText: {
    fontSize: 14,
    fontWeight: '500',
  },
  linkText: {
    fontWeight: '700',
  },
});
