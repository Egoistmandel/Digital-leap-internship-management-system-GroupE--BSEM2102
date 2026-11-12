/**
 * Placement Report Screen — Digital LEAP
 * FR-14: Coordinator and Management generate placement summary reports.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  RefreshControl,
} from 'react-native';
import { reportService } from '../../services/api';
import { Colors } from '../../constants/colors';
import ScreenWrapper from '../../components/ScreenWrapper';
import Card from '../../components/Card';
import StatusBadge from '../../components/StatusBadge';

function StatPill({ label, value, color }) {
  return (
    <View style={[styles.pill, { borderLeftColor: color }]}>
      <Text style={[styles.pillValue, { color }]}>{value}</Text>
      <Text style={styles.pillLabel}>{label}</Text>
    </View>
  );
}

export default function PlacementReportScreen() {
  const [report,    setReport]    = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [refreshing,setRefreshing]= useState(false);
  const [error,     setError]     = useState('');

  const fetchReport = useCallback(async () => {
    const result = await reportService.placements();
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
        <Text style={styles.loadingText}>Generating report…</Text>
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

  const statusColors = {
    pending:              Colors.warning,
    coordinator_approved: Colors.info,
    awaiting_host:        '#7C3AED',
    confirmed:            Colors.success,
    active:               Colors.success,
    completed:            Colors.textSecondary,
    rejected:             Colors.error,
  };

  return (
    <ScreenWrapper scrollable={false} contentStyle={{ padding: 0 }}>
      <FlatList
        data={report?.placements ?? []}
        keyExtractor={(item) => String(item.placement_id)}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => {
            setRefreshing(true); fetchReport();
          }} />
        }
        ListHeaderComponent={() => (
          <View style={styles.header}>
            {/* Summary stats */}
            <Text style={styles.reportTitle}>Placement Report</Text>
            <Text style={styles.generatedAt}>
              Generated: {report?.generated_at
                ? new Date(report.generated_at).toLocaleString() : '—'}
            </Text>

            <View style={styles.totalBox}>
              <Text style={styles.totalLabel}>Total Placements</Text>
              <Text style={styles.totalValue}>{report?.total ?? 0}</Text>
            </View>

            <Text style={styles.sectionLabel}>By Status</Text>
            <View style={styles.pillRow}>
              {(report?.status_summary ?? []).map((s) => (
                <StatPill
                  key={s.status}
                  label={s.status.replace(/_/g, ' ')}
                  value={s.count}
                  color={statusColors[s.status] ?? Colors.textSecondary}
                />
              ))}
            </View>

            <Text style={styles.sectionLabel}>All Placements</Text>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyText}>No placements found.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Card style={styles.row}>
            <View style={styles.rowTop}>
              <View style={styles.rowInfo}>
                <Text style={styles.studentName}>{item.student_name}</Text>
                <Text style={styles.studentNum}>{item.student_number ?? '—'}</Text>
                <Text style={styles.orgName}>{item.org_name}</Text>
                <Text style={styles.vacTitle}>{item.vacancy_title}</Text>
              </View>
              <View style={styles.rowRight}>
                <StatusBadge status={item.status} />
                {item.supervisor_name ? (
                  <Text style={styles.supName} numberOfLines={1}>
                    {item.supervisor_name}
                  </Text>
                ) : null}
              </View>
            </View>
            {item.start_date ? (
              <Text style={styles.dates}>
                {item.start_date} → {item.end_date ?? '—'}
              </Text>
            ) : null}
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

  totalBox: {
    backgroundColor: Colors.primary,
    borderRadius:    12,
    padding:         16,
    flexDirection:   'row',
    justifyContent:  'space-between',
    alignItems:      'center',
    marginBottom:    16,
  },
  totalLabel: { fontSize: 15, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
  totalValue: { fontSize: 36, fontWeight: '900', color: Colors.white },

  sectionLabel: {
    fontSize: 12, fontWeight: '700', color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10,
  },

  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  pill: {
    backgroundColor: Colors.surface,
    borderRadius:    8,
    padding:         10,
    borderLeftWidth: 3,
    minWidth:        80,
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 1 },
    shadowOpacity:   0.05,
    shadowRadius:    2,
    elevation:       1,
  },
  pillValue: { fontSize: 20, fontWeight: '800' },
  pillLabel: { fontSize: 11, color: Colors.textSecondary, marginTop: 2, textTransform: 'capitalize' },

  row:     { marginHorizontal: 16, marginBottom: 10 },
  rowTop:  { flexDirection: 'row', justifyContent: 'space-between' },
  rowInfo: { flex: 1, marginRight: 8 },
  rowRight:{ alignItems: 'flex-end', gap: 4 },

  studentName: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  studentNum:  { fontSize: 11, color: Colors.textMuted },
  orgName:     { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  vacTitle:    { fontSize: 11, color: Colors.info },
  supName:     { fontSize: 11, color: Colors.textMuted, maxWidth: 100 },
  dates:       { fontSize: 11, color: Colors.textMuted, marginTop: 6 },

  emptyState: { alignItems: 'center', paddingTop: 60 },
  emptyIcon:  { fontSize: 48, marginBottom: 12 },
  emptyText:  { fontSize: 15, color: Colors.textSecondary },
});
