/**
 * Login Screen — Digital LEAP
 *
 * Authenticates a user and routes them to their role-based dashboard.
 * Displays server-side error messages including lockout notifications.
 */

import { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { Colors } from '../../constants/colors';
import { Roles } from '../../constants/roles';
import ScreenWrapper from '../../components/ScreenWrapper';
import InputField from '../../components/InputField';
import Button from '../../components/Button';

export default function LoginScreen() {
  const { login } = useAuth();
  const router    = useRouter();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  async function handleLogin() {
    setError('');

    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }

    setLoading(true);
    const result = await login(email.trim(), password);
    setLoading(false);

    if (!result.success) {
      setError(result.message);
      return;
    }

    // Navigation handled by index.js on user state change
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScreenWrapper>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logoText}>LEAP</Text>
          <Text style={styles.subtitle}>Internship Management System</Text>
          <Text style={styles.university}>Limkokwing University · Sierra Leone</Text>
        </View>

        {/* Form card */}
        <View style={styles.card}>
          <Text style={styles.title}>Sign In</Text>
          <Text style={styles.hint}>Use your university email address</Text>

          {error ? (
            <View style={styles.errorBox} accessibilityRole="alert">
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <InputField
            label="Email Address"
            value={email}
            onChangeText={setEmail}
            placeholder="you@limkokwing.edu.sl"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <InputField
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="Enter your password"
            secureTextEntry
          />

          <Button
            title="Sign In"
            onPress={handleLogin}
            loading={loading}
            style={styles.button}
          />
        </View>

        {/* Register link */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <TouchableOpacity
            onPress={() => router.push('/(auth)/register')}
            accessibilityRole="link"
          >
            <Text style={styles.footerLink}>Register</Text>
          </TouchableOpacity>
        </View>
      </ScreenWrapper>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems:   'center',
    paddingTop:   32,
    paddingBottom:32,
  },
  logoText: {
    fontSize:      48,
    fontWeight:    '900',
    color:         Colors.primary,
    letterSpacing: 6,
  },
  subtitle: {
    fontSize:   15,
    color:      Colors.textSecondary,
    marginTop:  4,
    textAlign:  'center',
  },
  university: {
    fontSize:   12,
    color:      Colors.textMuted,
    marginTop:  4,
    textAlign:  'center',
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius:    16,
    padding:         24,
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.08,
    shadowRadius:    8,
    elevation:       3,
  },
  title: {
    fontSize:     22,
    fontWeight:   '700',
    color:        Colors.textPrimary,
    marginBottom: 4,
  },
  hint: {
    fontSize:     13,
    color:        Colors.textSecondary,
    marginBottom: 20,
  },
  errorBox: {
    backgroundColor: Colors.locked,
    borderRadius:    8,
    padding:         12,
    marginBottom:    16,
  },
  errorText: {
    color:    Colors.lockedText,
    fontSize: 14,
  },
  button: {
    marginTop: 8,
  },
  footer: {
    flexDirection:  'row',
    justifyContent: 'center',
    marginTop:      24,
    paddingBottom:  16,
  },
  footerText: {
    color:    Colors.textSecondary,
    fontSize: 15,
  },
  footerLink: {
    color:      Colors.primary,
    fontSize:   15,
    fontWeight: '600',
  },
});
