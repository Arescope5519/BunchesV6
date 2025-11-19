/**
 * Username Setup Modal
 * Shown on first sign-in to set up unique username
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import colors from '../constants/colors';

export const UsernameSetupModal = ({
  visible,
  onSetup,
  checkAvailability,
  defaultDisplayName,
}) => {
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState(defaultDisplayName || '');
  const [isAvailable, setIsAvailable] = useState(null);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setUsername('');
      setDisplayName(defaultDisplayName || '');
      setIsAvailable(null);
      setError('');
    }
  }, [visible, defaultDisplayName]);

  // Check username availability with debounce
  useEffect(() => {
    if (!username || username.length < 3) {
      setIsAvailable(null);
      return;
    }

    const timer = setTimeout(async () => {
      setChecking(true);
      try {
        const available = await checkAvailability(username);
        setIsAvailable(available);
      } catch (err) {
        setIsAvailable(null);
      } finally {
        setChecking(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [username, checkAvailability]);

  const validateUsername = (value) => {
    // Only lowercase letters, numbers, underscores
    const cleaned = value.toLowerCase().replace(/[^a-z0-9_]/g, '');
    return cleaned.substring(0, 20); // Max 20 chars
  };

  const handleUsernameChange = (value) => {
    const validated = validateUsername(value);
    setUsername(validated);
    setError('');
  };

  const handleSubmit = async () => {
    if (!username || username.length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }

    if (isAvailable === null) {
      setError('Unable to verify username availability. Please check your connection and try again.');
      return;
    }

    if (isAvailable === false) {
      setError('Username is already taken');
      return;
    }

    setSubmitting(true);
    try {
      const success = await onSetup(username, displayName || username);
      if (!success) {
        setError('Failed to set up username. Please try again.');
      }
    } catch (err) {
      setError(err.message || 'Failed to set up username');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={() => {}} // Prevent closing without setup
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={styles.container}>
          <Text style={styles.title}>Welcome to Bunches!</Text>
          <Text style={styles.subtitle}>
            Choose a username so friends can find and share recipes with you
          </Text>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Username</Text>
            <View style={styles.usernameInputRow}>
              <Text style={styles.atSymbol}>@</Text>
              <TextInput
                style={styles.usernameInput}
                value={username}
                onChangeText={handleUsernameChange}
                placeholder="yourname"
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={20}
              />
              {checking && (
                <ActivityIndicator size="small" color={colors.primary} />
              )}
              {!checking && isAvailable === true && (
                <Text style={styles.availableIcon}>✓</Text>
              )}
              {!checking && isAvailable === false && (
                <Text style={styles.unavailableIcon}>✗</Text>
              )}
              {!checking && isAvailable === null && username.length >= 3 && (
                <Text style={styles.errorIcon}>⚠️</Text>
              )}
            </View>
            {username.length > 0 && username.length < 3 && (
              <Text style={styles.hint}>At least 3 characters</Text>
            )}
            {isAvailable === false && (
              <Text style={styles.unavailableText}>Username is taken</Text>
            )}
            {isAvailable === true && (
              <Text style={styles.availableText}>Username is available!</Text>
            )}
            {isAvailable === null && username.length >= 3 && !checking && (
              <Text style={styles.errorText}>Unable to check availability. Check your internet connection.</Text>
            )}
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Display Name (optional)</Text>
            <TextInput
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Your Name"
              placeholderTextColor={colors.textSecondary}
              maxLength={30}
            />
            <Text style={styles.hint}>
              This is what friends will see. Defaults to username if empty.
            </Text>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[
              styles.button,
              (!isAvailable || submitting) && styles.buttonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!isAvailable || submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Get Started</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.note}>
            Your username cannot be changed later
          </Text>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  usernameInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
  },
  atSymbol: {
    fontSize: 16,
    color: colors.textSecondary,
    marginRight: 4,
  },
  usernameInput: {
    flex: 1,
    padding: 12,
    paddingLeft: 0,
    fontSize: 16,
    color: colors.text,
  },
  availableIcon: {
    fontSize: 18,
    color: colors.success || '#4CAF50',
    marginLeft: 8,
  },
  unavailableIcon: {
    fontSize: 18,
    color: colors.error || '#f44336',
    marginLeft: 8,
  },
  hint: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  availableText: {
    fontSize: 12,
    color: colors.success || '#4CAF50',
    marginTop: 4,
  },
  unavailableText: {
    fontSize: 12,
    color: colors.error || '#f44336',
    marginTop: 4,
  },
  errorIcon: {
    fontSize: 16,
    marginLeft: 8,
  },
  errorText: {
    fontSize: 12,
    color: colors.warning || '#FF9800',
    marginTop: 4,
  },
  error: {
    fontSize: 14,
    color: colors.error || '#f44336',
    textAlign: 'center',
    marginBottom: 16,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    backgroundColor: colors.textSecondary,
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  note: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 12,
  },
});

export default UsernameSetupModal;
