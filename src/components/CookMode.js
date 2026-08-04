/**
 * FILENAME: src/components/CookMode.js
 * PURPOSE: Hands-on cooking view - tap ingredients and steps to cross
 * them off as you go.
 *
 * Session-scoped by design: progress lives in component state and is
 * cleared when you finish, so starting the recipe again begins fresh.
 * Nothing is written to the recipe or the database.
 *
 * Keeps the screen awake while open (expo-keep-awake) and uses larger
 * type than the normal recipe view so it is readable at arm's length.
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import colors from '../constants/colors';

// Keeping the screen awake is a convenience, not core to cooking. If the
// native module is ever missing or version-skewed, fall back to a no-op
// so Cook Mode still opens instead of crashing the app.
let useKeepAwake = () => {};
try {
  const keepAwake = require('expo-keep-awake');
  if (typeof keepAwake?.useKeepAwake === 'function') {
    useKeepAwake = keepAwake.useKeepAwake;
  }
} catch (err) {
  console.log('expo-keep-awake unavailable - screen may sleep while cooking');
}

// Pull display text out of whatever shape an ingredient is in
const ingredientText = (item) => {
  if (typeof item === 'string') return item;
  return item?.original || item?.text || '';
};

export const CookMode = ({ visible, onClose, recipe, ingredients, instructions }) => {
  const [checkedIngredients, setCheckedIngredients] = useState({});
  const [checkedSteps, setCheckedSteps] = useState({});

  // Flatten sections into { key, section, text } rows, keeping section order
  const ingredientRows = useMemo(() => {
    const rows = [];
    Object.entries(ingredients || {}).forEach(([section, items]) => {
      (Array.isArray(items) ? items : []).forEach((item, idx) => {
        const text = ingredientText(item);
        if (text) rows.push({ key: `${section}-${idx}`, section, text });
      });
    });
    return rows;
  }, [ingredients]);

  const steps = useMemo(
    () => (instructions || []).filter(s => typeof s === 'string' && s.trim()),
    [instructions]
  );

  const doneIngredients = Object.values(checkedIngredients).filter(Boolean).length;
  const doneSteps = Object.values(checkedSteps).filter(Boolean).length;
  const allDone = steps.length > 0 && doneSteps === steps.length;

  const toggleIngredient = (key) =>
    setCheckedIngredients(prev => ({ ...prev, [key]: !prev[key] }));

  const toggleStep = (idx) =>
    setCheckedSteps(prev => ({ ...prev, [idx]: !prev[idx] }));

  const reset = () => {
    setCheckedIngredients({});
    setCheckedSteps({});
  };

  const finish = () => {
    reset();
    onClose();
  };

  const handleClose = () => {
    if (doneIngredients === 0 && doneSteps === 0) {
      finish();
      return;
    }
    Alert.alert(
      'Leave Cook Mode?',
      'Your progress for this session will be cleared.',
      [
        { text: 'Keep Cooking', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: finish },
      ]
    );
  };

  // Track section changes so headers only render once per section
  let lastSection = null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <CookModeBody
        recipe={recipe}
        onClose={handleClose}
        onReset={reset}
        allDone={allDone}
        onFinish={finish}
        doneSteps={doneSteps}
        totalSteps={steps.length}
      >
        {/* Ingredients */}
        {ingredientRows.length > 0 && (
          <>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Ingredients</Text>
              <Text style={styles.sectionCount}>
                {doneIngredients}/{ingredientRows.length}
              </Text>
            </View>
            {ingredientRows.map(row => {
              const showHeader = row.section !== lastSection && row.section !== 'main';
              lastSection = row.section;
              const checked = !!checkedIngredients[row.key];
              return (
                <View key={row.key}>
                  {showHeader && (
                    <Text style={styles.subsectionTitle}>{row.section}</Text>
                  )}
                  <TouchableOpacity
                    style={styles.row}
                    onPress={() => toggleIngredient(row.key)}
                    activeOpacity={0.6}
                  >
                    <View style={[styles.checkCircle, checked && styles.checkCircleDone]}>
                      {checked && <Ionicons name="checkmark" size={15} color="#fff" />}
                    </View>
                    <Text style={[styles.rowText, checked && styles.rowTextDone]}>
                      {row.text}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </>
        )}

        {/* Steps */}
        {steps.length > 0 && (
          <>
            <View style={[styles.sectionHeaderRow, { marginTop: 26 }]}>
              <Text style={styles.sectionTitle}>Steps</Text>
              <Text style={styles.sectionCount}>
                {doneSteps}/{steps.length}
              </Text>
            </View>
            {steps.map((step, idx) => {
              const checked = !!checkedSteps[idx];
              return (
                <TouchableOpacity
                  key={`step-${idx}`}
                  style={[styles.stepRow, checked && styles.stepRowDone]}
                  onPress={() => toggleStep(idx)}
                  activeOpacity={0.6}
                >
                  <View style={[styles.stepNumber, checked && styles.stepNumberDone]}>
                    {checked ? (
                      <Ionicons name="checkmark" size={16} color="#fff" />
                    ) : (
                      <Text style={styles.stepNumberText}>{idx + 1}</Text>
                    )}
                  </View>
                  <Text style={[styles.stepText, checked && styles.rowTextDone]}>
                    {step}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </>
        )}

        <View style={{ height: 40 }} />
      </CookModeBody>
    </Modal>
  );
};

/**
 * Separate body component so useKeepAwake only runs while the modal
 * content is actually mounted.
 */
const CookModeBody = ({
  recipe, onClose, onReset, allDone, onFinish, doneSteps, totalSteps, children,
}) => {
  useKeepAwake();

  return (
    <View style={styles.container}>
      <StatusBar style="light" hidden={true} />

      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.headerButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="close" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {recipe?.title || 'Cooking'}
          </Text>
          <Text style={styles.headerSubtitle}>
            {totalSteps > 0 ? `Step ${Math.min(doneSteps + (allDone ? 0 : 1), totalSteps)} of ${totalSteps}` : 'Cook Mode'}
          </Text>
        </View>
        <TouchableOpacity onPress={onReset} style={styles.headerButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="refresh" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Progress bar */}
      {totalSteps > 0 && (
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${(doneSteps / totalSteps) * 100}%` }]} />
        </View>
      )}

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
      >
        {children}
      </ScrollView>

      {allDone && (
        <View style={styles.doneBar}>
          <Ionicons name="checkmark-circle" size={20} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.doneBarText}>All steps done</Text>
          <TouchableOpacity onPress={onFinish} style={styles.doneButton}>
            <Text style={styles.doneButtonText}>Finish</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    height: 100,
    paddingTop: 38,
    paddingBottom: 8,
    paddingHorizontal: 12,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  headerSubtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 },
  progressTrack: {
    height: 4,
    backgroundColor: colors.borderLight,
  },
  progressFill: {
    height: 4,
    backgroundColor: colors.accent,
  },
  content: { flex: 1 },
  contentContainer: { padding: 20 },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  sectionCount: { fontSize: 14, fontWeight: '600', color: colors.textTertiary },
  subsectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
    marginTop: 12,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderVeryLight,
  },
  checkCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: colors.border,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkCircleDone: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  rowText: { flex: 1, fontSize: 17, lineHeight: 24, color: colors.text },
  rowTextDone: {
    color: colors.textLight,
    textDecorationLine: 'line-through',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginBottom: 10,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  stepRowDone: {
    backgroundColor: colors.background,
    borderColor: colors.borderVeryLight,
  },
  stepNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepNumberDone: { backgroundColor: colors.primary },
  stepNumberText: { fontSize: 15, fontWeight: '700', color: colors.primary },
  stepText: { flex: 1, fontSize: 17, lineHeight: 25, color: colors.text },
  doneBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  doneBarText: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '700' },
  doneButton: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
  doneButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});

export default CookMode;
