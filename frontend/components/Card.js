/**
 * Card Component — Digital LEAP
 * Reusable surface container used throughout the app.
 */

import { View, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';

export default function Card({ children, style }) {
  return (
    <View style={[styles.card, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius:    12,
    padding:         16,
    marginBottom:    12,
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 1 },
    shadowOpacity:   0.06,
    shadowRadius:    4,
    elevation:       2,
  },
});
