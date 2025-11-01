/**
 * FILENAME: src/components/RecipeDetail/InstructionsSection.js
 * PURPOSE: Display and edit recipe instructions
 * NEW: Improved move mode and immediate add-below functionality
 * USED BY: src/components/RecipeDetail.js
 */

import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import colors from '../../constants/colors';

const InstructionsSection = ({ instructions, displayedInstructions, onUpdate }) => {
  const [editingIndex, setEditingIndex] = useState(null);
  const [tempValue, setTempValue] = useState('');
  const [moveMode, setMoveMode] = useState(null); // index of item being moved
  const [showAddField, setShowAddField] = useState(null); // index to add below

  const handleLongPress = (index, value) => {
    setEditingIndex(index);
    setTempValue(value);
    setMoveMode(null);
    setShowAddField(null);
  };

  const handleTap = (targetIndex) => {
    if (moveMode !== null) {
      // Move instruction to this position
      moveInstruction(moveMode, targetIndex);
      setMoveMode(null);
    }
  };

  const moveInstruction = (fromIndex, toIndex) => {
    if (fromIndex === toIndex) return;

    const updated = [...instructions];
    const [removed] = updated.splice(fromIndex, 1);

    // Place BELOW the target (after it)
    if (toIndex > fromIndex) {
      updated.splice(toIndex, 0, removed);
    } else {
      updated.splice(toIndex + 1, 0, removed);
    }

    onUpdate(updated);
  };

  const startMove = () => {
    if (editingIndex !== null) {
      setMoveMode(editingIndex);
      setEditingIndex(null);
      setTempValue('');
    }
  };

  const saveEdit = () => {
    if (!tempValue.trim()) return;

    const updated = [...instructions];
    updated[editingIndex] = tempValue.trim();
    onUpdate(updated);
    setEditingIndex(null);
    setTempValue('');
  };

  const deleteStep = () => {
    Alert.alert(
      'Delete Step?',
      'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const updated = [...instructions];
            updated.splice(editingIndex, 1);
            onUpdate(updated);
            setEditingIndex(null);
            setTempValue('');
          }
        }
      ]
    );
  };

  const startAddBelow = () => {
    if (editingIndex !== null) {
      // Save current edits first
      saveEdit();
      // Then show add field
      setShowAddField(editingIndex);
    }
  };

  const saveNewStep = (index, value) => {
    if (!value.trim()) return;

    const updated = [...instructions];
    updated.splice(index + 1, 0, value.trim());
    onUpdate(updated);
    setShowAddField(null);
  };

  const addNewStep = () => {
    const updated = [...instructions, ''];
    onUpdate(updated);
    setEditingIndex(updated.length - 1);
    setTempValue('');
  };

  // Use displayed instructions if available (scaled), otherwise use original
  const stepsToShow = displayedInstructions || instructions;

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>📝 Instructions</Text>
        {moveMode !== null ? (
          <TouchableOpacity
            style={styles.cancelMoveButton}
            onPress={() => setMoveMode(null)}
          >
            <Text style={styles.cancelMoveText}>Cancel Move</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.addNewButton} onPress={addNewStep}>
            <Text style={styles.addNewButtonText}>+ Add Step</Text>
          </TouchableOpacity>
        )}
      </View>

      {moveMode !== null && (
        <View style={styles.moveBanner}>
          <Text style={styles.moveBannerText}>
            📍 Tap a step to place step {moveMode + 1} below it
          </Text>
        </View>
      )}

      {stepsToShow.map((step, index) => (
        <View key={index}>
          {editingIndex === index ? (
            // Edit mode
            <View style={styles.editContainer}>
              <View style={styles.instructionStep}>
                <Text style={styles.stepNumber}>{index + 1}.</Text>
                <TextInput
                  style={styles.stepTextInput}
                  value={tempValue}
                  onChangeText={setTempValue}
                  multiline
                  autoFocus={false}  // Don't auto-show keyboard
                />
              </View>
              <View style={styles.actionButtons}>
                <TouchableOpacity style={styles.saveButton} onPress={saveEdit}>
                  <Text style={styles.buttonText}>✓ Save</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.moveButton} onPress={startMove}>
                  <Text style={styles.buttonText}>↕️ Move</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.addButton} onPress={startAddBelow}>
                  <Text style={styles.buttonText}>+ Below</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteButton} onPress={deleteStep}>
                  <Text style={styles.buttonText}>🗑️</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              {/* Normal display */}
              <TouchableOpacity
                onLongPress={() => handleLongPress(index, instructions[index])}
                onPress={() => handleTap(index)}
                delayLongPress={300}
              >
                <View style={[
                  styles.instructionStep,
                  moveMode === index && styles.moveMode,
                  moveMode !== null && moveMode !== index && styles.moveTarget
                ]}>
                  {moveMode === index && (
                    <Text style={styles.dragHandle}>≡</Text>
                  )}
                  <Text style={styles.stepNumber}>{index + 1}.</Text>
                  <Text style={styles.stepText}>{step}</Text>
                </View>
              </TouchableOpacity>

              {/* Add field below this step */}
              {showAddField === index && (
                <AddStepField
                  index={index}
                  onSave={(value) => saveNewStep(index, value)}
                  onCancel={() => setShowAddField(null)}
                />
              )}
            </>
          )}
        </View>
      ))}
    </View>
  );
};

// Separate component for add step field
const AddStepField = ({ index, onSave, onCancel }) => {
  const [value, setValue] = useState('');

  const handleSave = () => {
    onSave(value);
    setValue('');
  };

  return (
    <View style={styles.addBelowContainer}>
      <Text style={styles.stepNumber}>{index + 2}.</Text>
      <TextInput
        style={styles.addBelowInput}
        value={value}
        onChangeText={setValue}
        placeholder="New step..."
        multiline
        autoFocus
        onSubmitEditing={handleSave}
      />
      <View style={styles.addBelowButtons}>
        <TouchableOpacity style={styles.inlineButton} onPress={handleSave}>
          <Text style={styles.inlineButtonText}>✓</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.inlineButton, styles.cancelInlineButton]}
          onPress={onCancel}
        >
          <Text style={styles.inlineButtonText}>✕</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  addNewButton: {
    backgroundColor: colors.primary,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  addNewButtonText: {
    color: colors.white,
    fontWeight: 'bold',
    fontSize: 14,
  },
  cancelMoveButton: {
    backgroundColor: colors.error,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  cancelMoveText: {
    color: colors.white,
    fontWeight: 'bold',
    fontSize: 14,
  },
  moveBanner: {
    backgroundColor: colors.highlightYellow,
    padding: 10,
    borderRadius: 8,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  moveBannerText: {
    fontSize: 14,
    color: colors.text,
    textAlign: 'center',
    fontWeight: '500',
  },
  instructionStep: {
    flexDirection: 'row',
    marginBottom: 15,
    padding: 4,
    borderRadius: 4,
  },
  moveMode: {
    backgroundColor: colors.highlightYellow,
    borderWidth: 1,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    padding: 8,
  },
  moveTarget: {
    backgroundColor: colors.lightPrimary,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'solid',
    padding: 8,
  },
  dragHandle: {
    fontSize: 18,
    marginRight: 8,
    color: colors.primary,
    fontWeight: 'bold',
  },
  stepNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.primary,
    marginRight: 10,
    minWidth: 25,
  },
  stepText: {
    fontSize: 15,
    flex: 1,
    color: colors.text,
    paddingVertical: 4,
  },
  stepTextInput: {
    fontSize: 15,
    flex: 1,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.primary,
    padding: 8,
    borderRadius: 6,
    backgroundColor: colors.background,
    minHeight: 60,
  },
  editContainer: {
    marginBottom: 15,
    backgroundColor: colors.background,
    padding: 8,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 35,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  saveButton: {
    backgroundColor: colors.success,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  moveButton: {
    backgroundColor: colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  deleteButton: {
    backgroundColor: colors.error,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  addButton: {
    backgroundColor: colors.secondary || '#6C757D',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  buttonText: {
    color: colors.white,
    fontWeight: 'bold',
    fontSize: 13,
  },
  addBelowContainer: {
    flexDirection: 'row',
    marginBottom: 15,
    marginLeft: 20,
    alignItems: 'flex-start',
    gap: 8,
  },
  addBelowInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 6,
    padding: 8,
    backgroundColor: colors.white,
    fontSize: 15,
    minHeight: 60,
  },
  addBelowButtons: {
    gap: 8,
  },
  inlineButton: {
    padding: 8,
    backgroundColor: colors.primary,
    borderRadius: 6,
    marginBottom: 4,
  },
  cancelInlineButton: {
    backgroundColor: colors.border,
  },
  inlineButtonText: {
    color: colors.white,
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default InstructionsSection;