/**
 * FILENAME: src/components/DisclaimerModal.js
 * PURPOSE: First-launch disclaimer about content moderation and data handling.
 * Shown once per user; dismissal stored in AsyncStorage.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Linking,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import colors from '../constants/colors';

import { APP_NAME, TERMS_URL, PRIVACY_URL } from '../constants/app';
const DISCLAIMER_ACCEPTED_KEY = 'disclaimer_accepted_v1';
// Legal URLs live in constants/app.js so a rename is a one-file change
const TERMS_OF_SERVICE_URL = TERMS_URL;
const PRIVACY_POLICY_URL = PRIVACY_URL;

/**
 * Utility to check whether disclaimer needs showing.
 * Returns true if user has NOT accepted yet.
 */
export const shouldShowDisclaimer = async () => {
  try {
    const accepted = await AsyncStorage.getItem(DISCLAIMER_ACCEPTED_KEY);
    return !accepted;
  } catch {
    return true;
  }
};

const DisclaimerModal = ({ visible, onAccept }) => {
  const [accepted, setAccepted] = useState(false);

  const openLink = (url) => {
    Linking.openURL(url).catch(() =>
      Alert.alert('Cannot Open Link', 'Please visit this URL in your browser.')
    );
  };

  const handleAccept = async () => {
    setAccepted(true);
    try {
      await AsyncStorage.setItem(DISCLAIMER_ACCEPTED_KEY, new Date().toISOString());
    } catch (err) {
      console.error('Failed to save disclaimer acceptance:', err);
    }
    onAccept?.();
  };

  const screenHeight = Dimensions.get('window').height;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={() => {}} // Prevent dismissing without accepting
    >
      <View style={[styles.container, { height: screenHeight }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Welcome to {APP_NAME}</Text>
          <Text style={styles.subtitle}>Before you start cooking...</Text>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={true}
          bounces={true}
          nestedScrollEnabled={true}
          scrollEnabled={true}
          alwaysBounceVertical={true}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.section}>
            <Ionicons name="shield-checkmark" size={20} color={colors.primary} style={styles.sectionIcon} />
            <Text style={styles.sectionTitle}>Content Moderation</Text>
            <Text style={styles.sectionText}>
              To keep our community safe, we automatically check your recipe content:
            </Text>
            <Text style={styles.bulletPoint}>
              • Recipe <Text style={styles.bold}>photos</Text> are analyzed by Sightengine to detect
              inappropriate content before being saved.
            </Text>
            <Text style={styles.bulletPoint}>
              • Recipe <Text style={styles.bold}>text</Text> (titles, ingredients, instructions),
              usernames, and cookbook names are analyzed by OpenAI's Moderation API to detect
              harmful content.
            </Text>
            <Text style={styles.sectionText}>
              These services do not train AI models on your data and do not use it for advertising.
            </Text>
          </View>

          <View style={styles.section}>
            <Ionicons name="person" size={20} color={colors.primary} style={styles.sectionIcon} />
            <Text style={styles.sectionTitle}>Your Data</Text>
            <Text style={styles.sectionText}>
              Your recipes, cookbooks, and profile are stored securely on Supabase. Photos are
              stored in Supabase Storage. We use Google Sign-In for authentication.
            </Text>
            <Text style={styles.sectionText}>
              You can delete your account at any time from Settings.
            </Text>
          </View>

          <View style={styles.section}>
            <Ionicons name="document-text" size={20} color={colors.primary} style={styles.sectionIcon} />
            <Text style={styles.sectionTitle}>Community Rules</Text>
            <Text style={styles.sectionText}>
              By using {APP_NAME}, you agree to:
            </Text>
            <Text style={styles.bulletPoint}>
              • Only post recipes and content you have the right to share
            </Text>
            <Text style={styles.bulletPoint}>
              • Not post inappropriate, harmful, or illegal content
            </Text>
            <Text style={styles.bulletPoint}>
              • Respect other users
            </Text>
            <Text style={styles.sectionText}>
              You must be at least 13 years old to use {APP_NAME}.
            </Text>
          </View>

          <View style={styles.section}>
            <Ionicons name="newspaper" size={20} color={colors.primary} style={styles.sectionIcon} />
            <Text style={styles.sectionTitle}>Legal</Text>
            <Text style={styles.sectionText}>
              By tapping "I Agree", you accept our:
            </Text>
            <TouchableOpacity onPress={() => openLink(TERMS_OF_SERVICE_URL)}>
              <Text style={styles.link}>Terms of Service →</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => openLink(PRIVACY_POLICY_URL)}>
              <Text style={styles.link}>Privacy Policy →</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.acceptButton, accepted && styles.acceptedButton]}
            onPress={handleAccept}
            disabled={accepted}
          >
            <Text style={styles.acceptButtonText}>
              {accepted ? 'Accepted' : 'I Agree'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    padding: 20,
    paddingTop: 50,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
  },
  content: { flex: 1 },
  contentContainer: { padding: 20, paddingBottom: 40 },
  section: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionIcon: { fontSize: 24, marginBottom: 6 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  sectionText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
    marginBottom: 6,
  },
  bulletPoint: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
    marginBottom: 4,
    marginLeft: 4,
  },
  bold: { fontWeight: '700' },
  link: {
    fontSize: 15,
    color: colors.primary,
    fontWeight: '600',
    marginTop: 8,
  },
  footer: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  acceptButton: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  acceptedButton: { backgroundColor: '#95a5a6' },
  acceptButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default DisclaimerModal;
