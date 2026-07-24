/**
 * FILENAME: src/screens/CreateRecipeScreen.js
 * PURPOSE: Manual recipe creation/editing with structured inputs
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../services/supabase/config';
import { checkImageModeration, logFlaggedContent } from '../services/moderation';
import { checkFieldsAsync } from '../services/profanityFilter';
import colors from '../constants/colors';

export const CreateRecipeScreen = ({ onSave, onClose, folders, userId }) => {
  const [title, setTitle] = useState('');
  const [selectedFolder, setSelectedFolder] = useState('All Recipes');
  const [showFolderPicker, setShowFolderPicker] = useState(false);

  // Image state
  const [imageUri, setImageUri] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Save state
  const [saving, setSaving] = useState(false);

  // Structured ingredients: [{ quantity: '', text: '' }]
  const [ingredients, setIngredients] = useState([{ quantity: '', text: '' }]);

  // Instructions: ['instruction 1', 'instruction 2', ...]
  const [instructions, setInstructions] = useState(['']);
  const [selectedInstructionIndex, setSelectedInstructionIndex] = useState(0);

  // Run moderation check and set image state if it passes
  const processPickedImage = async (asset) => {
    setUploadingImage(true);
    try {
      const check = await checkImageModeration(asset.uri, asset.base64);

      if (!check.safe) {
        // Log the flagged attempt for admin review
        if (userId) {
          logFlaggedContent(supabase, {
            userId,
            contentType: 'recipe_photo_rejected',
            contentId: null,
            scores: check.scores,
            reason: check.reason,
            imageUrl: null,
          });
        }

        Alert.alert(
          'Image Not Allowed',
          `This image was flagged as inappropriate (${check.reason}). Please choose a different photo.`,
        );
        return;
      }

      setImageUri(asset.uri);
      setImageBase64(asset.base64);
    } finally {
      setUploadingImage(false);
    }
  };

  // Pick image from library
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your photo library');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      await processPickedImage(result.assets[0]);
    }
  };

  // Take photo with camera
  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your camera');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      await processPickedImage(result.assets[0]);
    }
  };

  // Show image picker options
  const showImageOptions = () => {
    Alert.alert(
      'Add Photo',
      'Choose how to add a photo',
      [
        { text: 'Take Photo', onPress: takePhoto },
        { text: 'Choose from Library', onPress: pickImage },
        imageUri ? { text: 'Remove Photo', onPress: () => { setImageUri(null); setImageBase64(null); }, style: 'destructive' } : null,
        { text: 'Cancel', style: 'cancel' },
      ].filter(Boolean)
    );
  };

  // Upload image to Supabase Storage
  const uploadImage = async (base64Data, recipeId) => {
    try {
      if (!base64Data) {
        throw new Error('No image data available');
      }

      const fileName = `${userId}/${recipeId}.jpg`;

      // Decode base64 to array buffer
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Upload to Supabase
      const { data, error } = await supabase.storage
        .from('recipe-images')
        .upload(fileName, bytes.buffer, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (error) throw error;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('recipe-images')
        .getPublicUrl(fileName);

      return urlData?.publicUrl || null;
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert('Image Upload Failed', error.message || 'Could not upload image. Recipe will be saved without photo.');
      return null;
    }
  };

  // Add ingredient
  const addIngredient = () => {
    setIngredients([...ingredients, { quantity: '', text: '' }]);
  };

  // Remove ingredient
  const removeIngredient = (index) => {
    if (ingredients.length === 1) {
      Alert.alert('Cannot Remove', 'You must have at least one ingredient');
      return;
    }
    const newIngredients = ingredients.filter((_, i) => i !== index);
    setIngredients(newIngredients);
  };

  // Update ingredient
  const updateIngredient = (index, field, value) => {
    const newIngredients = [...ingredients];
    newIngredients[index][field] = value;
    setIngredients(newIngredients);
  };

  // Add instruction below currently selected
  const addInstructionBelow = () => {
    const newInstructions = [...instructions];
    newInstructions.splice(selectedInstructionIndex + 1, 0, '');
    setInstructions(newInstructions);
    setSelectedInstructionIndex(selectedInstructionIndex + 1);
  };

  // Remove instruction
  const removeInstruction = (index) => {
    if (instructions.length === 1) {
      Alert.alert('Cannot Remove', 'You must have at least one instruction');
      return;
    }
    const newInstructions = instructions.filter((_, i) => i !== index);
    setInstructions(newInstructions);
    if (selectedInstructionIndex >= newInstructions.length) {
      setSelectedInstructionIndex(newInstructions.length - 1);
    }
  };

  // Update instruction
  const updateInstruction = (index, value) => {
    const newInstructions = [...instructions];
    newInstructions[index] = value;
    setInstructions(newInstructions);
  };

  const handleSave = async () => {
    if (saving) return; // Prevent double-save

    if (!title.trim()) {
      Alert.alert('Missing Title', 'Please enter a recipe title');
      return;
    }

    // Validate ingredients
    const validIngredients = ingredients.filter(ing => ing.text.trim().length > 0);
    if (validIngredients.length === 0) {
      Alert.alert('Missing Ingredients', 'Please add at least one ingredient');
      return;
    }

    // Format ingredients for storage
    const formattedIngredients = validIngredients.map(ing => {
      const quantity = ing.quantity.trim();
      const text = ing.text.trim();
      return quantity ? `${quantity} ${text}` : text;
    });

    // Validate instructions
    const validInstructions = instructions.filter(inst => inst.trim().length > 0);
    if (validInstructions.length === 0) {
      Alert.alert('Missing Instructions', 'Please add at least one instruction');
      return;
    }

    setSaving(true);
    try {
      // Profanity check (local wordlist + OpenAI moderation)
      const profanityCheck = await checkFieldsAsync({
        title: title.trim(),
        ingredients: formattedIngredients,
        instructions: validInstructions,
      });
      if (!profanityCheck.safe) {
        Alert.alert(
          'Inappropriate Content',
          `Please remove inappropriate language from your ${profanityCheck.field || 'recipe'}.`,
        );
        return;
      }

      const recipeId = `recipe-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Upload image if selected
      let imageUrl = null;
      if (imageBase64 && userId) {
        setUploadingImage(true);
        imageUrl = await uploadImage(imageBase64, recipeId);
        setUploadingImage(false);
      }

      const recipe = {
        id: recipeId,
        title: title.trim(),
        folder: selectedFolder,
        image_url: imageUrl,
        ingredients: {
          main: formattedIngredients,
        },
        instructions: validInstructions,
        source: 'manual',
        createdAt: Date.now(),
        isFavorite: false,
      };

      onSave(recipe);
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <StatusBar style="light" hidden={true} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} disabled={saving}>
          <Text style={[styles.closeButton, saving && { opacity: 0.4 }]}>✕ Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Recipe</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveButton}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Title */}
        <View style={styles.section}>
          <Text style={styles.label}>Recipe Title *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Grandma's Chocolate Cake"
            value={title}
            onChangeText={setTitle}
            autoFocus
          />
        </View>

        {/* Cookbook Selector */}
        <View style={styles.section}>
          <Text style={styles.label}>Cookbook</Text>
          <TouchableOpacity
            style={styles.folderSelector}
            onPress={() => setShowFolderPicker(!showFolderPicker)}
          >
            <Text style={styles.folderSelectorText}>📖 {selectedFolder}</Text>
            <Text style={styles.folderSelectorArrow}>▼</Text>
          </TouchableOpacity>

          {showFolderPicker && (
            <View style={styles.folderPicker}>
              <ScrollView style={styles.folderPickerScroll} nestedScrollEnabled={true}>
                {folders.map((folder) => (
                  <TouchableOpacity
                    key={folder}
                    style={[
                      styles.folderOption,
                      selectedFolder === folder && styles.folderOptionSelected
                    ]}
                    onPress={() => {
                      setSelectedFolder(folder);
                      setShowFolderPicker(false);
                    }}
                  >
                    <Text style={[
                      styles.folderOptionText,
                      selectedFolder === folder && styles.folderOptionTextSelected
                    ]}>
                      {folder}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        {/* Recipe Photo */}
        <View style={styles.section}>
          <Text style={styles.label}>Recipe Photo</Text>
          <TouchableOpacity
            style={styles.imagePickerContainer}
            onPress={showImageOptions}
            disabled={uploadingImage}
          >
            {uploadingImage ? (
              <View style={styles.imagePlaceholder}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.imagePlaceholderText}>Checking image...</Text>
              </View>
            ) : imageUri ? (
              <View style={styles.imagePreviewContainer}>
                <Image source={{ uri: imageUri }} style={styles.imagePreview} />
                <View style={styles.imageOverlay}>
                  <Text style={styles.imageOverlayText}>Tap to change</Text>
                </View>
              </View>
            ) : (
              <View style={styles.imagePlaceholder}>
                <Text style={styles.imagePlaceholderIcon}>📷</Text>
                <Text style={styles.imagePlaceholderText}>Add a photo</Text>
                <Text style={styles.imagePlaceholderSubtext}>Take a photo or choose from library</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Ingredients */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.label}>Ingredients *</Text>
            <TouchableOpacity onPress={addIngredient} style={styles.addButton}>
              <Text style={styles.addButtonText}>+ Add</Text>
            </TouchableOpacity>
          </View>

          {ingredients.map((ingredient, index) => (
            <View key={index} style={styles.ingredientRow}>
              <TextInput
                style={styles.quantityInput}
                placeholder="Qty"
                value={ingredient.quantity}
                onChangeText={(text) => updateIngredient(index, 'quantity', text)}
                keyboardType="default"
              />
              <TextInput
                style={styles.ingredientTextInput}
                placeholder="e.g., cups flour"
                value={ingredient.text}
                onChangeText={(text) => updateIngredient(index, 'text', text)}
              />
              {ingredients.length > 1 && (
                <TouchableOpacity
                  onPress={() => removeIngredient(index)}
                  style={styles.removeButton}
                >
                  <Text style={styles.removeButtonText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>

        {/* Instructions */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.label}>Instructions *</Text>
            <TouchableOpacity
              onPress={addInstructionBelow}
              style={styles.addButton}
            >
              <Text style={styles.addButtonText}>+ Add Below</Text>
            </TouchableOpacity>
          </View>

          {instructions.map((instruction, index) => (
            <View key={index} style={styles.instructionRow}>
              <View style={styles.instructionHeader}>
                <Text style={styles.stepNumber}>Step {index + 1}</Text>
                {instructions.length > 1 && (
                  <TouchableOpacity
                    onPress={() => removeInstruction(index)}
                    style={styles.removeInstructionButton}
                  >
                    <Text style={styles.removeButtonText}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
              <TextInput
                style={[
                  styles.instructionInput,
                  selectedInstructionIndex === index && styles.instructionInputSelected
                ]}
                placeholder={`Enter step ${index + 1}...`}
                value={instruction}
                onChangeText={(text) => updateInstruction(index, text)}
                onFocus={() => setSelectedInstructionIndex(index)}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
          ))}
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 15,
  },
  closeButton: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  saveButton: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '700',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  addButton: {
    backgroundColor: colors.primary,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: colors.text,
  },
  folderSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
  },
  folderSelectorText: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '500',
  },
  folderSelectorArrow: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  folderPicker: {
    marginTop: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    overflow: 'hidden',
  },
  folderPickerScroll: {
    maxHeight: 250,
  },
  folderOption: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
  folderOptionSelected: {
    backgroundColor: colors.primaryLight,
  },
  folderOptionText: {
    fontSize: 15,
    color: colors.text,
  },
  folderOptionTextSelected: {
    fontWeight: '600',
    color: colors.primary,
  },
  ingredientRow: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'center',
  },
  quantityInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    width: 80,
    marginRight: 8,
    color: colors.text,
  },
  ingredientTextInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: colors.text,
  },
  removeButton: {
    marginLeft: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.error,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  instructionRow: {
    marginBottom: 16,
  },
  instructionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  removeInstructionButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.error,
    justifyContent: 'center',
    alignItems: 'center',
  },
  instructionInput: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    minHeight: 80,
    textAlignVertical: 'top',
    color: colors.text,
  },
  instructionInputSelected: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  bottomSpacer: {
    height: 60,
  },
  imagePickerContainer: {
    marginTop: 8,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  imagePlaceholder: {
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.lightGray,
  },
  imagePlaceholderIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  imagePlaceholderText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  imagePlaceholderSubtext: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
  },
  imagePreviewContainer: {
    position: 'relative',
  },
  imagePreview: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: 8,
    alignItems: 'center',
  },
  imageOverlayText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default CreateRecipeScreen;
