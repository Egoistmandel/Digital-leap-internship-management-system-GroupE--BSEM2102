/**
 * Assessment Configuration Screen — Digital LEAP
 * Coordinator configures assessment components and grade bands.
 * D-02: Components and weights are configurable.
 * D-03: Grade bands are configurable — no official scale assumed.
 * U-01: Third component name pending lecturer confirmation.
 */

import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Alert, ScrollView,
  TouchableOpacity,
} from 'react-native';
import { assessmentService } from '../../services/api';
import { Colors } from '../../constants/colors';
import ScreenWrapper from '../../components/ScreenWrapper';
import Card from '../../components/Card';
import InputField from '../../components/InputField';
import Button from '../../components/Button';

export default function AssessmentConfigScreen() {
  const [components,   setComponents]   = useState([]);
  const [gradeBands,   setGradeBands]   = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [totalWeight,  setTotalWeight]  = useState(0);
  const [weightsValid, setWeightsValid] = useState(false);

  // New component form
  const [newName,   setNewName]   = useState('');
  const [newWeight, setNewWeight] = useState('');
  const [newDesc,   setNewDesc]   = useState('');
  const [saving,    setSaving]    = useState(false);

  // New grade band form
  const [newBand,    setNewBand]    = useState('');
  const [newMin,     setNewMin]     = useState('');
  const [newMax,     setNewMax]     = useState('');
  const [newGpa,     setNewGpa]     = useState('');
  const [savingBand, setSavingBand] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [compResult, bandResult] = await Promise.all([
      assessmentService.getComponents(),
      assessmentService.getGradeConfig(),
    ]);

    if (compResult.success) {
      setComponents(compResult.data.components ?? []);
      setTotalWeight(compResult.data.total_weight ?? 0);
      setWeightsValid(compResult.data.weights_valid ?? false);
    }
    if (bandResult.success) {
      setGradeBands(bandResult.data.grade_bands ?? []);
    }
    setLoading(false);
  }

  async function handleAddComponent() {
    if (!newName.trim() || !newWeight) {
      Alert.alert('Validation', 'Component name and weight are required.');
      return;
    }
    setSaving(true);
    const result = await assessmentService.createComponent({
      component_name: newName.trim(),
      weight_percent: parseFloat(newWeight),
      description:    newDesc.trim() || null,
    });
    setSaving(false);

    if (result.success) {
      setNewName(''); setNewWeight(''); setNewDesc('');
      loadData();
    } else {
      Alert.alert('Error', result.message);
    }
  }

  async function handleSaveBand() {
    if (!newBand.trim() || !newMin || !newMax) {
      Alert.alert('Validation', 'Grade band, min score, and max score are required.');
      return;
    }
    setSavingBand(true);
    const result = await assessmentService.saveGradeConfig({
      grade_band:  newBand.trim().toUpperCase(),
      min_score:   parseFloat(newMin),
      max_score:   parseFloat(newMax),
      gpa_points:  newGpa ? parseFloat(newGpa) : null,
    });
    setSavingBand(false);

    if (result.success) {
      setNewBand(''); setNewMin(''); setNewMax(''); setNewGpa('');
      loadData();
    } else {
      Alert.alert('Error', result.message);
    }
  }

  if (loading) {
    return (
      <ScreenWrapper scrollable={false}>
        <Text style={styles.loadingText}>Loading configuration…</Text>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      {/* Unresolved items notice */}
      <View style={styles.warningBox}>
        <Text style={styles.warningTitle}>⚠ Pending Confirmation</Text>
        <Text style={styles.warningText}>
          The third assessment component name (U-01) and official grade band
          boundaries (D-03) are pending confirmation from your lecturer.
          Configure these once confirmed. Do not use placeholder values in
          the final submission.
        </Text>
      </View>

      {/* Assessment Components */}
      <Text style={styles.sectionTitle}>Assessment Components</Text>

      <View style={[
        styles.weightSummary,
        { backgroundColor: weightsValid ? '#D1FAE5' : '#FEE2E2' }
      ]}>
        <Text style={[
          styles.weightText,
          { color: weightsValid ? '#065F46' : '#991B1B' }
        ]}>
          Total Weight: {totalWeight.toFixed(1)}%
          {weightsValid ? ' ✓ Valid' : ' ✗ Must equal 100%'}
        </Text>
      </View>

      {components.map((c) => (
        <Card key={c.component_id} style={styles.componentCard}>
          <View style={styles.componentRow}>
            <View style={styles.componentInfo}>
              <Text style={styles.componentName}>{c.component_name}</Text>
              {c.description ? (
                <Text style={styles.componentDesc}>{c.description}</Text>
              ) : null}
            </View>
            <View style={styles.weightBadge}>
              <Text style={styles.weightBadgeText}>{c.weight_percent}%</Text>
            </View>
          </View>
          <Text style={styles.activeTag}>
            {c.is_active ? '● Active' : '○ Inactive'}
          </Text>
        </Card>
      ))}

      {/* Add component form */}
      <Card style={styles.formCard}>
        <Text style={styles.formTitle}>Add Component</Text>
        <InputField
          label="Component Name"
          value={newName}
          onChangeText={setNewName}
          placeholder="e.g. Host Evaluation, Academic Marks"
        />
        <InputField
          label="Weight (%)"
          value={newWeight}
          onChangeText={setNewWeight}
          placeholder="e.g. 40"
          keyboardType="decimal-pad"
        />
        <InputField
          label="Description (optional)"
          value={newDesc}
          onChangeText={setNewDesc}
          placeholder="Brief description of this component"
        />
        <Button
          title="Add Component"
          onPress={handleAddComponent}
          loading={saving}
        />
      </Card>

      {/* Grade Bands */}
      <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Grade Bands</Text>
      <Text style={styles.sectionNote}>
        These boundaries are configurable. Official university boundaries must
        be confirmed before publication (D-03).
      </Text>

      {gradeBands.map((b) => (
        <Card key={b.config_id} style={styles.bandCard}>
          <View style={styles.bandRow}>
            <Text style={styles.bandLetter}>{b.grade_band}</Text>
            <Text style={styles.bandRange}>{b.min_score} – {b.max_score}%</Text>
            {b.gpa_points != null ? (
              <Text style={styles.bandGpa}>GPA {b.gpa_points}</Text>
            ) : null}
          </View>
          {b.description ? (
            <Text style={styles.bandDesc}>{b.description}</Text>
          ) : null}
        </Card>
      ))}

      {/* Add grade band form */}
      <Card style={styles.formCard}>
        <Text style={styles.formTitle}>Add / Update Grade Band</Text>
        <View style={styles.row}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <InputField
              label="Band"
              value={newBand}
              onChangeText={setNewBand}
              placeholder="A"
              autoCapitalize="characters"
            />
          </View>
          <View style={{ flex: 1 }}>
            <InputField
              label="GPA Points"
              value={newGpa}
              onChangeText={setNewGpa}
              placeholder="4.0"
              keyboardType="decimal-pad"
            />
          </View>
        </View>
        <View style={styles.row}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <InputField
              label="Min %"
              value={newMin}
              onChangeText={setNewMin}
              placeholder="70"
              keyboardType="decimal-pad"
            />
          </View>
          <View style={{ flex: 1 }}>
            <InputField
              label="Max %"
              value={newMax}
              onChangeText={setNewMax}
              placeholder="100"
              keyboardType="decimal-pad"
            />
          </View>
        </View>
        <Button
          title="Save Grade Band"
          onPress={handleSaveBand}
          loading={savingBand}
        />
      </Card>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  loadingText: { textAlign: 'center', marginTop: 32, color: Colors.textSecondary },

  warningBox: {
    backgroundColor: '#FEF9C3',
    borderRadius:    10,
    padding:         14,
    marginBottom:    20,
    borderLeftWidth: 3,
    borderLeftColor: Colors.warning,
  },
  warningTitle: { fontSize: 14, fontWeight: '700', color: '#78350F', marginBottom: 4 },
  warningText:  { fontSize: 13, color: '#78350F', lineHeight: 18 },

  sectionTitle: {
    fontSize:     14,
    fontWeight:   '700',
    color:        Colors.textSecondary,
    textTransform:'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  sectionNote: {
    fontSize:     13,
    color:        Colors.textSecondary,
    marginBottom: 10,
    lineHeight:   18,
  },

  weightSummary: {
    borderRadius:  8,
    padding:       10,
    marginBottom:  12,
    alignItems:    'center',
  },
  weightText: { fontSize: 14, fontWeight: '700' },

  componentCard: { marginBottom: 8 },
  componentRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  componentInfo: { flex: 1 },
  componentName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  componentDesc: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  weightBadge: {
    backgroundColor: Colors.primary,
    borderRadius:    16,
    paddingHorizontal: 10,
    paddingVertical:   4,
    marginLeft:      8,
  },
  weightBadgeText: { color: Colors.white, fontSize: 13, fontWeight: '700' },
  activeTag: { fontSize: 11, color: Colors.textMuted, marginTop: 6 },

  bandCard: { marginBottom: 8 },
  bandRow:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bandLetter: { fontSize: 22, fontWeight: '900', color: Colors.primary, width: 32 },
  bandRange:  { fontSize: 14, color: Colors.textPrimary },
  bandGpa:    { fontSize: 12, color: Colors.textSecondary },
  bandDesc:   { fontSize: 12, color: Colors.textMuted, marginTop: 4 },

  formCard: { marginTop: 8, backgroundColor: Colors.background },
  formTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginBottom: 12 },
  row: { flexDirection: 'row' },
});
