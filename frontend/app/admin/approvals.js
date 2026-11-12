/**
 * Pending Account Approvals Screen — Digital LEAP
 * FR-02: Coordinator approves student and host accounts.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, RefreshControl, Alert,
} from 'react-native';
import { useAuth } from '../../hooks/useAuth';
import { userService } from '../../services/api';
import { Colors } from '../../constants/colors';
import { getRoleLabel } from '../../constants/roles';
import ScreenWrapper from '../../components/ScreenWrapper';
import Card from '../../components/Card';
import Button from '../../components/Button';
import StatusBadge from '../../components/StatusBadge';

export default function ApprovalsScreen() {
  const { user } = useAuth();
  const [pending,    setPending]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState('');

  const fetchPending = useCallback(async () => {
    const result = await userService.listPending();
    if (result.success) {
      setPending(result.data ?? []);
      setError('');
    } else {
      setError(result.message);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { fetchPending(); }, [fetchPending]);

  async function handleApprove(userId, fullName) {
    Alert.alert(
      'Approve Account',
      `Approve account for ${fullName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            const r = await userService.updateStatus(userId, { status: 'active' });
            if (r.success) {
              setPending((prev) => prev.filter((u) => u.user_id !== userId));
            } else {
              Alert.alert('Error', r.message);
            }
          },
        },
      ]
    );
  }

  async function handleReject(userId, fullName) {
    Alert.alert(
      'Suspend Account',
      `Suspend account for ${fullName}? They will not be able to log in.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Suspend',
          style: 'destructive',
          onPress: async () => {
            const r = await userService.updateStatus(userId, { status: 'suspended' });
            if (r.success) {
              setPending((prev) => prev.filter((u) => u.user_id !== userId));
            } else {
              Alert.alert('Error', r.message);
            }
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <ScreenWrapper scrollable={false}>
        <Text style={styles.loadingText}>Loading pending accounts…</Text>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper scrollable={false} contentStyle={{ padding: 0 }}>
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <FlatList
        data={pending}
        keyExtractor={(item) => String(item.user_id)}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => {
            setRefreshing(true); fetchPending();
          }} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>✅</Text>
            <Text style={styles.emptyText}>No pending accounts.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {item.full_name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.info}>
                <Text style={styles.name}>{item.full_name}</Text>
                <Text style={styles.email}>{item.email}</Text>
                <View style={styles.roles}>
                  {(item.roles ?? []).map((r) => (
                    <View key={r} style={styles.roleTag}>
                      <Text style={styles.roleTagText}>{getRoleLabel(r)}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            <Text style={styles.date}>
              Registered: {new Date(item.created_at).toLocaleDateString()}
            </Text>

            <View style={styles.actions}>
              <Button
                title="Approve"
                onPress={() => handleApprove(item.user_id, item.full_name)}
                style={styles.approveBtn}
              />
              <Button
                title="Suspend"
                variant="danger"
                onPress={() => handleReject(item.user_id, item.full_name)}
                style={styles.rejectBtn}
              />
            </View>
          </Card>
        )}
      />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  list:        { padding: 16, paddingBottom: 40 },
  loadingText: { textAlign: 'center', marginTop: 32, color: Colors.textSecondary },

  errorBox: {
    backgroundColor: Colors.locked,
    padding: 12,
    margin: 16,
    borderRadius: 8,
  },
  errorText: { color: Colors.lockedText },

  card:       { marginBottom: 12 },
  cardHeader: { flexDirection: 'row', marginBottom: 10 },

  avatar: {
    width:           44,
    height:          44,
    borderRadius:    22,
    backgroundColor: Colors.primary,
    alignItems:      'center',
    justifyContent:  'center',
    marginRight:     12,
  },
  avatarText: { color: Colors.white, fontWeight: '700', fontSize: 18 },

  info:   { flex: 1 },
  name:   { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  email:  { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },

  roles:      { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  roleTag:    { backgroundColor: Colors.background, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  roleTagText:{ fontSize: 11, color: Colors.textSecondary },

  date:    { fontSize: 12, color: Colors.textMuted, marginBottom: 12 },
  actions: { flexDirection: 'row', gap: 8 },
  approveBtn: { flex: 1 },
  rejectBtn:  { flex: 1 },

  emptyState: { alignItems: 'center', paddingTop: 60 },
  emptyIcon:  { fontSize: 48, marginBottom: 12 },
  emptyText:  { fontSize: 15, color: Colors.textSecondary },
});
