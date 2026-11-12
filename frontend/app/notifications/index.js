/**
 * Notifications Screen — Digital LEAP
 * FR-13: System sends notifications for key events.
 * Shows all in-app notifications with read/unread state.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, RefreshControl,
} from 'react-native';
import { notificationService } from '../../services/api';
import { Colors } from '../../constants/colors';
import ScreenWrapper from '../../components/ScreenWrapper';

// Icon map for notification types
const TYPE_ICONS = {
  placement_update:  '📋',
  logbook_update:    '📝',
  logbook_feedback:  '💬',
  visit_update:      '📅',
  result_update:     '🏆',
  account_update:    '👤',
  attendance_update: '📍',
  default:           '🔔',
};

function NotificationItem({ item, onMarkRead }) {
  const icon = TYPE_ICONS[item.type] ?? TYPE_ICONS.default;
  const isUnread = !item.is_read;

  return (
    <TouchableOpacity
      style={[styles.item, isUnread && styles.itemUnread]}
      onPress={() => !item.is_read && onMarkRead(item.notification_id)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={item.title}
      accessibilityState={{ selected: !isUnread }}
    >
      <View style={styles.iconBox}>
        <Text style={styles.icon}>{icon}</Text>
        {isUnread && <View style={styles.unreadDot} />}
      </View>

      <View style={styles.content}>
        <Text style={[styles.title, isUnread && styles.titleUnread]}>
          {item.title}
        </Text>
        <Text style={styles.message} numberOfLines={2}>
          {item.message}
        </Text>
        <Text style={styles.time}>
          {new Date(item.created_at).toLocaleString()}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [error,         setError]         = useState('');

  const fetchNotifications = useCallback(async () => {
    const result = await notificationService.list();
    if (result.success) {
      setNotifications(result.data ?? []);
      setError('');
    } else {
      setError(result.message);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  async function handleMarkRead(id) {
    await notificationService.markRead(id);
    setNotifications((prev) =>
      prev.map((n) => n.notification_id === id ? { ...n, is_read: 1 } : n)
    );
  }

  async function handleMarkAllRead() {
    const unread = notifications.filter((n) => !n.is_read);
    await Promise.all(unread.map((n) => notificationService.markRead(n.notification_id)));
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  if (loading) {
    return (
      <ScreenWrapper scrollable={false}>
        <Text style={styles.loadingText}>Loading notifications…</Text>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper scrollable={false} contentStyle={{ padding: 0 }}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          Notifications {unreadCount > 0 ? `(${unreadCount} unread)` : ''}
        </Text>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={handleMarkAllRead} accessibilityRole="button">
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <FlatList
        data={notifications}
        keyExtractor={(item) => String(item.notification_id)}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => {
            setRefreshing(true); fetchNotifications();
          }} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🔔</Text>
            <Text style={styles.emptyText}>No notifications yet.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <NotificationItem item={item} onMarkRead={handleMarkRead} />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  loadingText: { textAlign: 'center', marginTop: 32, color: Colors.textSecondary },

  header: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    alignItems:      'center',
    padding:         16,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle:  { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  markAllText:  { fontSize: 13, color: Colors.primary, fontWeight: '600' },

  errorBox: {
    backgroundColor: Colors.locked, borderRadius: 8, padding: 12, margin: 16,
  },
  errorText: { color: Colors.lockedText },

  item: {
    flexDirection:   'row',
    padding:         16,
    backgroundColor: Colors.surface,
  },
  itemUnread: {
    backgroundColor: '#F0F7FF',
  },

  iconBox: {
    width:          44,
    alignItems:     'center',
    justifyContent: 'flex-start',
    paddingTop:     2,
    position:       'relative',
  },
  icon:      { fontSize: 22 },
  unreadDot: {
    position:        'absolute',
    top:             0,
    right:           4,
    width:           8,
    height:          8,
    borderRadius:    4,
    backgroundColor: Colors.primary,
  },

  content: { flex: 1 },
  title: {
    fontSize:     14,
    fontWeight:   '500',
    color:        Colors.textSecondary,
    marginBottom: 2,
  },
  titleUnread: {
    fontWeight: '700',
    color:      Colors.textPrimary,
  },
  message: {
    fontSize:   13,
    color:      Colors.textSecondary,
    lineHeight: 18,
    marginBottom: 4,
  },
  time: {
    fontSize: 11,
    color:    Colors.textMuted,
  },

  separator: {
    height:          1,
    backgroundColor: Colors.border,
    marginLeft:      60,
  },

  emptyState: { alignItems: 'center', paddingTop: 80 },
  emptyIcon:  { fontSize: 48, marginBottom: 12 },
  emptyText:  { fontSize: 15, color: Colors.textSecondary },
});
