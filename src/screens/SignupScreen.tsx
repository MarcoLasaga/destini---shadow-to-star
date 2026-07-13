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
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useAppTheme } from '../hooks/useAppTheme';
import { useAuth } from '../contexts/AuthContext';
import TextField from '../components/TextField';

export default function SignupScreen() {
  const theme = useAppTheme();
  const navigation = useNavigation<any>();
  const { signUpWithEmail, loginWithOAuth } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSignup = async () => {
    if (!email || !password || !displayName || !firstName || !lastName) {
      setErrorMsg('Please fill in all the fields.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Password should be at least 6 characters.');
      return;
    }
    
    setErrorMsg(null);
    setLoading(true);
    try {
      await signUpWithEmail(
        email.trim(),
        password,
        displayName.trim(),
        firstName.trim(),
        lastName.trim()
      );
      // Wait for session update. If email verification is enabled, tell the user:
      // "Verification email sent!" but since Supabase by default triggers session on signup or sends a verification, 
      // let's show an alert or let AuthContext handle the redirect if session is established automatically.
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to register account.');
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: 'google' | 'facebook') => {
    setErrorMsg(null);
    setLoading(true);
    try {
      await loginWithOAuth(provider);
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
        {/* Title */}
        <Animated.View entering={FadeInUp.duration(600).delay(100)} style={styles.header}>
          <Text style={[styles.title, { color: theme.text }]}>Create Account</Text>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>Start styling your digital closet</Text>
        </Animated.View>

        {/* Form Card */}
        <Animated.View
          entering={FadeInDown.duration(600).delay(200)}
          style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
        >
          {errorMsg && (
            <View style={[styles.errorContainer, { backgroundColor: 'rgba(229, 72, 77, 0.1)' }]}>
              <Ionicons name="alert-circle" size={18} color="#E5484D" />
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          )}

          {/* Social buttons */}
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

          {/* Registration Input Fields */}
          <View style={styles.form}>
            <View style={styles.nameRow}>
              <View style={{ flex: 1 }}>
                <TextField
                  label="First Name"
                  placeholder="John"
                  value={firstName}
                  onChangeText={setFirstName}
                />
              </View>
              <View style={{ flex: 1 }}>
                <TextField
                  label="Last Name"
                  placeholder="Doe"
                  value={lastName}
                  onChangeText={setLastName}
                />
              </View>
            </View>

            <TextField
              label="Display Name"
              placeholder="johndoe"
              value={displayName}
              onChangeText={setDisplayName}
              autoCapitalize="none"
            />

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
              onPress={handleSignup}
              disabled={loading}
              style={[styles.submitButton, { backgroundColor: theme.secondaryAccent }]}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>Create Account</Text>
              )}
            </Pressable>
          </View>
        </Animated.View>

        {/* Footer Link */}
        <Animated.View entering={FadeInDown.duration(600).delay(300)} style={styles.footer}>
          <Text style={[styles.footerText, { color: theme.textMuted }]}>
            Already have an account?{' '}
            <Text
              onPress={() => navigation.navigate('Login')}
              style={[styles.linkText, { color: theme.secondaryAccent }]}
            >
              Sign In
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
  title: {
    fontSize: 26,
    fontWeight: '800',
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
    color: '#E5484D',
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
  nameRow: {
    flexDirection: 'row',
    gap: 12,
  },
  passwordWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  eyeIcon: {
    position: 'absolute',
    right: 14,
    top: 38, // aligns with input label offset
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
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
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
