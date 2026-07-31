/**
 * FILENAME: src/services/recipePhoto.js
 * PURPOSE: Add/change a photo on an existing custom or scanned recipe.
 * Mirrors CreateRecipeScreen's photo pipeline: pick (camera/library) ->
 * moderation (Sightengine via Edge Function) -> upload to the
 * recipe-images bucket ({userId}/{recipeId}.jpg, upsert) -> public URL.
 */

import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase/config';
import { checkImageModeration, logFlaggedContent } from './moderation';

const uploadRecipeImage = async (base64Data, userId, recipeId) => {
  const fileName = `${userId}/${recipeId}.jpg`;

  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const { error } = await supabase.storage
    .from('recipe-images')
    .upload(fileName, bytes.buffer, {
      contentType: 'image/jpeg',
      upsert: true,
    });

  if (error) throw error;

  const { data: urlData } = supabase.storage
    .from('recipe-images')
    .getPublicUrl(fileName);

  // Cache-bust: the path is stable per recipe, so a changed photo would
  // otherwise show the old cached image
  const publicUrl = urlData?.publicUrl || null;
  return publicUrl ? `${publicUrl}?t=${Date.now()}` : null;
};

/**
 * Pick a photo (camera or library), moderate it, upload it, and return
 * the public URL. Returns null if cancelled, rejected, or failed
 * (user-facing alerts are shown here).
 * @param {object} opts - { userId, recipeId, fromCamera }
 * @returns {Promise<string|null>}
 */
export const pickAndUploadRecipePhoto = async ({ userId, recipeId, fromCamera = false }) => {
  try {
    if (!userId) {
      Alert.alert('Sign In Required', 'You need to be signed in to add photos.');
      return null;
    }

    const permission = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== 'granted') {
      Alert.alert('Permission Required', fromCamera
        ? 'Please allow camera access to take a photo.'
        : 'Please allow photo access to choose a photo.');
      return null;
    }

    const pickerOptions = {
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
      base64: true,
    };
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync(pickerOptions)
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          ...pickerOptions,
        });

    if (result.canceled || !result.assets?.[0]) return null;
    const asset = result.assets[0];

    // Moderation - same rules as recipe creation (no people, etc.)
    const check = await checkImageModeration(asset.uri, asset.base64);
    if (!check.safe) {
      logFlaggedContent(supabase, {
        userId,
        contentType: 'recipe_photo_rejected',
        contentId: recipeId,
        scores: check.scores,
        reason: check.reason,
        imageUrl: null,
      });
      const isPersonIssue = check.reason?.includes('people in photo');
      Alert.alert(
        isPersonIssue ? 'Photo Must Be of Food' : 'Image Not Allowed',
        isPersonIssue
          ? 'Recipe photos should show the food, not people. Please choose a photo without faces.'
          : `This image was flagged as inappropriate (${check.reason}). Please choose a different photo.`,
      );
      return null;
    }

    const url = await uploadRecipeImage(asset.base64, userId, recipeId);
    if (!url) {
      Alert.alert('Upload Failed', 'Could not upload the photo. Please try again.');
    }
    return url;
  } catch (err) {
    console.error('📷 Recipe photo error:', err);
    Alert.alert('Upload Failed', err?.message || 'Could not upload the photo. Please try again.');
    return null;
  }
};

export default { pickAndUploadRecipePhoto };
