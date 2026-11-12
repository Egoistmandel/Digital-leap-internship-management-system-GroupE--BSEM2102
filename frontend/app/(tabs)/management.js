/**
 * Management Dashboard — Digital LEAP
 *
 * FR-12: Approve results before publication
 * FR-14: Access summary reports
 */

import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { Colors } from '../../constants/colors';
import Card from '../../components/Card';

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

export default function ManagementDashboard() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

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
          <Text style={styles.role}>University Management</Text>
          <Text style={styles.name}>{user?.full_name ?? 'Management'}</Text>
        </View>
        <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* Results approval */}
      <Text style={styles.sectionTitle}>Results Approval</Text>
      <Card style={styles.menuCard}>
        <MenuRow
          icon="🏆"
          label="Approve Final Results"
          sublabel="Review and approve computed grades before publication"
          onPress={() => router.push('/assessment/grades')}
        />
      </Card>

      {/* Reports */}
      <Text style={styles.sectionTitle}>Programme Reports</Text>
      <Card style={styles.menuCard}>
        <MenuRow
          icon="📈"
          label="Placement Summary"
          sublabel="Overview of all student placements and statuses"
          onPress={() => router.push('/reports/placements')}
        />
        <MenuRow
          icon="📉"
          label="Progress Summary"
          sublabel="Logbook, visit completion and supervisor activity"
          onPress={() => router.push('/reports/progress')}
        />
        <MenuRow
          icon="🎓"
          label="Results Summary"
          sublabel="Final grades, pass rates and completion statistics"
          onPress={() => router.push('/reports/results')}
        />
      </Card>

      {/* Information notice */}
      <View style={styles.notice}>
        <Text style={styles.noticeText}>
          🔒 You have read-only access to programme summaries and can approve
          final results. Individual student records are accessible only through
          the reports view in accordance with university privacy policy.
        </Text>
      </View>
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

  notice: {
    backgroundColor: '#EFF6FF',
    borderRadius:    10,
    padding:         14,
    borderLeftWidth: 3,
    borderLeftColor: Colors.info,
    marginTop:       8,
  },
  noticeText: { fontSize: 13, color: Colors.info, lineHeight: 20 },
});
