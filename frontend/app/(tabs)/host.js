/**
 * Host Supervisor Dashboard — Digital LEAP
 *
 * FR-06: Confirm/decline placement requests
 * FR-10: Submit host evaluations
 */

import { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, RefreshControl, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { placementService } from '../../services/api';
import { Colors } from '../../constants/colors';
import Card from '../../components/Card';
import StatusBadge from '../../components/StatusBadge';

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

export default function HostDashboard() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [placements, setPlacements] = useState([]);

  const fetchPlacements = useCallback(async () => {
    const result = await placementService.list();
    if (result.success) {
      setPlacements(result.data ?? []);
    }
    setRefreshing(false);
  }, []);

  useEffect(() => { fetchPlacements(); }, [fetchPlacements]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPlacements();
  }, [fetchPlacements]);

  const awaitingHost = placements.filter((p) => p.status === 'awaiting_host');
  const confirmed = placements.filter((p) => ['confirmed', 'active'].includes(p.status));

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
          <Text style={styles.role}>Host Supervisor</Text>
          <Text style={styles.name}>{user?.full_name ?? 'Supervisor'}</Text>
        </View>
        <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* Placement requests */}
      <Text style={styles.sectionTitle}>Placement Requests ({awaitingHost.length})</Text>
      {awaitingHost.length > 0 ? (
        awaitingHost.map((p) => (
          <Card key={p.placement_id}>
            <Text style={styles.studentName}>{p.student_name}</Text>
            <Text style={styles.orgName}>{p.vacancy_title}</Text>
            <StatusBadge status={p.status} style={{ marginTop: 8, marginBottom: 8 }} />
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.respondBtn, { backgroundColor: Colors.success }]}
                onPress={async () => {
                  const r = await placementService.updateStatus(p.placement_id, { status: 'confirmed' });
                  if (r.success) fetchPlacements();
                  else Alert.alert('Error', r.message);
                }}
              >
                <Text style={styles.respondBtnText}>Accept</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.respondBtn, { backgroundColor: Colors.error }]}
                onPress={async () => {
                  const r = await placementService.updateStatus(p.placement_id, {
                    status: 'rejected',
                    rejection_reason: 'Declined by host.',
                  });
                  if (r.success) fetchPlacements();
                  else Alert.alert('Error', r.message);
                }}
              >
                <Text style={styles.respondBtnText}>Decline</Text>
              </TouchableOpacity>
            </View>
          </Card>
        ))
      ) : (
        <Card>
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📨</Text>
            <Text style={styles.emptyText}>
              No incoming placement requests.
            </Text>
          </View>
        </Card>
      )}

      {/* Assigned interns */}
      <Text style={styles.sectionTitle}>Current Interns ({confirmed.length})</Text>
      {confirmed.length > 0 ? (
        confirmed.map((p) => (
          <Card key={p.placement_id}>
            <Text style={styles.studentName}>{p.student_name}</Text>
            <Text style={styles.orgName}>{p.vacancy_title}</Text>
            <StatusBadge status={p.status} style={{ marginTop: 6 }} />
          </Card>
        ))
      ) : (
        <Card>
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>👩‍💼</Text>
            <Text style={styles.emptyText}>
              No confirmed interns yet.
            </Text>
          </View>
        </Card>
      )}

      {/* Actions */}
      <Text style={styles.sectionTitle}>Actions</Text>
      <Card style={styles.menuCard}>
        <MenuRow
          icon="✅"
          label="Respond to Placement Request"
          sublabel="Accept or decline pending placement requests"
          onPress={() => router.push('/placements')}
        />
        <MenuRow
          icon="⭐"
          label="Submit Intern Evaluation"
          sublabel="Rate your intern's performance"
          onPress={() => router.push('/evaluation/submit')}
        />
        <MenuRow
          icon="🏢"
          label="Organisation Profile"
          sublabel="Update your organisation's details and vacancies"
          onPress={() => Alert.alert('Organisation Profile', 'This feature will be available in the next update. Use the API endpoint PATCH /hosts/{id}/status to manage your organisation.')}
        />
      </Card>

      {/* Privacy notice for GPS */}
      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>📍 Attendance Verification</Text>
        <Text style={styles.noticeText}>
          Interns may request GPS-based attendance confirmation during their
          placement. Location data is collected only with the intern's explicit
          consent and is used solely for attendance verification.
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

  studentName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  orgName:     { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  actions:     { flexDirection: 'row', gap: 8, marginTop: 8 },
  respondBtn:  { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  respondBtnText: { color: Colors.white, fontSize: 14, fontWeight: '600' },

  notice: {
    backgroundColor: '#F0FDF4',
    borderRadius:    10,
    padding:         14,
    borderLeftWidth: 3,
    borderLeftColor: Colors.success,
    marginTop:       8,
  },
  noticeTitle: { fontSize: 14, fontWeight: '700', color: Colors.success, marginBottom: 6 },
  noticeText:  { fontSize: 13, color: Colors.textSecondary, lineHeight: 20 },
});
