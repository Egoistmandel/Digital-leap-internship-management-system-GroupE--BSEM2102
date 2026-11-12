/**
 * Student Results Screen — Digital LEAP
 * Students view their published final grade (FR-12).
 * Grades are only visible after management approval and publication.
 */

import { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAuth } from '../../hooks/useAuth';
import { placementService, assessmentService } from '../../services/api';
import { Colors } from '../../constants/colors';
import ScreenWrapper from '../../components/ScreenWrapper';
import Card from '../../components/Card';

export default function ResultsScreen() {
  const { user } = useAuth();
  const [grade,    setGrade]    = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [message,  setMessage]  = useState('');

  useEffect(() => {
    (async () => {
      // Get active/completed placement
      const plResult = await placementService.list();
      if (!plResult.success) {
        setMessage('Could not load placement information.');
        setLoading(false);
        return;
      }

      const pl = (plResult.data ?? []).find(
        (p) => ['active', 'completed'].includes(p.status)
      );

      if (!pl) {
        setMessage('No completed placement found.');
        setLoading(false);
        return;
      }

      const gradeResult = await assessmentService.getGrade(pl.placement_id);
      if (gradeResult.success) {
        setGrade(gradeResult.data);
      } else if (gradeResult.status === 403) {
        setMessage('Your results are not yet published. Please check back later.');
      } else {
        setMessage(gradeResult.message);
      }

      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <ScreenWrapper scrollable={false}>
        <Text style={styles.loadingText}>Loading results…</Text>
      </ScreenWrapper>
    );
  }

  if (!grade) {
    return (
      <ScreenWrapper scrollable={false}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>⏳</Text>
          <Text style={styles.emptyTitle}>Results Not Yet Available</Text>
          <Text style={styles.emptyText}>{message || 'Your results will appear here once published.'}</Text>
        </View>
      </ScreenWrapper>
    );
  }

  const passed = grade.grade_band && grade.grade_band !== 'F' && grade.grade_band !== 'N/A';

  return (
    <ScreenWrapper>
      <Text style={styles.pageTitle}>My Results</Text>

      {/* Grade card */}
      <View style={[styles.gradeCard, { borderColor: passed ? Colors.success : Colors.error }]}>
        <Text style={styles.gradeLabel}>Final Grade</Text>
        <Text style={[styles.gradeBand, { color: passed ? Colors.success : Colors.error }]}>
          {grade.grade_band ?? '—'}
        </Text>
        <Text style={styles.gradeScore}>{grade.computed_score}%</Text>
        <Text style={[styles.gradeResult, { color: passed ? Colors.success : Colors.error }]}>
          {passed ? 'PASS' : 'REFER / FAIL'}
        </Text>
      </View>

      {/* Breakdown */}
      {(grade.marks_breakdown ?? []).length > 0 ? (
        <Card>
          <Text style={styles.sectionTitle}>Marks Breakdown</Text>
          {grade.marks_breakdown.map((m, i) => (
            <View key={i} style={styles.markRow}>
              <View style={styles.markInfo}>
                <Text style={styles.markComponent}>{m.component_name}</Text>
                <Text style={styles.markWeight}>{m.weight_percent}% weight</Text>
              </View>
              <View style={styles.markScore}>
                <Text style={styles.markValue}>{m.score} / {m.max_score}</Text>
                <Text style={styles.markPercent}>
                  {Math.round((m.score / m.max_score) * 100)}%
                </Text>
              </View>
            </View>
          ))}
        </Card>
      ) : null}

      {/* Publication info */}
      <Card>
        <Text style={styles.infoRow}>
          <Text style={styles.infoLabel}>Published: </Text>
          {grade.published_at
            ? new Date(grade.published_at).toLocaleDateString()
            : '—'}
        </Text>
        <Text style={styles.infoRow}>
          <Text style={styles.infoLabel}>Approved by Management: </Text>
          {grade.approved_at
            ? new Date(grade.approved_at).toLocaleDateString()
            : '—'}
        </Text>
      </Card>

      {grade.computation_notes ? (
        <View style={styles.notesBox}>
          <Text style={styles.notesTitle}>Notes</Text>
          <Text style={styles.notesText}>{grade.computation_notes}</Text>
        </View>
      ) : null}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  loadingText: { textAlign: 'center', marginTop: 32, color: Colors.textSecondary },

  pageTitle: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary, marginBottom: 20 },

  gradeCard: {
    alignItems:      'center',
    backgroundColor: Colors.surface,
    borderRadius:    16,
    padding:         32,
    marginBottom:    16,
    borderWidth:     3,
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.08,
    shadowRadius:    8,
    elevation:       3,
  },
  gradeLabel:  { fontSize: 14, color: Colors.textSecondary, marginBottom: 8 },
  gradeBand:   { fontSize: 72, fontWeight: '900', lineHeight: 80 },
  gradeScore:  { fontSize: 24, fontWeight: '700', color: Colors.textSecondary, marginTop: 4 },
  gradeResult: { fontSize: 16, fontWeight: '700', marginTop: 8, letterSpacing: 2 },

  sectionTitle: {
    fontSize:     14,
    fontWeight:   '700',
    color:        Colors.textSecondary,
    textTransform:'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },

  markRow: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  markInfo:      { flex: 1 },
  markComponent: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  markWeight:    { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  markScore:     { alignItems: 'flex-end' },
  markValue:     { fontSize: 14, color: Colors.textPrimary },
  markPercent:   { fontSize: 12, color: Colors.textSecondary },

  infoRow:   { fontSize: 13, color: Colors.textSecondary, marginBottom: 4 },
  infoLabel: { fontWeight: '600', color: Colors.textPrimary },

  notesBox: {
    backgroundColor: '#FEF9C3',
    borderRadius:    8,
    padding:         12,
    marginBottom:    12,
    borderLeftWidth: 3,
    borderLeftColor: Colors.warning,
  },
  notesTitle: { fontSize: 13, fontWeight: '700', color: '#78350F', marginBottom: 4 },
  notesText:  { fontSize: 12, color: '#78350F', lineHeight: 18 },

  emptyState: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 24 },
  emptyIcon:  { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8 },
  emptyText:  { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
});
