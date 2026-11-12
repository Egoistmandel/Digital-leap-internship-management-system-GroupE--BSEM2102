/**
 * Progress Report Screen — Digital LEAP
 * FR-14: Logbook completion, visit completion, attendance summary per placement.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl,
} from 'react-native';
import { reportService } from '../../services/api';
import { Colors } from '../../constants/colors';
import ScreenWrapper from '../../components/ScreenWrapper';
import Card from '../../components/Card';

function ProgressBar({ percent, color }) {
  const clamped = Math.min(Math.max(percent, 0), 100);
  return (
    <View style={styles.barTrack}>
      <View style={[styles.barFill, { width: `${clamped}%`, backgroundColor: color }]} />
    </View>
  );
}

function MetricRow({ label, value, total, color }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <View style={styles.metricRow}>
      <View style={styles.metricTop}>
        <Text style={styles.metricLabel}>{label}</Text>
        <Text style={[styles.metricValue, { color }]}>
          {value}/{total}
        </Text>
      </View>
      <ProgressBar percent={pct} color={color} />
    </View>
  );
}

export default function ProgressReportScreen() {
  const [report,     setReport]     = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState('');

  const fetchReport = useCallback(async () => {
    const result = await reportService.progress();
    if (result.success) {
      setReport(result.data);
      setError('');
    } else {
      setError(result.message);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  if (loading) {
    return (
      <ScreenWrapper scrollable={false}>
        <Text style={styles.loadingText}>Generating progress report…</Text>
      </ScreenWrapper>
    );
  }

  if (error) {
    return (
      <ScreenWrapper scrollable={false}>
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </ScreenWrapper>
    );
  }

  // Compute totals for summary bar
  const rows        = report?.placements ?? [];
  const totalHours  = rows.reduce((s, r) => s + parseFloat(r.total_hours_logged ?? 0), 0);
  const totalEntries= rows.reduce((s, r) => s + parseInt(r.logbook_entries_total ?? 0), 0);
  const totalApproved = rows.reduce((s, r) => s + parseInt(r.logbook_approved ?? 0), 0);

  return (
    <ScreenWrapper scrollable={false} contentStyle={{ padding: 0 }}>
      <FlatList
        data={rows}
        keyExtractor={(item) => String(item.placement_id)}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => {
            setRefreshing(true); fetchReport();
          }} />
        }
        ListHeaderComponent={() => (
          <View style={styles.header}>
            <Text style={styles.reportTitle}>Progress Report</Text>
            <Text style={styles.generatedAt}>
              Generated: {report?.generated_at
                ? new Date(report.generated_at).toLocaleString() : '—'}
            </Text>

            {/* Programme-wide summary */}
            <View style={styles.summaryRow}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{rows.length}</Text>
                <Text style={styles.summaryLabel}>Active Placements</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{totalEntries}</Text>
                <Text style={styles.summaryLabel}>Total Logbook Entries</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{Math.round(totalHours)}h</Text>
                <Text style={styles.summaryLabel}>Total Hours Logged</Text>
              </View>
            </View>

            <Text style={styles.sectionLabel}>Per Student</Text>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text style={styles.emptyText}>
              No active placements found. Progress data appears once placements are confirmed.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Card style={styles.card}>
            {/* Student header */}
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.studentName}>{item.student_name}</Text>
                <Text style={styles.studentMeta}>
                  {item.student_number ?? '—'} · {item.org_name}
                </Text>
              </View>
              <View style={[
                styles.statusDot,
                { backgroundColor: item.placement_status === 'active'
                    ? Colors.success : Colors.textMuted }
              ]} />
            </View>

            {/* Logbook metrics */}
            <MetricRow
              label="Logbook Approved"
              value={parseInt(item.logbook_approved ?? 0)}
              total={parseInt(item.logbook_entries_total ?? 0)}
              color={Colors.success}
            />
            {parseInt(item.logbook_pending_review ?? 0) > 0 && (
              <Text style={styles.pendingNote}>
                ⏳ {item.logbook_pending_review} entries awaiting review
              </Text>
            )}
            {parseInt(item.logbook_revision_needed ?? 0) > 0 && (
              <Text style={styles.revisionNote}>
                ✏️ {item.logbook_revision_needed} entries need revision
              </Text>
            )}

            {/* Visit metrics */}
            <MetricRow
              label="Visits Completed"
              value={parseInt(item.visits_completed ?? 0)}
              total={parseInt(item.visits_total ?? 0)}
              color={Colors.info}
            />

            {/* Attendance */}
            <MetricRow
              label="Attendance Verified"
              value={parseInt(item.attendance_verified ?? 0)}
              total={parseInt(item.attendance_records ?? 0)}
              color={Colors.accent}
            />

            {/* Hours */}
            <View style={styles.hoursRow}>
              <Text style={styles.hoursLabel}>Total Hours Logged</Text>
              <Text style={styles.hoursValue}>
                {parseFloat(item.total_hours_logged ?? 0).toFixed(1)}h
              </Text>
            </View>
          </Card>
        )}
        contentContainerStyle={styles.list}
      />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  loadingText: { textAlign: 'center', marginTop: 32, color: Colors.textSecondary },
  list:        { paddingBottom: 40 },

  errorBox: {
    backgroundColor: Colors.locked, borderRadius: 8, padding: 12, margin: 16,
  },
  errorText: { color: Colors.lockedText },

  header:      { padding: 16 },
  reportTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, marginBottom: 2 },
  generatedAt: { fontSize: 11, color: Colors.textMuted, marginBottom: 16 },

  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  summaryCard: {
    flex:            1,
    backgroundColor: Colors.surface,
    borderRadius:    10,
    padding:         12,
    alignItems:      'center',
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 1 },
    shadowOpacity:   0.05,
    shadowRadius:    3,
    elevation:       1,
  },
  summaryValue: { fontSize: 22, fontWeight: '900', color: Colors.primary },
  summaryLabel: { fontSize: 11, color: Colors.textSecondary, textAlign: 'center', marginTop: 4 },

  sectionLabel: {
    fontSize: 12, fontWeight: '700', color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10,
  },

  card:        { marginHorizontal: 16, marginBottom: 12 },
  cardHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  studentName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  studentMeta: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  statusDot:   { width: 10, height: 10, borderRadius: 5, marginTop: 4 },

  metricRow:  { marginBottom: 10 },
  metricTop:  { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  metricLabel:{ fontSize: 12, color: Colors.textSecondary },
  metricValue:{ fontSize: 12, fontWeight: '700' },

  barTrack: {
    height: 6, backgroundColor: Colors.border,
    borderRadius: 3, overflow: 'hidden',
  },
  barFill: { height: 6, borderRadius: 3 },

  pendingNote:  { fontSize: 11, color: Colors.warning, marginBottom: 4 },
  revisionNote: { fontSize: 11, color: Colors.error,   marginBottom: 4 },

  hoursRow:  { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.border },
  hoursLabel:{ fontSize: 13, color: Colors.textSecondary },
  hoursValue:{ fontSize: 15, fontWeight: '700', color: Colors.primary },

  emptyState: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 24 },
  emptyIcon:  { fontSize: 48, marginBottom: 12 },
  emptyText:  { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
});
