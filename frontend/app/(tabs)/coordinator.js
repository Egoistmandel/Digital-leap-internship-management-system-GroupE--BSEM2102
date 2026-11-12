/**
 * LEAP Coordinator Dashboard — Digital LEAP
 *
 * FR-02: Approve student/host accounts
 * FR-04: Match placements to vacancies
 * FR-09: Monitor progress
 * FR-14: Generate reports
 */

import { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { userService, placementService, assessmentService } from '../../services/api';
import { Colors } from '../../constants/colors';
import Card from '../../components/Card';

function StatCard({ value, label, color, icon }) {
  return (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function MenuRow({ icon, label, sublabel, onPress }) {
  return (
    <TouchableOpacity
      style={styles.menuRow}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={styles.menuIcon}>{icon}</Text>
      <View style={styles.menuText}>
        <Text style={styles.menuLabel}>{label}</Text>
        {sublabel ? <Text style={styles.menuSub}>{sublabel}</Text> : null}
      </View>
      <Text style={styles.menuArrow}>›</Text>
    </TouchableOpacity>
  );
}

export default function CoordinatorDashboard() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    pending_accounts:   0,
    pending_placements: 0,
    active_placements:  0,
    pending_results:    0,
  });

  const fetchStats = useCallback(async () => {
    const [pendResult, plResult, gradeResult] = await Promise.all([
      userService.listPending(),
      placementService.list(),
      assessmentService.listAllGrades(),
    ]);

    const pendingAccounts = pendResult.success ? (pendResult.data ?? []).length : 0;
    const placements = plResult.success ? (plResult.data ?? []) : [];
    const grades = gradeResult.success ? (gradeResult.data ?? []) : [];

    setStats({
      pending_accounts:   pendingAccounts,
      pending_placements:  placements.filter((p) => p.status === 'pending').length,
      active_placements:  placements.filter((p) => ['confirmed', 'active'].includes(p.status)).length,
      pending_results:    grades.filter((g) => g.status === 'coordinator_verified').length,
    });
    setRefreshing(false);
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchStats();
  }, [fetchStats]);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.role}>LEAP Coordinator</Text>
          <Text style={styles.name}>{user?.full_name ?? 'Coordinator'}</Text>
        </View>
        <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <Text style={styles.sectionTitle}>Overview</Text>
      <View style={styles.statsRow}>
        <StatCard value={stats.pending_accounts}   label="Pending Accounts"   color={Colors.warning} icon="👤" />
        <StatCard value={stats.pending_placements} label="Pending Placements" color={Colors.info}    icon="📋" />
        <StatCard value={stats.active_placements}  label="Active Placements"  color={Colors.success} icon="✅" />
        <StatCard value={stats.pending_results}    label="Awaiting Results"   color={Colors.accent}  icon="📊" />
      </View>

      {/* Account management */}
      <Text style={styles.sectionTitle}>Account Management</Text>
      <Card style={styles.menuCard}>
        <MenuRow icon="👤" label="Pending Approvals"   sublabel="Review new student and host accounts"       onPress={() => router.push('/admin/approvals')} />
        <MenuRow icon="🏢" label="Host Organisations"  sublabel="Manage and approve host organisation profiles" onPress={() => router.push('/placements')} />
        <MenuRow icon="🔓" label="Unlock Accounts"     sublabel="Manually unlock locked user accounts"       onPress={() => router.push('/admin/approvals')} />
      </Card>

      {/* Placement management */}
      <Text style={styles.sectionTitle}>Placement Management</Text>
      <Card style={styles.menuCard}>
        <MenuRow icon="📋" label="Placement Applications" sublabel="Review and match student applications"   onPress={() => router.push('/placements')} />
        <MenuRow icon="👨‍🏫" label="Allocate Supervisors"  sublabel="Assign academic supervisors to placements" onPress={() => router.push('/placements')} />
      </Card>

      {/* Assessment */}
      <Text style={styles.sectionTitle}>Assessment & Results</Text>
      <Card style={styles.menuCard}>
        <MenuRow icon="⚙️"  label="Configure Grade Components" sublabel="Set assessment components and weights" onPress={() => router.push('/assessment/config')} />
        <MenuRow icon="📊" label="Verify Grades"               sublabel="Review computed final grades"          onPress={() => router.push('/assessment/grades')} />
      </Card>

      {/* Reports */}
      <Text style={styles.sectionTitle}>Reports</Text>
      <Card style={styles.menuCard}>
        <MenuRow icon="📈" label="Placement Report"  sublabel="Summary of all placements and statuses" onPress={() => router.push('/reports/placements')} />
        <MenuRow icon="📉" label="Progress Report"   sublabel="Logbook and visit completion summary"   onPress={() => router.push('/reports/progress')} />
        <MenuRow icon="🏆" label="Results Report"    sublabel="Final grades and completion summary"    onPress={() => router.push('/reports/results')} />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll:  { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 40 },

  header: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginBottom:   20,
  },
  role: { fontSize: 13, color: Colors.textSecondary },
  name: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary },
  logoutBtn: {
    paddingHorizontal: 14,
    paddingVertical:   8,
    borderRadius:      8,
    borderWidth:       1,
    borderColor:       Colors.border,
  },
  logoutText: { fontSize: 13, color: Colors.textSecondary },

  sectionTitle: {
    fontSize:     14,
    fontWeight:   '700',
    color:        Colors.textSecondary,
    textTransform:'uppercase',
    letterSpacing: 0.8,
    marginTop:    20,
    marginBottom: 10,
  },

  statsRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           10,
    marginBottom:  8,
  },
  statCard: {
    width:           '47%',
    backgroundColor: Colors.surface,
    borderRadius:    10,
    padding:         14,
    borderLeftWidth: 4,
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 1 },
    shadowOpacity:   0.05,
    shadowRadius:    3,
    elevation:       1,
  },
  statIcon:  { fontSize: 22, marginBottom: 6 },
  statValue: { fontSize: 26, fontWeight: '800' },
  statLabel: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },

  menuCard: { padding: 0, overflow: 'hidden' },
  menuRow: {
    flexDirection:  'row',
    alignItems:     'center',
    padding:        16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  menuIcon:  { fontSize: 22, marginRight: 14 },
  menuText:  { flex: 1 },
  menuLabel: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  menuSub:   { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  menuArrow: { fontSize: 22, color: Colors.textMuted },
});
