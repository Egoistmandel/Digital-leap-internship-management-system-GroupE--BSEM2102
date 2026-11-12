/**
 * InputField Component — Digital LEAP
 * Reusable text input with label, error display, and accessibility support.
 */

import { View, Text, TextInput, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';

export default function InputField({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  keyboardType    = 'default',
  autoCapitalize  = 'sentences',
  error,
  editable        = true,
  multiline       = false,
  numberOfLines   = 1,
  style,
}) {
  const inputStyle = [
    styles.input,
    error    && styles.inputError,
    !editable && styles.inputDisabled,
    multiline && { height: numberOfLines * 24 + 24, textAlignVertical: 'top' },
    style,
  ];

  return (
    <View style={styles.container}>
      {label ? (
        <Text style={styles.label} accessibilityRole="text">
          {label}
        </Text>
      ) : null}

      <TextInput
        style={inputStyle}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.placeholder}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        editable={editable}
        multiline={multiline}
        numberOfLines={multiline ? numberOfLines : undefined}
        accessibilityLabel={label}
        accessibilityHint={error ?? undefined}
      />

      {error ? (
        <Text style={styles.errorText} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize:     14,
    fontWeight:   '600',
    color:        Colors.textPrimary,
    marginBottom: 6,
  },
  input: {
    backgroundColor:  Colors.white,
    borderWidth:      1,
    borderColor:      Colors.border,
    borderRadius:     8,
    paddingHorizontal:14,
    paddingVertical:  12,
    fontSize:         15,
    color:            Colors.textPrimary,
    minHeight:        48,
  },
  inputError: {
    borderColor: Colors.error,
  },
  inputDisabled: {
    backgroundColor: Colors.background,
    color:           Colors.textSecondary,
  },
  errorText: {
    fontSize:   12,
    color:      Colors.error,
    marginTop:  4,
  },
});
