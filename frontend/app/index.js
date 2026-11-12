/**
 * Splash / Entry Screen — Digital LEAP
 *
 * Checks auth state on app launch and routes the user to the correct place:
 * - Not logged in  → Login screen
 * - Logged in      → Role-based dashboard
 */

import { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../hooks/useAuth';
import { Colors } from '../constants/colors';
import { Roles } from '../constants/roles';

export default function SplashScreen() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace('/(auth)/login');
      return;
    }

    // Route to the correct dashboard based on primary role
    const roles = user.roles ?? [];

    if (roles.includes(Roles.LEAP_COORDINATOR)) {
      router.replace('/(tabs)/coordinator');
    } else if (roles.includes(Roles.MANAGEMENT)) {
      router.replace('/(tabs)/management');
    } else if (
      roles.includes(Roles.ACADEMIC_SUPERVISOR) ||
      roles.includes(Roles.FACULTY_COORDINATOR) ||
      roles.includes(Roles.FACULTY_MENTOR)
    ) {
      router.replace('/(tabs)/supervisor');
    } else if (roles.includes(Roles.HOST_SUPERVISOR)) {
      router.replace('/(tabs)/host');
    } else {
      // Default: student
      router.replace('/(tabs)/student');
    }
  }, [user, loading]);

  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <Text style={styles.logoText}>LEAP</Text>
        <Text style={styles.subtitle}>Internship Management System</Text>
        <Text style={styles.university}>Limkokwing University · Sierra Leone</Text>
      </View>
      <ActivityIndicator size="large" color={Colors.accent} style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: Colors.primary,
    alignItems:      'center',
    justifyContent:  'center',
    padding:         32,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoText: {
    fontSize:    64,
    fontWeight:  '900',
    color:       Colors.white,
    letterSpacing: 8,
  },
  subtitle: {
    fontSize:   18,
    color:      Colors.accent,
    fontWeight: '600',
    marginTop:  8,
    textAlign:  'center',
  },
  university: {
    fontSize:   13,
    color:      'rgba(255,255,255,0.7)',
    marginTop:  8,
    textAlign:  'center',
  },
  spinner: {
    marginTop: 32,
  },
});
