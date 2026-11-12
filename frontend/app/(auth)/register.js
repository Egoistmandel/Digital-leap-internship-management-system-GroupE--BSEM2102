/**
 * Registration Screen — Digital LEAP
 *
 * Allows users to create a new account.
 * New accounts start as 'pending' and require Coordinator approval (FR-02).
 * leap_coordinator and management roles cannot self-register.
 */

import { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { Colors } from '../../constants/colors';
import { REGISTERABLE_ROLES } from '../../constants/roles';
import ScreenWrapper from '../../components/ScreenWrapper';
import InputField from '../../components/InputField';
import Button from '../../components/Button';

export default function RegisterScreen() {
  const { register } = useAuth();
  const router       = useRouter();

  const [fullName,  setFullName]  = useState('');
  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [confirm,   setConfirm]   = useState('');
  const [role,      setRole]      = useState('');
  const [loading,   setLoading]   = useState(false);
  const [success,   setSuccess]   = useState(false);
  const [errors,    setErrors]    = useState({});
  const [globalErr, setGlobalErr] = useState('');

  async function handleRegister() {
    setErrors({});
    setGlobalErr('');

    // Basic client-side checks
    const clientErrors = {};
    if (!fullName.trim())  clientErrors.full_name = 'Full name is required.';
    if (!email.trim())     clientErrors.email     = 'Email address is required.';
    if (!password)         clientErrors.password  = 'Password is required.';
    if (password.length < 8) clientErrors.password = 'Password must be at least 8 characters.';
    if (password !== confirm) clientErrors.confirm = 'Passwords do not match.';
    if (!role)             clientErrors.role      = 'Please select a role.';

    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      return;
    }

    setLoading(true);
    const result = await register({ full_name: fullName.trim(), email: email.trim(), password, role });
    setLoading(false);

    if (result.success) {
      setSuccess(true);
    } else {
      setErrors(result.errors ?? {});
      setGlobalErr(result.message);
    }
  }

  if (success) {
    return (
      <ScreenWrapper>
        <View style={styles.successContainer}>
          <View style={styles.successIcon}>
            <Text style={styles.successEmoji}>✓</Text>
          </View>
          <Text style={styles.successTitle}>Registration Submitted</Text>
          <Text style={styles.successMessage}>
            Your account has been created and is pending approval by the
            LEAP Coordinator. You will be able to log in once your account
            has been activated.
          </Text>
          <Button
            title="Back to Sign In"
            onPress={() => router.replace('/(auth)/login')}
            style={{ marginTop: 24 }}
          />
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScreenWrapper>
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>
          New accounts require coordinator approval before you can log in.
        </Text>

        {globalErr ? (
          <View style={styles.errorBox} accessibilityRole="alert">
            <Text style={styles.errorText}>{globalErr}</Text>
          </View>
        ) : null}

        <InputField
          label="Full Name"
          value={fullName}
          onChangeText={setFullName}
          placeholder="Enter your full name"
          error={errors.full_name}
        />

        <InputField
          label="Email Address"
          value={email}
          onChangeText={setEmail}
          placeholder="you@limkokwing.edu.sl"
          keyboardType="email-address"
          autoCapitalize="none"
          error={errors.email}
        />

        <InputField
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="At least 8 characters"
          secureTextEntry
          error={errors.password}
        />

        <InputField
          label="Confirm Password"
          value={confirm}
          onChangeText={setConfirm}
          placeholder="Re-enter your password"
          secureTextEntry
          error={errors.confirm}
        />

        {/* Role selector */}
        <Text style={styles.roleLabel}>Select Your Role</Text>
        {errors.role ? (
          <Text style={styles.fieldError}>{errors.role}</Text>
        ) : null}
        <View style={styles.roleGrid}>
          {REGISTERABLE_ROLES.map((r) => (
            <TouchableOpacity
              key={r.value}
              style={[styles.roleChip, role === r.value && styles.roleChipActive]}
              onPress={() => setRole(r.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected: role === r.value }}
            >
              <Text style={[
                styles.roleChipText,
                role === r.value && styles.roleChipTextActive,
              ]}>
                {r.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Button
          title="Create Account"
          onPress={handleRegister}
          loading={loading}
          style={styles.button}
        />

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <TouchableOpacity
            onPress={() => router.replace('/(auth)/login')}
            accessibilityRole="link"
          >
            <Text style={styles.footerLink}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </ScreenWrapper>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize:     26,
    fontWeight:   '700',
    color:        Colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize:     14,
    color:        Colors.textSecondary,
    marginBottom: 24,
    lineHeight:   20,
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
  roleLabel: {
    fontSize:     14,
    fontWeight:   '600',
    color:        Colors.textPrimary,
    marginBottom: 8,
  },
  fieldError: {
    fontSize:     12,
    color:        Colors.error,
    marginBottom: 8,
  },
  roleGrid: {
    flexDirection:  'row',
    flexWrap:       'wrap',
    gap:            8,
    marginBottom:   24,
  },
  roleChip: {
    borderWidth:     1.5,
    borderColor:     Colors.border,
    borderRadius:    20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: Colors.surface,
  },
  roleChipActive: {
    borderColor:     Colors.primary,
    backgroundColor: Colors.primary,
  },
  roleChipText: {
    fontSize:   13,
    color:      Colors.textSecondary,
    fontWeight: '500',
  },
  roleChipTextActive: {
    color: Colors.white,
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
  successContainer: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  successIcon: {
    width:           80,
    height:          80,
    borderRadius:    40,
    backgroundColor: Colors.success,
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    24,
  },
  successEmoji: {
    fontSize:   36,
    color:      Colors.white,
    fontWeight: '700',
  },
  successTitle: {
    fontSize:     22,
    fontWeight:   '700',
    color:        Colors.textPrimary,
    marginBottom: 12,
    textAlign:    'center',
  },
  successMessage: {
    fontSize:   15,
    color:      Colors.textSecondary,
    textAlign:  'center',
    lineHeight: 22,
  },
});
