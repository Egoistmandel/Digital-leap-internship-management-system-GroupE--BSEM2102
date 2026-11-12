/**
 * Student Dashboard — Digital LEAP
 *
 * Shows the student's internship status, quick actions, and notifications.
 * FR-03: Apply for placement | FR-07: Submit logbook | FR-04: View submissions
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { placementService } from '../../services/api';
import { Colors } from '../../constants/colors';
import ScreenWrapper from '../../components/ScreenWrapper';
import Card from '../../components/Card';
import StatusBadge from '../../components/StatusBadge';
import Button from '../../components/Button';

// Quick-action tile component
function ActionTile({ icon, label, onPress, color }) {
  return (
    <TouchableOpacity
      style={[styles.tile, { borderTopColor: color }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={styles.tileIcon}>{icon}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function StudentDashboard() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [placement, setPlacement] = useState(null);
  const [loading,    setLoading]    = useState(true);

  const fetchPlacement = useCallback(async () => {
    const result = await placementService.list();
    if (result.success) {
      const active = (result.data ?? []).find(
        (p) => ['confirmed', 'active', 'pending', 'awaiting_host', 'coordinator_approved'].includes(p.status)
      );
      setPlacement(active ?? null);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { fetchPlacement(); }, [fetchPlacement]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPlacement();
  }, [fetchPlacement]);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Welcome */}
      <View style={styles.welcomeBar}>
        <View>
          <Text style={styles.greeting}>Welcome back,</Text>
          <Text style={styles.name}>{user?.full_name ?? 'Student'}</Text>
        </View>
        <TouchableOpacity
          onPress={logout}
          style={styles.logoutBtn}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
        >
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* Placement status card */}
      <Card>
        <Text style={styles.sectionTitle}>My Internship</Text>
        {placement ? (
          <View>
            <Text style={styles.orgName}>{placement.org_name ?? 'Host Organisation'}</Text>
            <Text style={styles.orgRole}>{placement.vacancy_title ?? 'Internship'}</Text>
            <StatusBadge status={placement.status} style={{ marginTop: 8 }} />
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyText}>No active placement yet.</Text>
            <Button
              title="Apply for Placement"
              onPress={() => router.push('/placements/apply')}
              style={{ marginTop: 12 }}
            />
          </View>
        )}
      </Card>

      {/* Quick actions */}
      <Text style={styles.sectionHeader}>Quick Actions</Text>
      <View style={styles.tileGrid}>
        <ActionTile
          icon="📝"
          label="Logbook"
          color={Colors.primary}
          onPress={() => router.push('/logbook')}
        />
        <ActionTile
          icon="🏢"
          label="Apply"
          color={Colors.accent}
          onPress={() => router.push('/placements/apply')}
        />
        <ActionTile
          icon="📊"
          label="Results"
          color={Colors.success}
          onPress={() => router.push('/results')}
        />
        <ActionTile
          icon="🔔"
          label="Notifications"
          color={Colors.info}
          onPress={() => router.push('/notifications')}
        />
      </View>

      {/* Info notice */}
      <View style={styles.notice}>
        <Text style={styles.noticeText}>
          💡 Logbook entries must be submitted weekly and fall within your placement dates.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll:  { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 40 },

  welcomeBar: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    alignItems:      'center',
    marginBottom:    20,
  },
  greeting: { fontSize: 14, color: Colors.textSecondary },
  name:     { fontSize: 20, fontWeight: '700', color: Colors.textPrimary },
  logoutBtn: {
    paddingHorizontal: 14,
    paddingVertical:   8,
    borderRadius:      8,
    borderWidth:       1,
    borderColor:       Colors.border,
  },
  logoutText: { fontSize: 13, color: Colors.textSecondary },

  sectionTitle: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary, marginBottom: 10 },
  sectionHeader: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary, marginVertical: 12 },

  orgName: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },
  orgRole: { fontSize: 14, color: Colors.textSecondary, marginTop: 2 },

  emptyState: { alignItems: 'center', paddingVertical: 16 },
  emptyIcon:  { fontSize: 36, marginBottom: 8 },
  emptyText:  { fontSize: 14, color: Colors.textSecondary },

  tileGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           12,
    marginBottom:  20,
  },
  tile: {
    width:           '47%',
    backgroundColor: Colors.surface,
    borderRadius:    12,
    padding:         16,
    borderTopWidth:  3,
    alignItems:      'center',
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 1 },
    shadowOpacity:   0.05,
    shadowRadius:    4,
    elevation:       2,
  },
  tileIcon:  { fontSize: 28, marginBottom: 8 },
  tileLabel: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },

  notice: {
    backgroundColor: '#EFF6FF',
    borderRadius:    10,
    padding:         14,
    borderLeftWidth: 3,
    borderLeftColor: Colors.info,
  },
  noticeText: { fontSize: 13, color: Colors.info, lineHeight: 20 },
});
