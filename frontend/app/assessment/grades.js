/**
 * Grades Management Screen — Digital LEAP
 * Coordinator: compute, verify grades. Management: approve grades.
 * FR-11: Compute grades  |  FR-12: Management approval before publication.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, RefreshControl, Alert,
} from 'react-native';
import { useAuth } from '../../hooks/useAuth';
import { assessmentService } from '../../services/api';
import { Colors } from '../../constants/colors';
import { Roles } from '../../constants/roles';
import ScreenWrapper from '../../components/ScreenWrapper';
import Card from '../../components/Card';
import StatusBadge from '../../components/StatusBadge';
import Button from '../../components/Button';

// Map grade status to badge-compatible values
function gradeStatusBadge(status) {
  const map = {
    pending:                'pending',
    computed:               'submitted',
    coordinator_verified:   'coordinator_approved',
    management_approved:    'confirmed',
    published:              'completed',
  };
  return map[status] ?? 'pending';
}

export default function GradesScreen() {
  const { hasRole } = useAuth();
  const [grades,     setGrades]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState('');

  const isCoordinator = hasRole(Roles.LEAP_COORDINATOR);
  const isManagement  = hasRole(Roles.MANAGEMENT);

  const fetchGrades = useCallback(async () => {
    const result = await assessmentService.listAllGrades();
    if (result.success) {
      setGrades(result.data ?? []);
      setError('');
    } else {
      setError(result.message);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { fetchGrades(); }, [fetchGrades]);

  async function handleCompute(placementId) {
    Alert.alert(
      'Compute Grade',
      'This will recalculate the weighted grade from all submitted marks. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Compute',
          onPress: async () => {
            const r = await assessmentService.computeGrade(placementId);
            if (r.success) {
              Alert.alert(
                'Grade Computed',
                `Score: ${r.data.computed_score}%\nBand: ${r.data.grade_band}` +
                (r.data.notes?.length ? `\n\nNotes: ${r.data.notes.join(' ')}` : '')
              );
              fetchGrades();
            } else {
              Alert.alert('Error', r.message);
            }
          },
        },
      ]
    );
  }

  async function handleVerify(placementId) {
    Alert.alert(
      'Verify Grade',
      'Verify this grade and send to management for approval?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Verify',
          onPress: async () => {
            const r = await assessmentService.verifyGrade(placementId);
            if (r.success) fetchGrades();
            else Alert.alert('Error', r.message);
          },
        },
      ]
    );
  }

  async function handleApprove(placementId) {
    Alert.alert(
      'Approve Result',
      'Approve this result? The coordinator will then be able to publish it to the student.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            const r = await assessmentService.approveGrade(placementId, {});
            if (r.success) fetchGrades();
            else Alert.alert('Error', r.message);
          },
        },
      ]
    );
  }

  async function handlePublish(placementId, studentName) {
    Alert.alert(
      'Publish Result',
      `Publish the result for ${studentName}? They will be notified immediately.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Publish',
          onPress: async () => {
            const r = await assessmentService.publishGrade(placementId);
            if (r.success) fetchGrades();
            else Alert.alert('Error', r.message);
          },
        },
      ]
    );
  }

  const renderItem = ({ item }) => (
    <Card style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.info}>
          <Text style={styles.studentName}>{item.student_name}</Text>
          <Text style={styles.orgName}>{item.org_name}</Text>
        </View>
        <View style={styles.scoreBlock}>
          <Text style={styles.score}>
            {item.computed_score != null ? `${item.computed_score}%` : '—'}
          </Text>
          <Text style={styles.band}>{item.grade_band ?? '—'}</Text>
        </View>
      </View>

      <StatusBadge status={gradeStatusBadge(item.status)} style={{ marginBottom: 10 }} />

      {item.computation_notes ? (
        <Text style={styles.notes} numberOfLines={2}>{item.computation_notes}</Text>
      ) : null}

      {/* Coordinator actions */}
      {isCoordinator && (
        <View style={styles.actions}>
          {item.status === 'pending' || item.status === 'computed' ? (
            <Button
              title="Compute"
              onPress={() => handleCompute(item.placement_id)}
              style={styles.actionBtn}
            />
          ) : null}
          {item.status === 'computed' ? (
            <Button
              title="Verify"
              variant="secondary"
              onPress={() => handleVerify(item.placement_id)}
              style={styles.actionBtn}
            />
          ) : null}
          {item.status === 'management_approved' ? (
            <Button
              title="Publish"
              onPress={() => handlePublish(item.placement_id, item.student_name)}
              style={styles.actionBtn}
            />
          ) : null}
        </View>
      )}

      {/* Management actions */}
      {isManagement && item.status === 'coordinator_verified' ? (
        <View style={styles.actions}>
          <Button
            title="Approve Result"
            onPress={() => handleApprove(item.placement_id)}
            style={styles.actionBtn}
          />
        </View>
      ) : null}
    </Card>
  );

  if (loading) {
    return (
      <ScreenWrapper scrollable={false}>
        <Text style={styles.loadingText}>Loading grades…</Text>
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

      {/* Grade pipeline legend */}
      <View style={styles.pipeline}>
        {['Pending', 'Computed', 'Verified', 'Approved', 'Published'].map((step, i, arr) => (
          <View key={step} style={styles.pipelineStep}>
            <Text style={styles.pipelineText}>{step}</Text>
            {i < arr.length - 1 && <Text style={styles.pipelineArrow}>›</Text>}
          </View>
        ))}
      </View>

      <FlatList
        data={grades}
        keyExtractor={(item) => String(item.grade_id)}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => {
            setRefreshing(true); fetchGrades();
          }} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🏆</Text>
            <Text style={styles.emptyText}>No grade records yet.</Text>
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

  pipeline: {
    flexDirection:   'row',
    justifyContent:  'center',
    alignItems:      'center',
    backgroundColor: Colors.surface,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    flexWrap:        'wrap',
    gap:             4,
  },
  pipelineStep:  { flexDirection: 'row', alignItems: 'center' },
  pipelineText:  { fontSize: 11, color: Colors.textSecondary, fontWeight: '600' },
  pipelineArrow: { fontSize: 14, color: Colors.textMuted, marginHorizontal: 4 },

  card:    { marginBottom: 12 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  info:    { flex: 1 },
  studentName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  orgName:     { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },

  scoreBlock: { alignItems: 'flex-end' },
  score: { fontSize: 22, fontWeight: '900', color: Colors.primary },
  band:  { fontSize: 14, fontWeight: '700', color: Colors.accent },

  notes: { fontSize: 12, color: Colors.textMuted, marginBottom: 8, lineHeight: 16 },

  actions:   { flexDirection: 'row', gap: 8, marginTop: 8 },
  actionBtn: { flex: 1 },

  emptyState: { alignItems: 'center', paddingTop: 60 },
  emptyIcon:  { fontSize: 48, marginBottom: 12 },
  emptyText:  { fontSize: 15, color: Colors.textSecondary },
});
