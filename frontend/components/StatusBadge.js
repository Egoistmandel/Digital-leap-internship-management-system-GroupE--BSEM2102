/**
 * StatusBadge Component — Digital LEAP
 * Displays placement, logbook, and account status with appropriate colour.
 */

import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';

const STATUS_STYLES = {
  pending:              { bg: '#FEF3C7', text: '#92400E' },
  coordinator_approved: { bg: '#DBEAFE', text: '#1E40AF' },
  awaiting_host:        { bg: '#EDE9FE', text: '#5B21B6' },
  confirmed:            { bg: '#D1FAE5', text: '#065F46' },
  active:               { bg: '#D1FAE5', text: '#065F46' },
  completed:            { bg: '#E5E7EB', text: '#374151' },
  rejected:             { bg: '#FEE2E2', text: '#991B1B' },
  submitted:            { bg: '#DBEAFE', text: '#1E40AF' },
  approved:             { bg: '#D1FAE5', text: '#065F46' },
  revision_requested:   { bg: '#FEF3C7', text: '#92400E' },
  draft:                { bg: '#F3F4F6', text: '#6B7280' },
  locked:               { bg: '#FEE2E2', text: '#991B1B' },
  suspended:            { bg: '#FEE2E2', text: '#991B1B' },
};

function formatLabel(status) {
  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function StatusBadge({ status, style }) {
  const s = STATUS_STYLES[status] ?? { bg: Colors.background, text: Colors.textSecondary };

  return (
    <View style={[styles.badge, { backgroundColor: s.bg }, style]}>
      <Text style={[styles.text, { color: s.text }]}>
        {formatLabel(status ?? 'unknown')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical:   4,
    borderRadius:      20,
    alignSelf:         'flex-start',
  },
  text: {
    fontSize:   12,
    fontWeight: '600',
  },
});
