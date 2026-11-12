/**
 * Submit Logbook Entry Screen — Digital LEAP
 * FR-07: Students submit validated weekly logbook entries.
 */

import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { placementService, logbookService } from '../../services/api';
import { Colors } from '../../constants/colors';
import ScreenWrapper from '../../components/ScreenWrapper';
import InputField from '../../components/InputField';
import Button from '../../components/Button';

export default function SubmitLogbookScreen() {
  const router = useRouter();

  const [placementId,  setPlacementId]  = useState(null);
  const [weekNumber,   setWeekNumber]   = useState('');
  const [entryDate,    setEntryDate]    = useState('');
  const [activities,   setActivities]   = useState('');
  const [skills,       setSkills]       = useState('');
  const [hours,        setHours]        = useState('');
  const [loading,      setLoading]      = useState(false);
  const [fetchingPlacement, setFetchingPlacement] = useState(true);
  const [errors,       setErrors]       = useState({});

  useEffect(() => {
    (async () => {
      const result = await placementService.list();
      if (result.success) {
        const active = (result.data ?? []).find(
          (p) => ['confirmed', 'active'].includes(p.status)
        );
        if (active) {
          setPlacementId(active.placement_id);
          // Pre-fill today's date
          setEntryDate(new Date().toISOString().split('T')[0]);
        }
      }
      setFetchingPlacement(false);
    })();
  }, []);

  async function handleSubmit() {
    setErrors({});
    const clientErrors = {};

    if (!weekNumber || isNaN(parseInt(weekNumber, 10))) {
      clientErrors.week_number = 'Enter a valid week number (1–12).';
    }
    if (!entryDate) clientErrors.entry_date = 'Entry date is required.';
    if (!activities.trim()) clientErrors.activities = 'Activities description is required.';
    if (!hours || isNaN(parseFloat(hours))) clientErrors.hours_worked = 'Enter hours worked (e.g. 8).';

    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      return;
    }

    setLoading(true);
    const result = await logbookService.submit(placementId, {
      week_number:  parseInt(weekNumber, 10),
      entry_date:   entryDate,
      activities:   activities.trim(),
      skills_gained:skills.trim() || null,
      hours_worked: parseFloat(hours),
    });
    setLoading(false);

    if (result.success) {
      Alert.alert(
        'Entry Submitted',
        'Your logbook entry has been submitted and is awaiting supervisor review.',
        [{ text: 'OK', onPress: () => router.replace('/logbook') }]
      );
    } else {
      if (result.errors && Object.keys(result.errors).length > 0) {
        setErrors(result.errors);
      } else {
        Alert.alert('Submission Failed', result.message);
      }
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
        <View style={styles.noPlacement}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyText}>
            You don't have an active placement. Logbook entries can only be submitted
            once your placement is confirmed.
          </Text>
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      <Text style={styles.title}>New Logbook Entry</Text>
      <Text style={styles.subtitle}>
        Record your weekly internship activities. The entry date must fall within
        your placement period and each week can only have one entry.
      </Text>

      <InputField
        label="Week Number"
        value={weekNumber}
        onChangeText={setWeekNumber}
        placeholder="e.g. 1"
        keyboardType="numeric"
        error={errors.week_number}
      />

      <InputField
        label="Entry Date (YYYY-MM-DD)"
        value={entryDate}
        onChangeText={setEntryDate}
        placeholder={new Date().toISOString().split('T')[0]}
        keyboardType="numbers-and-punctuation"
        error={errors.entry_date}
      />

      <InputField
        label="Activities"
        value={activities}
        onChangeText={setActivities}
        placeholder="Describe what you did this week…"
        multiline
        numberOfLines={5}
        error={errors.activities}
      />

      <InputField
        label="Skills Gained (optional)"
        value={skills}
        onChangeText={setSkills}
        placeholder="e.g. HTML, communication, project management"
        multiline
        numberOfLines={3}
      />

      <InputField
        label="Hours Worked"
        value={hours}
        onChangeText={setHours}
        placeholder="e.g. 40"
        keyboardType="decimal-pad"
        error={errors.hours_worked}
      />

      <Button
        title="Submit Entry"
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

  noPlacement: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 24 },
  emptyIcon:   { fontSize: 48, marginBottom: 16 },
  emptyText:   { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
});
