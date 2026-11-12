/**
 * Button Component — Digital LEAP
 * Reusable primary, secondary, and danger button styles.
 */

import { TouchableOpacity, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';

export default function Button({
  title,
  onPress,
  variant  = 'primary',   // 'primary' | 'secondary' | 'danger' | 'outline'
  loading  = false,
  disabled = false,
  style,
  textStyle,
}) {
  const isDisabled = disabled || loading;

  const containerStyle = [
    styles.base,
    styles[variant] ?? styles.primary,
    isDisabled && styles.disabled,
    style,
  ];

  const labelStyle = [
    styles.label,
    styles[`${variant}Label`] ?? styles.primaryLabel,
    textStyle,
  ];

  return (
    <TouchableOpacity
      style={containerStyle}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'outline' ? Colors.primary : Colors.white}
          size="small"
        />
      ) : (
        <Text style={labelStyle}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical:   14,
    paddingHorizontal: 24,
    borderRadius:      8,
    alignItems:        'center',
    justifyContent:    'center',
    minHeight:         48,  // Accessibility minimum touch target
  },

  // Variants
  primary:      { backgroundColor: Colors.primary },
  secondary:    { backgroundColor: Colors.accent },
  danger:       { backgroundColor: Colors.error },
  outline: {
    backgroundColor: 'transparent',
    borderWidth:     2,
    borderColor:     Colors.primary,
  },

  disabled: { opacity: 0.5 },

  // Labels
  label:          { fontSize: 16, fontWeight: '600' },
  primaryLabel:   { color: Colors.white },
  secondaryLabel: { color: Colors.white },
  dangerLabel:    { color: Colors.white },
  outlineLabel:   { color: Colors.primary },
});
