/**
 * GPS Attendance Screen — Digital LEAP
 * Additional lecturer requirement (D-04).
 *
 * Students record GPS check-in with explicit consent.
 * Privacy rules:
 * - Location is never collected without an explicit consent toggle being ON.
 * - The consent explanation is shown prominently before any collection.
 * - Students can withdraw consent at any time by not toggling the switch.
 */

import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Switch, Alert, FlatList,
} from 'react-native';
import * as Location from 'expo-location';
import { useAuth } from '../../hooks/useAuth';
import { placementService, attendanceService } from '../../services/api';
import { Colors } from '../../constants/colors';
import ScreenWrapper from '../../components/ScreenWrapper';
import Card from '../../components/Card';
import Button from '../../components/Button';
import StatusBadge from '../../components/StatusBadge';

// Attendance service imported from api.js above

export default function AttendanceScreen() {
  const { user } = useAuth();

  const [placementId,  setPlacementId]  = useState(null);
  const [records,      setRecords]      = useState([]);
  const [consent,      setConsent]      = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [fetchingData, setFetchingData] = useState(true);
  const [permGranted,  setPermGranted]  = useState(false);
  const [error,        setError]        = useState('');

  useEffect(() => {
    (async () => {
      // Check location permission
      const { status } = await Location.getForegroundPermissionsAsync();
      setPermGranted(status === 'granted');

      // Load active placement
      const result = await placementService.list();
      if (result.success) {
        const pl = (result.data ?? []).find(
          (p) => ['confirmed', 'active'].includes(p.status)
        );
        if (pl) {
          setPlacementId(pl.placement_id);
          const records = await attendanceService.list(pl.placement_id);
          if (records.success) setRecords(records.data ?? []);
        }
      }
      setFetchingData(false);
    })();
  }, []);

  async function requestPermission() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    setPermGranted(status === 'granted');
    if (status !== 'granted') {
      Alert.alert(
        'Permission Denied',
        'Location permission is required for GPS attendance. ' +
        'You can enable it in your device Settings.'
      );
    }
  }

  async function handleCheckIn() {
    setError('');

    if (!consent) {
      setError('Please enable the consent toggle before recording attendance.');
      return;
    }

    if (!permGranted) {
      await requestPermission();
      return;
    }

    setLoading(true);

    try {
      // Get current position
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const result = await attendanceService.record({
        placement_id:    placementId,
        latitude:        loc.coords.latitude,
        longitude:       loc.coords.longitude,
        accuracy_meters: loc.coords.accuracy,
        consent_given:   true,
      });

      if (result.success) {
        Alert.alert(
          'Check-In Recorded',
          'Your attendance has been recorded and is awaiting verification by your supervisor.',
          [{ text: 'OK' }]
        );
        const updated = await attendanceService.list(placementId);
        if (updated.success) setRecords(updated.data ?? []);
      } else {
        setError(result.message ?? 'Could not record attendance.');
      }
    } catch (e) {
      setError('Could not get your location. Please check GPS is enabled.');
    }

    setLoading(false);
  }

  if (fetchingData) {
    return (
      <ScreenWrapper scrollable={false}>
        <Text style={styles.loadingText}>Loading attendance data…</Text>
      </ScreenWrapper>
    );
  }

  if (!placementId) {
    return (
      <ScreenWrapper scrollable={false}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📍</Text>
          <Text style={styles.emptyText}>
            No active placement found. GPS attendance is only available
            once your placement is confirmed.
          </Text>
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      <Text style={styles.title}>GPS Attendance</Text>

      {/* Privacy notice — shown prominently before any collection */}
      <View style={styles.privacyBox}>
        <Text style={styles.privacyTitle}>📍 Location Privacy Notice</Text>
        <Text style={styles.privacyText}>
          Your GPS location will be recorded only to verify your physical
          attendance at the internship site. Location data is stored securely,
          accessible only to your supervisor and coordinator, and used solely
          for attendance verification. You can withdraw consent at any time
          by turning off the toggle below.
        </Text>
      </View>

      {/* Consent toggle */}
      <Card>
        <View style={styles.consentRow}>
          <View style={styles.consentText}>
            <Text style={styles.consentLabel}>I consent to location recording</Text>
            <Text style={styles.consentSub}>
              Required before check-in can be recorded.
            </Text>
          </View>
          <Switch
            value={consent}
            onValueChange={setConsent}
            trackColor={{ false: Colors.border, true: Colors.success }}
            thumbColor={consent ? Colors.white : Colors.textMuted}
            accessibilityLabel="Consent to GPS location recording"
          />
        </View>
      </Card>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {!permGranted ? (
        <View style={styles.permWarning}>
          <Text style={styles.permText}>
            ⚠ Location permission not granted. Tap below to request access.
          </Text>
          <Button
            title="Grant Location Permission"
            variant="outline"
            onPress={requestPermission}
            style={{ marginTop: 8 }}
          />
        </View>
      ) : null}

      <Button
        title="Record Check-In Now"
        onPress={handleCheckIn}
        loading={loading}
        disabled={!consent || !permGranted}
        style={{ marginTop: 8, marginBottom: 24 }}
      />

      {/* History */}
      <Text style={styles.sectionTitle}>Check-In History</Text>
      {records.length === 0 ? (
        <Card>
          <Text style={styles.emptyText}>No check-in records yet.</Text>
        </Card>
      ) : (
        records.map((r) => (
          <Card key={r.attendance_id} style={styles.recordCard}>
            <View style={styles.recordRow}>
              <View>
                <Text style={styles.recordDate}>
                  {new Date(r.recorded_at).toLocaleString()}
                </Text>
                {r.accuracy_meters ? (
                  <Text style={styles.recordAccuracy}>
                    Accuracy: ±{Math.round(r.accuracy_meters)}m
                  </Text>
                ) : null}
              </View>
              <StatusBadge status={r.verified_status} />
            </View>
          </Card>
        ))
      )}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  title:       { fontSize: 22, fontWeight: '700', color: Colors.textPrimary, marginBottom: 16 },
  loadingText: { textAlign: 'center', marginTop: 32, color: Colors.textSecondary },

  privacyBox: {
    backgroundColor: '#EFF6FF',
    borderRadius:    10,
    padding:         14,
    marginBottom:    16,
    borderLeftWidth: 3,
    borderLeftColor: Colors.info,
  },
  privacyTitle: { fontSize: 14, fontWeight: '700', color: Colors.info, marginBottom: 6 },
  privacyText:  { fontSize: 13, color: Colors.info, lineHeight: 20 },

  consentRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
  },
  consentText:  { flex: 1, marginRight: 12 },
  consentLabel: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  consentSub:   { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },

  errorBox: {
    backgroundColor: Colors.locked, borderRadius: 8,
    padding: 12, marginBottom: 12,
  },
  errorText: { color: Colors.lockedText, fontSize: 14 },

  permWarning: {
    backgroundColor: '#FEF9C3', borderRadius: 8,
    padding: 12, marginBottom: 12,
    borderLeftWidth: 3, borderLeftColor: Colors.warning,
  },
  permText: { fontSize: 13, color: '#78350F' },

  sectionTitle: {
    fontSize: 14, fontWeight: '700', color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10,
  },

  recordCard: { marginBottom: 8 },
  recordRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  recordDate: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  recordAccuracy: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },

  emptyState: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 24 },
  emptyIcon:  { fontSize: 48, marginBottom: 16 },
  emptyText:  { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
});
