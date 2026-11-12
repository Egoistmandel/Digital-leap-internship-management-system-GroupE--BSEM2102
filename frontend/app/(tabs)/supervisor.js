/**
 * Supervisor Dashboard — Digital LEAP
 * Shared by: Academic Supervisor, Faculty Coordinator, Faculty Mentor
 *
 * FR-08: Review logbooks  | FR-09: Schedule & record visits
 * FR-11: Submit academic marks
 */

import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, RefreshControl, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { Colors } from '../../constants/colors';
import { getRoleLabel } from '../../constants/roles';
import Card from '../../components/Card';

function MenuRow({ icon, label, sublabel, badge, onPress }) {
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
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
      <Text style={styles.menuArrow}>›</Text>
    </TouchableOpacity>
  );
}

export default function SupervisorDashboard() {
  const { user, logout, hasRole } = useAuth();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  // Determine display role for the header
  const primaryRole = (user?.roles ?? []).find((r) =>
    ['academic_supervisor', 'faculty_coordinator', 'faculty_mentor'].includes(r)
  ) ?? 'academic_supervisor';

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

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
          <Text style={styles.role}>{getRoleLabel(primaryRole)}</Text>
          <Text style={styles.name}>{user?.full_name ?? 'Supervisor'}</Text>
        </View>
        <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* Assigned students */}
      <Text style={styles.sectionTitle}>My Students</Text>
      <Card>
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>👨‍🎓</Text>
          <Text style={styles.emptyText}>
            Assigned students will appear here once placements are confirmed.
          </Text>
        </View>
      </Card>

      {/* Logbooks */}
      <Text style={styles.sectionTitle}>Logbook Reviews</Text>
      <Card style={styles.menuCard}>
        <MenuRow
          icon="📝"
          label="Pending Reviews"
          sublabel="Logbook entries awaiting your review"
          badge={0}
          onPress={() => router.push('/logbook')}
        />
        <MenuRow
          icon="✅"
          label="Reviewed Entries"
          sublabel="Entries you have approved or returned"
          onPress={() => router.push('/logbook')}
        />
      </Card>

      {/* Visits */}
      <Text style={styles.sectionTitle}>Supervisory Visits</Text>
      <Card style={styles.menuCard}>
        <MenuRow
          icon="📅"
          label="Schedule Visit"
          sublabel="Arrange a site visit for an assigned student"
          onPress={() => Alert.alert('Schedule Visit', 'Visit scheduling will be available in the next update. Use the API endpoint POST /visits to schedule a visit.')}
        />
        <MenuRow
          icon="📋"
          label="Visit Reports"
          sublabel="Submit or view visit reports"
          onPress={() => Alert.alert('Visit Reports', 'Visit reports will be available in the next update.')}
        />
      </Card>

      {/* Assessment — available to supervisors who can submit marks */}
      <Text style={styles.sectionTitle}>Assessment</Text>
      <Card style={styles.menuCard}>
        <MenuRow
          icon="📊"
          label="Submit Academic Marks"
          sublabel="Enter marks for assigned students"
          onPress={() => router.push('/assessment/marks')}
        />
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

  emptyState: { alignItems: 'center', paddingVertical: 16 },
  emptyIcon:  { fontSize: 36, marginBottom: 8 },
  emptyText:  { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },

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
  badge: {
    backgroundColor: Colors.error,
    borderRadius:    12,
    paddingHorizontal: 8,
    paddingVertical:   2,
    marginRight:     8,
  },
  badgeText: { color: Colors.white, fontSize: 11, fontWeight: '700' },
});
