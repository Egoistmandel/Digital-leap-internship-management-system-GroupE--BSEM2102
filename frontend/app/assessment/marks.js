/**
 * Submit Academic Marks Screen — Digital LEAP
 * FR-11: Supervisors submit academic assessment marks per component.
 */

import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Alert, FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { placementService, assessmentService } from '../../services/api';
import { Colors } from '../../constants/colors';
import ScreenWrapper from '../../components/ScreenWrapper';
import Card from '../../components/Card';
import InputField from '../../components/InputField';
import Button from '../../components/Button';

export default function SubmitMarksScreen() {
  const router = useRouter();

  const [placements,  setPlacements]  = useState([]);
  const [components,  setComponents]  = useState([]);
  const [selected,    setSelected]    = useState(null); // selected placement
  const [marks,       setMarks]       = useState({});   // { component_id: score }
  const [comments,    setComments]    = useState({});
  const [loading,     setLoading]     = useState(false);
  const [fetching,    setFetching]    = useState(true);
  const [error,       setError]       = useState('');

  useEffect(() => {
    (async () => {
      const [plResult, compResult] = await Promise.all([
        placementService.list(),
        assessmentService.getComponents(),
      ]);

      if (plResult.success) {
        setPlacements(
          (plResult.data ?? []).filter((p) => ['active', 'completed'].includes(p.status))
        );
      }
      if (compResult.success) {
        setComponents(compResult.data.components?.filter((c) => c.is_active) ?? []);
      }
      setFetching(false);
    })();
  }, []);

  function setMark(componentId, value) {
    setMarks((prev) => ({ ...prev, [componentId]: value }));
  }

  function setComment(componentId, value) {
    setComments((prev) => ({ ...prev, [componentId]: value }));
  }

  async function handleSubmit() {
    setError('');

    if (!selected) {
      setError('Please select a placement.');
      return;
    }

    const toSubmit = components.filter((c) => marks[c.component_id] !== undefined);
    if (toSubmit.length === 0) {
      setError('Please enter at least one mark.');
      return;
    }

    setLoading(true);
    let allOk = true;

    for (const comp of toSubmit) {
      const score = parseFloat(marks[comp.component_id]);
      if (isNaN(score) || score < 0 || score > 100) {
        setError(`Invalid score for "${comp.component_name}". Must be 0–100.`);
        allOk = false;
        break;
      }

      const r = await assessmentService.submitMarks({
        placement_id: selected.placement_id,
        component_id: comp.component_id,
        score,
        comments: comments[comp.component_id] ?? null,
      });

      if (!r.success) {
        setError(r.message);
        allOk = false;
        break;
      }
    }

    setLoading(false);

    if (allOk) {
      Alert.alert(
        'Marks Submitted',
        'Academic marks have been saved. The coordinator can now compute the final grade.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    }
  }

  if (fetching) {
    return (
      <ScreenWrapper scrollable={false}>
        <Text style={styles.loadingText}>Loading…</Text>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      <Text style={styles.title}>Submit Academic Marks</Text>
      <Text style={styles.subtitle}>
        Enter marks for each active assessment component. Marks can be updated
        until the coordinator computes the final grade.
      </Text>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* Select placement */}
      <Text style={styles.sectionLabel}>Select Placement</Text>
      {placements.length === 0 ? (
        <Card>
          <Text style={styles.emptyText}>No active placements assigned to you.</Text>
        </Card>
      ) : (
        placements.map((pl) => (
          <Card
            key={pl.placement_id}
            style={[
              styles.plCard,
              selected?.placement_id === pl.placement_id && styles.plCardSelected,
            ]}
          >
            <Text
              onPress={() => setSelected(pl)}
              style={styles.plName}
            >
              {pl.student_name}
            </Text>
            <Text style={styles.plOrg}>{pl.org_name}</Text>
          </Card>
        ))
      )}

      {/* Mark entry */}
      {selected && components.length > 0 && (
        <>
          <Text style={[styles.sectionLabel, { marginTop: 20 }]}>
            Marks for {selected.student_name}
          </Text>
          {components.map((comp) => (
            <Card key={comp.component_id} style={styles.compCard}>
              <View style={styles.compHeader}>
                <Text style={styles.compName}>{comp.component_name}</Text>
                <Text style={styles.compWeight}>{comp.weight_percent}%</Text>
              </View>
              <InputField
                label="Score (0–100)"
                value={marks[comp.component_id] ?? ''}
                onChangeText={(v) => setMark(comp.component_id, v)}
                keyboardType="decimal-pad"
                placeholder="Enter score"
              />
              <InputField
                label="Comments (optional)"
                value={comments[comp.component_id] ?? ''}
                onChangeText={(v) => setComment(comp.component_id, v)}
                placeholder="Optional feedback"
                multiline
                numberOfLines={2}
              />
            </Card>
          ))}

          <Button
            title="Save Marks"
            onPress={handleSubmit}
            loading={loading}
            style={{ marginTop: 8 }}
          />
        </>
      )}

      {selected && components.length === 0 && (
        <View style={styles.noComps}>
          <Text style={styles.noCompsText}>
            No assessment components configured yet.
            Ask the coordinator to set up components first.
          </Text>
        </View>
      )}
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

  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },

  plCard:         { borderWidth: 2, borderColor: 'transparent', marginBottom: 8 },
  plCardSelected: { borderColor: Colors.primary, backgroundColor: '#EFF6FF' },
  plName:         { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  plOrg:          { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },

  compCard:   { marginBottom: 12 },
  compHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  compName:   { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, flex: 1 },
  compWeight: {
    backgroundColor: Colors.primary, color: Colors.white,
    borderRadius: 12, paddingHorizontal: 10, paddingVertical: 2,
    fontSize: 12, fontWeight: '700',
  },

  emptyText:  { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },
  noComps:    { alignItems: 'center', paddingVertical: 24 },
  noCompsText:{ fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
});
