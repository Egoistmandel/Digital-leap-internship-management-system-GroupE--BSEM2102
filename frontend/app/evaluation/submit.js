/**
 * Submit Host Evaluation Screen — Digital LEAP
 * FR-10: Host supervisors submit intern evaluations online.
 */

import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Alert, ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { placementService, assessmentService } from '../../services/api';
import { Colors } from '../../constants/colors';
import ScreenWrapper from '../../components/ScreenWrapper';
import InputField from '../../components/InputField';
import Button from '../../components/Button';
import Card from '../../components/Card';

// Evaluation criteria defined here — can be made configurable in future
const CRITERIA = [
  { key: 'punctuality',    label: 'Punctuality & Attendance' },
  { key: 'communication',  label: 'Communication Skills' },
  { key: 'initiative',     label: 'Initiative & Proactivity' },
  { key: 'technical',      label: 'Technical Skills' },
  { key: 'teamwork',       label: 'Teamwork & Collaboration' },
  { key: 'professionalism',label: 'Professionalism' },
];

function RatingRow({ label, value, onChange }) {
  return (
    <View style={styles.ratingRow}>
      <Text style={styles.ratingLabel}>{label}</Text>
      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map((n) => (
          <TouchableOpacity
            key={n}
            onPress={() => onChange(n)}
            accessibilityRole="radio"
            accessibilityLabel={`${n} out of 5`}
            accessibilityState={{ selected: value === n }}
          >
            <Text style={[styles.star, value >= n && styles.starActive]}>★</Text>
          </TouchableOpacity>
        ))}
        <Text style={styles.ratingValue}>{value ? `${value}/5` : '—'}</Text>
      </View>
    </View>
  );
}

export default function SubmitEvaluationScreen() {
  const router = useRouter();

  const [placementId,  setPlacementId]  = useState(null);
  const [ratings,      setRatings]      = useState({});
  const [comments,     setComments]     = useState('');
  const [loading,      setLoading]      = useState(false);
  const [fetchingPlacement, setFetchingPlacement] = useState(true);
  const [error,        setError]        = useState('');

  useEffect(() => {
    (async () => {
      const result = await placementService.list();
      if (result.success) {
        const pl = (result.data ?? []).find(
          (p) => ['active', 'completed'].includes(p.status)
        );
        if (pl) setPlacementId(pl.placement_id);
      }
      setFetchingPlacement(false);
    })();
  }, []);

  function setRating(key, value) {
    setRatings((prev) => ({ ...prev, [key]: value }));
  }

  function computeOverall() {
    const vals = Object.values(ratings).filter(Boolean);
    if (vals.length === 0) return 0;
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    return Math.round((avg / 5) * 100);
  }

  async function handleSubmit() {
    setError('');

    const missing = CRITERIA.filter((c) => !ratings[c.key]);
    if (missing.length > 0) {
      setError('Please rate all criteria before submitting.');
      return;
    }

    const overall = computeOverall();
    setLoading(true);

    const result = await assessmentService.submitEvaluation(placementId, {
      criteria:      ratings,
      overall_score: overall,
      comments:      comments.trim() || null,
    });

    setLoading(false);

    if (result.success) {
      Alert.alert(
        'Evaluation Submitted',
        'Thank you. Your evaluation has been submitted successfully.',
        [{ text: 'OK', onPress: () => router.replace('/(tabs)/host') }]
      );
    } else {
      setError(result.message);
    }
  }

  if (fetchingPlacement) {
    return (
      <ScreenWrapper scrollable={false}>
        <Text style={styles.loadingText}>Loading placement details…</Text>
      </ScreenWrapper>
    );
  }

  if (!placementId) {
    return (
      <ScreenWrapper scrollable={false}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyText}>
            No active or completed placement found to evaluate.
          </Text>
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      <Text style={styles.title}>Intern Evaluation</Text>
      <Text style={styles.subtitle}>
        Rate the intern on each criterion from 1 (poor) to 5 (excellent).
        This evaluation forms part of the final grade.
      </Text>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <Card>
        {CRITERIA.map((c) => (
          <RatingRow
            key={c.key}
            label={c.label}
            value={ratings[c.key] ?? 0}
            onChange={(v) => setRating(c.key, v)}
          />
        ))}
      </Card>

      {Object.keys(ratings).length === CRITERIA.length ? (
        <View style={styles.overallBox}>
          <Text style={styles.overallLabel}>Overall Score</Text>
          <Text style={styles.overallScore}>{computeOverall()}%</Text>
        </View>
      ) : null}

      <InputField
        label="Additional Comments (optional)"
        value={comments}
        onChangeText={setComments}
        placeholder="Any additional feedback about the intern's performance…"
        multiline
        numberOfLines={4}
      />

      <View style={styles.notice}>
        <Text style={styles.noticeText}>
          Once submitted, this evaluation cannot be changed. Please review
          your ratings carefully before submitting.
        </Text>
      </View>

      <Button
        title="Submit Evaluation"
        onPress={handleSubmit}
        loading={loading}
        style={{ marginTop: 8 }}
      />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  title:    { fontSize: 22, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  subtitle: { fontSize: 14, color: Colors.textSecondary, marginBottom: 20, lineHeight: 20 },

  loadingText: { textAlign: 'center', marginTop: 32, color: Colors.textSecondary },

  errorBox: {
    backgroundColor: Colors.locked, borderRadius: 8, padding: 12, marginBottom: 16,
  },
  errorText: { color: Colors.lockedText, fontSize: 14 },

  ratingRow: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    alignItems:      'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  ratingLabel: { fontSize: 14, color: Colors.textPrimary, flex: 1, marginRight: 8 },
  stars:       { flexDirection: 'row', alignItems: 'center', gap: 4 },
  star:        { fontSize: 24, color: Colors.border },
  starActive:  { color: Colors.accent },
  ratingValue: { fontSize: 12, color: Colors.textSecondary, marginLeft: 6, width: 28 },

  overallBox: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    backgroundColor: Colors.primary,
    borderRadius:   10,
    padding:        16,
    marginBottom:   16,
  },
  overallLabel: { fontSize: 15, fontWeight: '600', color: Colors.white },
  overallScore: { fontSize: 24, fontWeight: '900', color: Colors.accent },

  notice: {
    backgroundColor: '#FEF9C3',
    borderRadius:    8,
    padding:         12,
    marginBottom:    12,
    borderLeftWidth: 3,
    borderLeftColor: Colors.warning,
  },
  noticeText: { fontSize: 13, color: '#78350F', lineHeight: 18 },

  emptyState: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 24 },
  emptyIcon:  { fontSize: 48, marginBottom: 16 },
  emptyText:  { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
});
