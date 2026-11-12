/**
 * Placements List Screen — Digital LEAP
 * Coordinator: review all placements and update statuses (FR-04, FR-06).
 * Others: view their relevant placements.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, RefreshControl, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { placementService } from '../../services/api';
import { Colors } from '../../constants/colors';
import { Roles } from '../../constants/roles';
import ScreenWrapper from '../../components/ScreenWrapper';
import Card from '../../components/Card';
import StatusBadge from '../../components/StatusBadge';
import Button from '../../components/Button';

export default function PlacementsScreen() {
  const { user, hasRole } = useAuth();
  const router = useRouter();
  const [placements, setPlacements] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState('');

  const isCoordinator = hasRole(Roles.LEAP_COORDINATOR);

  const fetchPlacements = useCallback(async () => {
    const result = await placementService.list();
    if (result.success) {
      setPlacements(result.data ?? []);
      setError('');
    } else {
      setError(result.message);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { fetchPlacements(); }, [fetchPlacements]);

  async function handleApprove(placement_id) {
    Alert.alert(
      'Approve Placement',
      'Send this placement to the host organisation for confirmation?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve & Send',
          onPress: async () => {
            const r = await placementService.updateStatus(placement_id, {
              status: 'awaiting_host',
            });
            if (r.success) fetchPlacements();
            else Alert.alert('Error', r.message);
          },
        },
      ]
    );
  }

  async function handleReject(placement_id) {
    Alert.alert(
      'Reject Placement',
      'Reject this placement application?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            const r = await placementService.updateStatus(placement_id, {
              status: 'rejected',
              rejection_reason: 'Rejected by coordinator.',
            });
            if (r.success) fetchPlacements();
            else Alert.alert('Error', r.message);
          },
        },
      ]
    );
  }

  const renderItem = ({ item }) => (
    <Card style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.cardInfo}>
          <Text style={styles.studentName}>{item.student_name}</Text>
          <Text style={styles.orgName}>{item.org_name}</Text>
          <Text style={styles.vacTitle}>{item.vacancy_title}</Text>
        </View>
        <StatusBadge status={item.status} />
      </View>

      {item.supervisor_name ? (
        <Text style={styles.supervisor}>Supervisor: {item.supervisor_name}</Text>
      ) : null}

      {item.start_date ? (
        <Text style={styles.dates}>{item.start_date} → {item.end_date}</Text>
      ) : null}

      {/* Coordinator actions */}
      {isCoordinator && item.status === 'pending' ? (
        <View style={styles.actions}>
          <Button
            title="Approve"
            onPress={() => handleApprove(item.placement_id)}
            style={styles.actionBtn}
          />
          <Button
            title="Reject"
            variant="danger"
            onPress={() => handleReject(item.placement_id)}
            style={styles.actionBtn}
          />
        </View>
      ) : null}

      <TouchableOpacity
        onPress={() => Alert.alert(
          'Placement Details',
          `Student: ${item.student_name}\nOrg: ${item.org_name}\nPosition: ${item.vacancy_title}\nStatus: ${item.status}\nDates: ${item.start_date ?? 'TBC'} → ${item.end_date ?? 'TBC'}${item.supervisor_name ? '\nSupervisor: ' + item.supervisor_name : ''}`
        )}
        style={styles.viewLink}
      >
        <Text style={styles.viewLinkText}>View Details →</Text>
      </TouchableOpacity>
    </Card>
  );

  if (loading) {
    return (
      <ScreenWrapper scrollable={false}>
        <Text style={styles.loadingText}>Loading placements…</Text>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper scrollable={false} contentStyle={{ padding: 0 }}>
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <FlatList
        data={placements}
        keyExtractor={(item) => String(item.placement_id)}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => {
            setRefreshing(true); fetchPlacements();
          }} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyText}>No placements found.</Text>
          </View>
        }
        renderItem={renderItem}
      />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  list:        { padding: 16, paddingBottom: 40 },
  loadingText: { textAlign: 'center', marginTop: 32, color: Colors.textSecondary },

  errorBox: {
    backgroundColor: Colors.locked, borderRadius: 8, padding: 12, margin: 16,
  },
  errorText: { color: Colors.lockedText },

  card:    { marginBottom: 12 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  cardInfo:    { flex: 1, marginRight: 8 },
  studentName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  orgName:     { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  vacTitle:    { fontSize: 12, color: Colors.info, marginTop: 2 },
  supervisor:  { fontSize: 12, color: Colors.textSecondary, marginBottom: 4 },
  dates:       { fontSize: 12, color: Colors.textMuted, marginBottom: 8 },

  actions:   { flexDirection: 'row', gap: 8, marginBottom: 8 },
  actionBtn: { flex: 1 },

  viewLink:     { alignSelf: 'flex-end' },
  viewLinkText: { color: Colors.primary, fontSize: 13, fontWeight: '600' },

  emptyState: { alignItems: 'center', paddingTop: 60 },
  emptyIcon:  { fontSize: 48, marginBottom: 12 },
  emptyText:  { fontSize: 15, color: Colors.textSecondary },
});
