/**
 * Results Report Screen — Digital LEAP
 * FR-14: Coordinator and Management view final grade summary.
 * FR-12: Shows approval and publication status per grade.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl,
} from 'react-native';
import { reportService } from '../../services/api';
import { Colors } from '../../constants/colors';
import ScreenWrapper from '../../components/ScreenWrapper';
import Card from '../../components/Card';
import StatusBadge from '../../components/StatusBadge';

function GradeBadge({ band }) {
  const color = band === 'F' || band === 'N/A'
    ? Colors.error
    : band === 'A' ? Colors.success
    : band === 'B' ? Colors.info
    : Colors.accent;

  return (
    <View style={[styles.gradeBadge, { borderColor: color }]}>
      <Text style={[styles.gradeBandText, { color }]}>{band ?? '—'}</Text>
    </View>
  );
}

export default function ResultsReportScreen() {
  const [report,     setReport]     = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState('');

  const fetchReport = useCallback(async () => {
    const result = await reportService.results();
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
        <Text style={styles.loadingText}>Generating results report…</Text>
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

  const grades     = report?.grades ?? [];
  const bandSummary= report?.band_summary ?? {};

  // Grade status to badge mapping
  const gradeStatusMap = {
    pending:              'pending',
    computed:             'submitted',
    coordinator_verified: 'coordinator_approved',
    management_approved:  'confirmed',
    published:            'completed',
  };

  return (
    <ScreenWrapper scrollable={false} contentStyle={{ padding: 0 }}>
      <FlatList
        data={grades}
        keyExtractor={(item) => String(item.grade_id)}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => {
            setRefreshing(true); fetchReport();
          }} />
        }
        ListHeaderComponent={() => (
          <View style={styles.header}>
            <Text style={styles.reportTitle}>Results Report</Text>
            <Text style={styles.generatedAt}>
              Generated: {report?.generated_at
                ? new Date(report.generated_at).toLocaleString() : '—'}
            </Text>

            {/* Summary stats */}
            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{report?.total ?? 0}</Text>
                <Text style={styles.statLabel}>Total Grades</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{report?.published ?? 0}</Text>
                <Text style={styles.statLabel}>Published</Text>
              </View>
              <View style={[styles.statBox, { borderLeftColor: Colors.success }]}>
                <Text style={[styles.statValue, { color: Colors.success }]}>
                  {report?.pass_count ?? 0}
                </Text>
                <Text style={styles.statLabel}>Pass</Text>
              </View>
              <View style={[styles.statBox, { borderLeftColor: Colors.error }]}>
                <Text style={[styles.statValue, { color: Colors.error }]}>
                  {report?.fail_count ?? 0}
                </Text>
                <Text style={styles.statLabel}>Fail / Refer</Text>
              </View>
            </View>

            {/* Average score */}
            {report?.average_score != null && (
              <View style={styles.avgBox}>
                <Text style={styles.avgLabel}>Programme Average Score</Text>
                <Text style={styles.avgValue}>{report.average_score}%</Text>
              </View>
            )}

            {/* Band distribution */}
            {Object.keys(bandSummary).length > 0 && (
              <>
                <Text style={styles.sectionLabel}>Grade Distribution</Text>
                <View style={styles.bandRow}>
                  {Object.entries(bandSummary)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([band, count]) => (
                      <View key={band} style={styles.bandItem}>
                        <GradeBadge band={band} />
                        <Text style={styles.bandCount}>{count}</Text>
                      </View>
                    ))
                  }
                </View>
              </>
            )}

            {/* Disclaimer */}
            <View style={styles.disclaimer}>
              <Text style={styles.disclaimerText}>
                ⚠ Grade bands are configurable. Pass/fail classification
                treats F and N/A as fail indicators. Confirm official
                university grade boundaries before publication (D-03).
              </Text>
            </View>

            <Text style={styles.sectionLabel}>All Grade Records</Text>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🏆</Text>
            <Text style={styles.emptyText}>No grade records found.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Card style={styles.gradeCard}>
            <View style={styles.gradeTop}>
              <View style={styles.gradeInfo}>
                <Text style={styles.studentName}>{item.student_name}</Text>
                <Text style={styles.studentMeta}>
                  {item.student_number ?? '—'} · {item.programme ?? '—'}
                </Text>
                <Text style={styles.orgName}>{item.org_name}</Text>
              </View>
              <View style={styles.gradeRight}>
                <GradeBadge band={item.grade_band} />
                {item.computed_score != null && (
                  <Text style={styles.scoreText}>{item.computed_score}%</Text>
                )}
              </View>
            </View>

            <View style={styles.gradeFooter}>
              <StatusBadge status={gradeStatusMap[item.grade_status] ?? 'pending'} />
              {item.published_at && (
                <Text style={styles.publishedDate}>
                  Published {new Date(item.published_at).toLocaleDateString()}
                </Text>
              )}
            </View>

            {item.computation_notes ? (
              <Text style={styles.notes} numberOfLines={1}>
                ⚠ {item.computation_notes}
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

  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: 10, marginBottom: 16,
  },
  statBox: {
    flex:            1, minWidth: '44%',
    backgroundColor: Colors.surface,
    borderRadius:    10, padding: 12,
    borderLeftWidth: 3, borderLeftColor: Colors.primary,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
  },
  statValue: { fontSize: 24, fontWeight: '900', color: Colors.primary },
  statLabel: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },

  avgBox: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    alignItems:      'center',
    backgroundColor: Colors.primary,
    borderRadius:    10, padding: 14,
    marginBottom:    16,
  },
  avgLabel: { fontSize: 14, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
  avgValue: { fontSize: 28, fontWeight: '900', color: Colors.accent },

  sectionLabel: {
    fontSize: 12, fontWeight: '700', color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10,
  },

  bandRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  bandItem:  { alignItems: 'center', gap: 4 },
  bandCount: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },

  disclaimer: {
    backgroundColor: '#FEF9C3', borderRadius: 8, padding: 10,
    borderLeftWidth: 3, borderLeftColor: Colors.warning, marginBottom: 16,
  },
  disclaimerText: { fontSize: 11, color: '#78350F', lineHeight: 16 },

  gradeCard:   { marginHorizontal: 16, marginBottom: 10 },
  gradeTop:    { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  gradeInfo:   { flex: 1, marginRight: 8 },
  gradeRight:  { alignItems: 'center', gap: 4 },

  studentName: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  studentMeta: { fontSize: 11, color: Colors.textMuted },
  orgName:     { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  scoreText:   { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },

  gradeBadge: {
    width: 42, height: 42, borderRadius: 21,
    borderWidth: 2, alignItems: 'center', justifyContent: 'center',
  },
  gradeBandText: { fontSize: 16, fontWeight: '900' },

  gradeFooter: {
    flexDirection:  'row', justifyContent: 'space-between',
    alignItems:     'center', marginTop: 4,
  },
  publishedDate: { fontSize: 11, color: Colors.textMuted },

  notes: { fontSize: 11, color: Colors.warning, marginTop: 6 },

  emptyState: { alignItems: 'center', paddingTop: 60 },
  emptyIcon:  { fontSize: 48, marginBottom: 12 },
  emptyText:  { fontSize: 15, color: Colors.textSecondary },
});
