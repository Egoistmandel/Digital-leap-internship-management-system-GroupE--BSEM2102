/**
 * Logbook Screen — Digital LEAP
 * FR-07: Students view and submit weekly logbook entries.
 * FR-08: Supervisors see the same list with review actions.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { placementService, logbookService } from '../../services/api';
import { Colors } from '../../constants/colors';
import { Roles } from '../../constants/roles';
import ScreenWrapper from '../../components/ScreenWrapper';
import Card from '../../components/Card';
import StatusBadge from '../../components/StatusBadge';
import Button from '../../components/Button';

export default function LogbookScreen() {
  const { user, hasRole } = useAuth();
  const router = useRouter();

  const [placementId, setPlacementId] = useState(null);
  const [entries,    setEntries]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState('');

  const isStudent    = hasRole(Roles.STUDENT);
  const isSupervisor = hasRole(Roles.ACADEMIC_SUPERVISOR) ||
                       hasRole(Roles.FACULTY_COORDINATOR)  ||
                       hasRole(Roles.FACULTY_MENTOR);

  const loadData = useCallback(async () => {
    // First get placements to find the active one
    const plResult = await placementService.list();
    if (!plResult.success) {
      setError(plResult.message);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const activePl = (plResult.data ?? []).find(
      (p) => ['confirmed', 'active'].includes(p.status)
    );

    if (!activePl) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    setPlacementId(activePl.placement_id);

    const logResult = await logbookService.list(activePl.placement_id);
    if (logResult.success) {
      setEntries(logResult.data ?? []);
      setError('');
    } else {
      setError(logResult.message);
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const renderEntry = ({ item }) => (
    <Card style={styles.entryCard}>
      <View style={styles.entryTop}>
        <View>
          <Text style={styles.weekLabel}>Week {item.week_number}</Text>
          <Text style={styles.entryDate}>{item.entry_date}</Text>
        </View>
        <StatusBadge status={item.status} />
      </View>

      <Text style={styles.activities} numberOfLines={3}>{item.activities}</Text>

      <View style={styles.entryMeta}>
        <Text style={styles.metaText}>⏱ {item.hours_worked}h</Text>
        {item.last_comment ? (
          <Text style={styles.comment} numberOfLines={1}>
            💬 {item.last_comment}
          </Text>
        ) : null}
      </View>

      <View style={styles.entryActions}>
        <TouchableOpacity
          onPress={() => Alert.alert(
            `Week ${item.week_number} — ${item.entry_date}`,
            `Activities: ${item.activities}\n\nHours: ${item.hours_worked}\nStatus: ${item.status}${item.last_comment ? '\n\nSupervisor Comment: ' + item.last_comment : ''}`
          )}
          style={styles.viewBtn}
        >
          <Text style={styles.viewBtnText}>View</Text>
        </TouchableOpacity>

        {isSupervisor && item.status === 'submitted' ? (
          <TouchableOpacity
            onPress={() => Alert.alert(
              'Review Entry',
              `Week ${item.week_number}: ${item.activities.substring(0, 60)}...`,
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Approve', onPress: async () => {
                  const r = await logbookService.review(item.entry_id, { decision: 'approved' });
                  if (r.success) loadData();
                  else Alert.alert('Error', r.message);
                }},
                { text: 'Request Revision', onPress: async () => {
                  const r = await logbookService.review(item.entry_id, {
                    decision: 'revision_requested',
                    comments: 'Please provide more detail.',
                  });
                  if (r.success) loadData();
                  else Alert.alert('Error', r.message);
                }},
              ]
            )}
            style={styles.reviewBtn}
          >
            <Text style={styles.reviewBtnText}>Review</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </Card>
  );

  if (loading) {
    return (
      <ScreenWrapper scrollable={false}>
        <Text style={styles.loadingText}>Loading logbook…</Text>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper scrollable={false} contentStyle={{ padding: 0 }}>
      {/* Header bar */}
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>Logbook</Text>
        {isStudent && placementId ? (
          <Button
            title="+ New Entry"
            onPress={() => router.push('/logbook/submit')}
            style={styles.newBtn}
          />
        ) : null}
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {!placementId ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📝</Text>
          <Text style={styles.emptyText}>
            You don't have an active placement yet.{'\n'}
            Logbook entries will be available once your placement is confirmed.
          </Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => String(item.entry_id)}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => {
              setRefreshing(true); loadData();
            }} />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📝</Text>
              <Text style={styles.emptyText}>
                No logbook entries yet.{isStudent ? '\nTap "+ New Entry" to submit your first entry.' : ''}
              </Text>
            </View>
          }
          renderItem={renderEntry}
        />
      )}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  list:        { padding: 16, paddingBottom: 40 },
  loadingText: { textAlign: 'center', marginTop: 32, color: Colors.textSecondary },

  headerBar: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    alignItems:      'center',
    padding:         16,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  newBtn:      { paddingVertical: 8, paddingHorizontal: 14 },

  errorBox: {
    backgroundColor: Colors.locked, borderRadius: 8, padding: 12, margin: 16,
  },
  errorText: { color: Colors.lockedText },

  entryCard: { marginBottom: 12 },
  entryTop:  { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  weekLabel: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  entryDate: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },

  activities: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18, marginBottom: 8 },

  entryMeta: { flexDirection: 'row', gap: 12, marginBottom: 10 },
  metaText:  { fontSize: 12, color: Colors.textMuted },
  comment:   { fontSize: 12, color: Colors.info, flex: 1 },

  entryActions: { flexDirection: 'row', gap: 8 },
  viewBtn: {
    paddingHorizontal: 14,
    paddingVertical:   6,
    borderRadius:      6,
    borderWidth:       1,
    borderColor:       Colors.border,
  },
  viewBtnText:   { fontSize: 13, color: Colors.textSecondary },
  reviewBtn: {
    paddingHorizontal: 14,
    paddingVertical:   6,
    borderRadius:      6,
    backgroundColor:   Colors.primary,
  },
  reviewBtnText: { fontSize: 13, color: Colors.white, fontWeight: '600' },

  emptyState: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 24 },
  emptyIcon:  { fontSize: 48, marginBottom: 12 },
  emptyText:  { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
});
