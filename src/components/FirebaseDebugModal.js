import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import colors from '../constants/colors';

const FirebaseDebugModal = ({ visible, onClose, debugInfo }) => {
  const getStatusIcon = (available) => (available ? '✅' : '❌');
  const getStatusText = (available) => (available ? 'Available' : 'NOT Available');

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.title}>🔍 Firebase Debug Info</Text>

          <ScrollView style={styles.scrollView}>
            {/* Firebase Status */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Firebase Status</Text>
              <View style={styles.statusRow}>
                <Text style={styles.statusIcon}>
                  {getStatusIcon(debugInfo.firebaseAvailable)}
                </Text>
                <Text style={styles.statusText}>
                  Firebase Core: {getStatusText(debugInfo.firebaseAvailable)}
                </Text>
              </View>
              <View style={styles.statusRow}>
                <Text style={styles.statusIcon}>
                  {getStatusIcon(debugInfo.authAvailable)}
                </Text>
                <Text style={styles.statusText}>
                  Authentication: {getStatusText(debugInfo.authAvailable)}
                </Text>
              </View>
              <View style={styles.statusRow}>
                <Text style={styles.statusIcon}>
                  {getStatusIcon(debugInfo.firestoreAvailable)}
                </Text>
                <Text style={styles.statusText}>
                  Firestore: {getStatusText(debugInfo.firestoreAvailable)}
                </Text>
              </View>
            </View>

            {/* Errors */}
            {debugInfo.errors && debugInfo.errors.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Errors</Text>
                {debugInfo.errors.map((error, index) => (
                  <View key={index} style={styles.errorBox}>
                    <Text style={styles.errorTitle}>{error.module}</Text>
                    <Text style={styles.errorMessage}>{error.message}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Mode */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Current Mode</Text>
              <Text style={styles.modeText}>
                {debugInfo.firebaseAvailable
                  ? '🔥 Firebase Cloud Mode'
                  : '📱 Local-Only Mode'}
              </Text>
            </View>

            {/* Instructions */}
            {!debugInfo.firebaseAvailable && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>How to Enable Firebase</Text>
                <Text style={styles.instructionText}>
                  1. Run: npm install{'\n'}
                  2. Rebuild the app{'\n'}
                  3. Relaunch{'\n\n'}
                  If error persists, check FIREBASE_SETUP.md
                </Text>
              </View>
            )}
          </ScrollView>

          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.background,
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 20,
    textAlign: 'center',
  },
  scrollView: {
    maxHeight: 400,
  },
  section: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 10,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  statusText: {
    fontSize: 16,
    color: colors.text,
  },
  errorBox: {
    backgroundColor: '#ffebee',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#f44336',
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#c62828',
    marginBottom: 4,
  },
  errorMessage: {
    fontSize: 13,
    color: '#d32f2f',
    fontFamily: 'monospace',
  },
  modeText: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '600',
  },
  instructionText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 22,
  },
  closeButton: {
    backgroundColor: colors.primary,
    padding: 15,
    borderRadius: 12,
    marginTop: 10,
    alignItems: 'center',
  },
  closeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default FirebaseDebugModal;
