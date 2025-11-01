/**
 * FILENAME: src/components/RecipeDetail/RecipeHeader.js
 * PURPOSE: Display and edit recipe title and notes
 * USED BY: src/components/RecipeDetail.js
 */

import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import colors from '../../constants/colors';

const RecipeHeader = ({ recipe, onUpdate }) => {
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [tempTitle, setTempTitle] = useState(recipe.title);
  const [tempNotes, setTempNotes] = useState(recipe.notes || '');

  const saveTitle = () => {
    if (tempTitle.trim()) {
      onUpdate({
        ...recipe,
        title: tempTitle.trim()
      });
      setEditingTitle(false);
    }
  };

  const saveNotes = () => {
    onUpdate({
      ...recipe,
      notes: tempNotes
    });
    setEditingNotes(false);
  };

  return (
    <View style={styles.container}>
      {/* Recipe Title */}
      {editingTitle ? (
        <View style={styles.editContainer}>
          <TextInput
            style={styles.titleInput}
            value={tempTitle}
            onChangeText={setTempTitle}
            autoFocus
            onSubmitEditing={saveTitle}
            onBlur={saveTitle}
          />
        </View>
      ) : (
        <TouchableOpacity
          onLongPress={() => {
            setTempTitle(recipe.title);
            setEditingTitle(true);
          }}
          delayLongPress={300}
        >
          <Text style={styles.recipeTitle}>{recipe.title}</Text>
        </TouchableOpacity>
      )}

      {/* Recipe Notes */}
      {editingNotes ? (
        <View style={styles.editContainer}>
          <TextInput
            style={styles.notesInput}
            value={tempNotes}
            onChangeText={setTempNotes}
            multiline
            autoFocus
            placeholder="Add notes..."
            onBlur={saveNotes}
          />
          <TouchableOpacity style={styles.saveButton} onPress={saveNotes}>
            <Text style={styles.saveButtonText}>Save</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          onLongPress={() => {
            setTempNotes(recipe.notes || '');
            setEditingNotes(true);
          }}
          delayLongPress={300}
        >
          <Text style={styles.notes}>
            {recipe.notes || 'Long press to add notes...'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  recipeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    color: colors.text,
  },
  titleInput: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    color: colors.text,
    borderWidth: 2,
    borderColor: colors.primary,
    padding: 8,
    borderRadius: 6,
    backgroundColor: colors.background,
  },
  notes: {
    fontSize: 14,
    color: colors.textSecondary,
    fontStyle: 'italic',
    padding: 8,
    backgroundColor: colors.background,
    borderRadius: 6,
    minHeight: 40,
  },
  notesInput: {
    fontSize: 14,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.primary,
    padding: 8,
    borderRadius: 6,
    backgroundColor: colors.background,
    minHeight: 60,
  },
  editContainer: {
    marginBottom: 10,
  },
  saveButton: {
    backgroundColor: colors.success,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  saveButtonText: {
    color: colors.white,
    fontWeight: 'bold',
    fontSize: 14,
  },
});

export default RecipeHeader;
