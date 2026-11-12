/**
 * Apply for Placement Screen — Digital LEAP
 * FR-03: Students submit placement applications online.
 */

import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { hostService, placementService } from '../../services/api';
import { Colors } from '../../constants/colors';
import ScreenWrapper from '../../components/ScreenWrapper';
import Card from '../../components/Card';
import Button from '../../components/Button';
import InputField from '../../components/InputField';

export default function ApplyScreen() {
  const { user }   = useAuth();
  const router     = useRouter();
  const [hosts,    setHosts]    = useState([]);
  const [selected, setSelected] = useState(null); // selected vacancy
  const [sector,   setSector]   = useState('');
  const [loading,  setLoading]  = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error,    setError]    = useState('');

  useEffect(() => {
    (async () => {
      const result = await hostService.list();
      if (result.success) {
        // Fetch each org's details (includes vacancies)
        const all = [];
        for (const org of result.data ?? []) {
          const orgResult = await hostService.get(org.org_id);
          if (orgResult.success) {
            for (const v of (orgResult.data?.vacancies ?? [])) {
              if (v.is_active && v.filled_count < v.capacity) {
                all.push({ ...v, org_name: org.org_name, industry: org.industry });
              }
            }
          }
        }
        setHosts(all);
      }
      setFetching(false);
    })();
  }, []);

  async function handleApply() {
    if (!selected) {
      setError('Please select a vacancy before applying.');
      return;
    }
    setError('');
    setLoading(true);

    const result = await placementService.apply({
      vacancy_id:       selected.vacancy_id,
      preferred_sector: sector.trim() || selected.industry,
    });

    setLoading(false);

    if (result.success) {
      Alert.alert(
        'Application Submitted',
        'Your placement application has been submitted. The coordinator will review it shortly.',
        [{ text: 'OK', onPress: () => router.replace('/(tabs)/student') }]
      );
    } else {
      setError(result.message);
    }
  }

  if (fetching) {
    return (
      <ScreenWrapper scrollable={false}>
        <Text style={styles.loadingText}>Loading available vacancies…</Text>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      <Text style={styles.title}>Apply for Placement</Text>
      <Text style={styles.subtitle}>
        Select an available vacancy below. Your application will be reviewed by
        the LEAP Coordinator.
      </Text>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <Text style={styles.sectionLabel}>Available Vacancies ({hosts.length})</Text>

      {hosts.length === 0 ? (
        <Card>
          <Text style={styles.emptyText}>
            No vacancies are currently available. Check back later or contact the coordinator.
          </Text>
        </Card>
      ) : (
        hosts.map((v) => (
          <TouchableOpacity
            key={v.vacancy_id}
            onPress={() => setSelected(selected?.vacancy_id === v.vacancy_id ? null : v)}
            accessibilityRole="radio"
            accessibilityState={{ selected: selected?.vacancy_id === v.vacancy_id }}
          >
            <Card style={[
              styles.vacCard,
              selected?.vacancy_id === v.vacancy_id && styles.vacCardSelected,
            ]}>
              <View style={styles.vacHeader}>
                <Text style={styles.vacTitle}>{v.title}</Text>
                {selected?.vacancy_id === v.vacancy_id && (
                  <Text style={styles.checkmark}>✓</Text>
                )}
              </View>
              <Text style={styles.orgName}>{v.org_name}</Text>
              {v.industry ? <Text style={styles.industry}>{v.industry}</Text> : null}
              <View style={styles.vacMeta}>
                <Text style={styles.metaText}>
                  Spots: {v.capacity - v.filled_count} remaining
                </Text>
                {v.start_date ? (
                  <Text style={styles.metaText}>
                    {v.start_date} → {v.end_date}
                  </Text>
                ) : null}
              </View>
              {v.description ? (
                <Text style={styles.description} numberOfLines={2}>{v.description}</Text>
              ) : null}
            </Card>
          </TouchableOpacity>
        ))
      )}

      {selected && (
        <InputField
          label="Preferred Sector (optional)"
          value={sector}
          onChangeText={setSector}
          placeholder={selected.industry ?? 'e.g. Technology, Finance'}
        />
      )}

      <Button
        title="Submit Application"
        onPress={handleApply}
        loading={loading}
        disabled={!selected}
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
    backgroundColor: Colors.locked,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: { color: Colors.lockedText, fontSize: 14 },

  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },

  vacCard:         { borderWidth: 2, borderColor: 'transparent' },
  vacCardSelected: { borderColor: Colors.primary, backgroundColor: '#EFF6FF' },

  vacHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  vacTitle:  { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, flex: 1 },
  checkmark: { fontSize: 18, color: Colors.primary, fontWeight: '700', marginLeft: 8 },

  orgName:   { fontSize: 14, color: Colors.textSecondary, marginTop: 2 },
  industry:  { fontSize: 12, color: Colors.info, marginTop: 2 },

  vacMeta:   { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  metaText:  { fontSize: 12, color: Colors.textMuted },

  description: { fontSize: 13, color: Colors.textSecondary, marginTop: 6, lineHeight: 18 },
  emptyText:   { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
});
