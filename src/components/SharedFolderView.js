/**
 * FILENAME: src/components/SharedFolderView.js
 * PURPOSE: One shared cookbook - its recipes, members, and actions.
 *
 * Full-screen modal opened from the Cookbooks page. Every member adds
 * recipes and removes their own additions; the owner also invites and
 * removes members, removes any recipe, and deletes the folder. Content
 * is the GLOBAL layer of each recipe (see sharedFolders.js), shown
 * read-only - saving a copy goes through the normal import flow.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../constants/colors';
import { imgSource } from '../utils/imageSource';
import {
  getSharedFolderDetail,
  inviteToSharedFolder,
  removeSharedFolderMember,
  addRecipeToSharedFolder,
  removeRecipeFromSharedFolder,
  deleteSharedFolder,
} from '../services/supabase/sharedFolders';

const SharedFolderView = ({
  visible,
  folder,          // {id, name, isOwner, ownerId}
  userId,
  friends,         // [{id, username}] - invite candidates
  recipes,         // my own recipes - the add picker's source
  onClose,
  onOpenRecipe,    // (recipe) -> show read-only RecipeDetail
  onSaveCopy,      // (recipe) -> run the import flow
  onChanged,       // refresh the cookbook page counts
}) => {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [busyIds, setBusyIds] = useState({});

  const load = async () => {
    if (!folder?.id) return;
    setLoading(true);
    const d = await getSharedFolderDetail(folder.id);
    setDetail(d);
    setLoading(false);
  };

  useEffect(() => {
    if (visible && folder?.id) {
      setDetail(null);
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, folder?.id]);

  const folderRecipes = detail?.recipes || [];
  const members = detail?.members || [];
  const inFolderIds = useMemo(
    () => new Set(folderRecipes.map(r => r.globalRecipeId)),
    [folderRecipes]
  );

  // My recipes that CAN go in: not deleted, has a global counterpart,
  // not already in the folder
  const addable = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    return (recipes || [])
      .filter(r => !r.deletedAt && r.globalRecipeId && !inFolderIds.has(r.globalRecipeId))
      .filter(r => !q || (r.title || '').toLowerCase().includes(q));
  }, [recipes, inFolderIds, pickerSearch]);

  const handleAdd = async (recipe) => {
    setBusyIds(b => ({ ...b, [recipe.globalRecipeId]: true }));
    const res = await addRecipeToSharedFolder(folder.id, recipe.globalRecipeId, userId);
    setBusyIds(b => ({ ...b, [recipe.globalRecipeId]: false }));
    if (res.success) {
      await load();
      onChanged?.();
    } else {
      Alert.alert('Error', 'Could not add the recipe. Please try again.');
    }
  };

  const handleRecipeLongPress = (recipe) => {
    const canRemove = folder?.isOwner || recipe.addedBy === userId;
    const buttons = [
      { text: 'Save to My Cookbook', onPress: () => onSaveCopy?.(recipe) },
    ];
    if (canRemove) {
      buttons.push({
        text: 'Remove from This Cookbook',
        style: 'destructive',
        onPress: async () => {
          const ok = await removeRecipeFromSharedFolder(folder.id, recipe.globalRecipeId);
          if (ok) {
            await load();
            onChanged?.();
          } else {
            Alert.alert('Error', 'Could not remove the recipe.');
          }
        },
      });
    }
    buttons.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert(recipe.title || 'Recipe', undefined, buttons);
  };

  const handleInvite = async (friend) => {
    setBusyIds(b => ({ ...b, [friend.id]: true }));
    const res = await inviteToSharedFolder(folder.id, userId, friend.id);
    setBusyIds(b => ({ ...b, [friend.id]: false }));
    if (res.success) {
      await load();
    } else if (res.duplicate) {
      Alert.alert('Already Invited', `@${friend.username} already has an invite or is a member.`);
    } else {
      Alert.alert('Error', 'Could not send the invite.');
    }
  };

  const handleRemoveMember = (member) => {
    Alert.alert(
      'Remove Member?',
      `@${member.username || 'this member'} will lose access to this cookbook. Recipes they added stay.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const ok = await removeSharedFolderMember(folder.id, member.userId);
            if (ok) { await load(); onChanged?.(); }
            else Alert.alert('Error', 'Could not remove the member.');
          },
        },
      ]
    );
  };

  const handleLeave = () => {
    Alert.alert(
      'Leave This Cookbook?',
      'You will lose access. Recipes you added stay in the cookbook.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            const ok = await removeSharedFolderMember(folder.id, userId);
            if (ok) { setShowMembers(false); onClose?.(); onChanged?.(); }
            else Alert.alert('Error', 'Could not leave the cookbook.');
          },
        },
      ]
    );
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete This Shared Cookbook?',
      'It disappears for every member. Nobody\'s own saved recipes are affected. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const ok = await deleteSharedFolder(folder.id);
            if (ok) { setShowMembers(false); onClose?.(); onChanged?.(); }
            else Alert.alert('Error', 'Could not delete the cookbook.');
          },
        },
      ]
    );
  };

  if (!folder) return null;

  const activeMembers = members.filter(m => m.status === 'active');
  const invitedMembers = members.filter(m => m.status === 'invited');
  const memberIds = new Set(members.map(m => m.userId));
  const invitableFriends = (friends || []).filter(f => !memberIds.has(f.id));

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerSide}>
            <Ionicons name="close" size={18} color={colors.onPrimary} style={{ marginRight: 4 }} />
            <Text style={styles.headerAction}>Close</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle} numberOfLines={1}>{folder.name}</Text>
            <Text style={styles.headerSub}>
              Shared · {activeMembers.length || folder.memberCount || 1} member{(activeMembers.length || folder.memberCount || 1) !== 1 ? 's' : ''}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setShowMembers(true)} style={[styles.headerSide, { justifyContent: 'flex-end' }]}>
            <Ionicons name="people" size={22} color={colors.onPrimary} />
          </TouchableOpacity>
        </View>

        {/* Recipes */}
        {loading && !detail ? (
          <View style={styles.centerFill}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            {folderRecipes.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Ionicons name="book-outline" size={44} color={colors.textLight} />
                <Text style={styles.emptyText}>
                  No recipes yet. Anyone in this cookbook can add from their own collection.
                </Text>
              </View>
            ) : (
              <View style={styles.grid}>
                {folderRecipes.map(r => (
                  <TouchableOpacity
                    key={r.globalRecipeId}
                    style={styles.tile}
                    onPress={() => onOpenRecipe?.(r)}
                    onLongPress={() => handleRecipeLongPress(r)}
                    delayLongPress={400}
                  >
                    {r.imageUrl ? (
                      <Image source={imgSource(r.imageUrl)} style={styles.tileImage} />
                    ) : (
                      <View style={[styles.tileImage, styles.tilePlaceholder]}>
                        <Ionicons name="restaurant" size={26} color={colors.primary} />
                      </View>
                    )}
                    <Text style={styles.tileTitle} numberOfLines={2}>{r.title}</Text>
                    {r.addedByUsername ? (
                      <Text style={styles.tileBy} numberOfLines={1}>
                        {r.addedBy === userId ? 'added by you' : `@${r.addedByUsername}`}
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <Text style={styles.holdHint}>
              Tap a recipe to view it. Hold one to save a copy{folder.isOwner ? ' or remove it' : ' or remove your own additions'}.
            </Text>
          </ScrollView>
        )}

        {/* Add recipes */}
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => { setPickerSearch(''); setShowPicker(true); }}
        >
          <Ionicons name="add" size={20} color={colors.onPrimary} />
          <Text style={styles.addButtonText}>Add Recipes</Text>
        </TouchableOpacity>

        {/* Recipe picker */}
        <Modal visible={showPicker} animationType="slide" onRequestClose={() => setShowPicker(false)}>
          <View style={styles.container}>
            <View style={styles.header}>
              <TouchableOpacity onPress={() => setShowPicker(false)} style={styles.headerSide}>
                <Ionicons name="close" size={18} color={colors.onPrimary} style={{ marginRight: 4 }} />
                <Text style={styles.headerAction}>Done</Text>
              </TouchableOpacity>
              <View style={styles.headerCenter}>
                <Text style={styles.headerTitle}>Add Recipes</Text>
              </View>
              <View style={styles.headerSide} />
            </View>
            <View style={styles.pickerNote}>
              <Ionicons name="eye-outline" size={15} color={colors.accentDark} style={{ marginRight: 6 }} />
              <Text style={styles.pickerNoteText}>
                Members can see any recipe you add - even from a private cookbook. Your personal notes and edits stay private.
              </Text>
            </View>
            <TextInput
              style={styles.searchInput}
              value={pickerSearch}
              onChangeText={setPickerSearch}
              placeholder="Search your recipes"
              placeholderTextColor={colors.textLight}
            />
            <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
              {addable.length === 0 ? (
                <Text style={styles.emptyText}>
                  {pickerSearch ? 'No matches.' : 'Nothing left to add - every eligible recipe is already in this cookbook.'}
                </Text>
              ) : (
                addable.map(r => (
                  <View key={r.id} style={styles.pickerRow}>
                    {r.image_url ? (
                      <Image source={imgSource(r.image_url)} style={styles.pickerThumb} />
                    ) : (
                      <View style={[styles.pickerThumb, styles.tilePlaceholder]}>
                        <Ionicons name="restaurant" size={16} color={colors.primary} />
                      </View>
                    )}
                    <Text style={styles.pickerTitle} numberOfLines={2}>{r.title}</Text>
                    <TouchableOpacity
                      style={styles.pickerAddBtn}
                      disabled={!!busyIds[r.globalRecipeId]}
                      onPress={() => handleAdd(r)}
                    >
                      {busyIds[r.globalRecipeId] ? (
                        <ActivityIndicator size="small" color={colors.onPrimary} />
                      ) : (
                        <Text style={styles.pickerAddText}>Add</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </Modal>

        {/* Members */}
        <Modal visible={showMembers} animationType="slide" onRequestClose={() => setShowMembers(false)}>
          <View style={styles.container}>
            <View style={styles.header}>
              <TouchableOpacity onPress={() => setShowMembers(false)} style={styles.headerSide}>
                <Ionicons name="close" size={18} color={colors.onPrimary} style={{ marginRight: 4 }} />
                <Text style={styles.headerAction}>Done</Text>
              </TouchableOpacity>
              <View style={styles.headerCenter}>
                <Text style={styles.headerTitle}>Members</Text>
              </View>
              <View style={styles.headerSide} />
            </View>
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
              {[...activeMembers, ...invitedMembers].map(m => (
                <View key={m.userId} style={styles.memberRow}>
                  <Ionicons
                    name={m.role === 'owner' ? 'key' : 'person'}
                    size={18}
                    color={colors.primary}
                    style={{ marginRight: 10 }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.memberName}>
                      @{m.username || 'unknown'}{m.userId === userId ? ' (you)' : ''}
                    </Text>
                    <Text style={styles.memberRole}>
                      {m.role === 'owner' ? 'Owner' : m.status === 'invited' ? 'Invited - not accepted yet' : 'Member'}
                    </Text>
                  </View>
                  {folder.isOwner && m.userId !== userId && (
                    <TouchableOpacity onPress={() => handleRemoveMember(m)}>
                      <Ionicons name="remove-circle-outline" size={22} color={colors.error} />
                    </TouchableOpacity>
                  )}
                </View>
              ))}

              {folder.isOwner && (
                <>
                  <Text style={styles.inviteTitle}>Invite Friends</Text>
                  {invitableFriends.length === 0 ? (
                    <Text style={styles.emptyText}>
                      {(friends || []).length === 0
                        ? 'Add friends first - shared cookbooks are invite-by-friendship.'
                        : 'All of your friends are already in this cookbook.'}
                    </Text>
                  ) : (
                    invitableFriends.map(f => (
                      <View key={f.id} style={styles.memberRow}>
                        <Ionicons name="person-add-outline" size={18} color={colors.textSecondary} style={{ marginRight: 10 }} />
                        <Text style={[styles.memberName, { flex: 1 }]}>@{f.username}</Text>
                        <TouchableOpacity
                          style={styles.inviteBtn}
                          disabled={!!busyIds[f.id]}
                          onPress={() => handleInvite(f)}
                        >
                          {busyIds[f.id] ? (
                            <ActivityIndicator size="small" color={colors.onPrimary} />
                          ) : (
                            <Text style={styles.inviteBtnText}>Invite</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    ))
                  )}
                </>
              )}

              {folder.isOwner ? (
                <TouchableOpacity style={styles.dangerBtn} onPress={handleDelete}>
                  <Ionicons name="trash-outline" size={16} color={colors.error} style={{ marginRight: 6 }} />
                  <Text style={styles.dangerBtnText}>Delete Shared Cookbook</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.dangerBtn} onPress={handleLeave}>
                  <Ionicons name="exit-outline" size={16} color={colors.error} style={{ marginRight: 6 }} />
                  <Text style={styles.dangerBtnText}>Leave This Cookbook</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </Modal>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingTop: 48,
    paddingBottom: 12,
    paddingHorizontal: 14,
  },
  headerSide: { flexDirection: 'row', alignItems: 'center', width: 76 },
  headerAction: { color: colors.onPrimary, fontSize: 15, fontWeight: '600' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { color: colors.onPrimary, fontSize: 17, fontWeight: '700' },
  headerSub: { color: colors.onPrimary, fontSize: 11, opacity: 0.85, marginTop: 1 },
  centerFill: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 12, paddingBottom: 90 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  tile: { width: '33.33%', padding: 4, marginBottom: 6 },
  tileImage: { width: '100%', aspectRatio: 1, borderRadius: 10, backgroundColor: colors.lightGray },
  tilePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  tileTitle: { fontSize: 12, fontWeight: '600', color: colors.text, marginTop: 4, lineHeight: 16 },
  tileBy: { fontSize: 10, color: colors.textTertiary, marginTop: 1 },
  emptyWrap: { alignItems: 'center', paddingVertical: 50, paddingHorizontal: 30 },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    padding: 16,
  },
  holdHint: {
    fontSize: 11,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: 14,
    paddingHorizontal: 20,
  },
  addButton: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: colors.shadow,
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  addButtonText: { color: colors.onPrimary, fontSize: 15, fontWeight: '700', marginLeft: 6 },
  pickerNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.warningLight,
    borderRadius: 10,
    padding: 10,
    margin: 12,
    marginBottom: 4,
  },
  pickerNoteText: { flex: 1, fontSize: 12, color: colors.accentDark, lineHeight: 17 },
  searchInput: {
    margin: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  pickerThumb: { width: 44, height: 44, borderRadius: 8, backgroundColor: colors.lightGray },
  pickerTitle: { flex: 1, fontSize: 14, color: colors.text, marginHorizontal: 10 },
  pickerAddBtn: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
    minWidth: 54,
    alignItems: 'center',
  },
  pickerAddText: { color: colors.onPrimary, fontSize: 13, fontWeight: '700' },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  memberName: { fontSize: 15, fontWeight: '600', color: colors.text },
  memberRole: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  inviteTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 22,
    marginBottom: 6,
  },
  inviteBtn: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
    minWidth: 62,
    alignItems: 'center',
  },
  inviteBtnText: { color: colors.onPrimary, fontSize: 13, fontWeight: '700' },
  dangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 28,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.error,
  },
  dangerBtnText: { color: colors.error, fontSize: 14, fontWeight: '600' },
});

export default SharedFolderView;
