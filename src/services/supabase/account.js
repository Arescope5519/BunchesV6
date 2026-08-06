/**
 * FILENAME: src/services/supabase/account.js
 * PURPOSE: Account deletion with a 30-day grace period.
 *
 * All four calls go through the delete-account Edge Function, which
 * holds the service-role key. The client is never trusted to schedule,
 * cancel or carry out a deletion itself - account_deletions has no
 * client write policies at all.
 */

import { supabase } from './config';
import { log } from '../../utils/log';

const invoke = async (action) => {
  const { data, error } = await supabase.functions.invoke('delete-account', {
    body: { action },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
};

/**
 * Is this account scheduled for deletion?
 * Read straight from the table rather than the function - it is a SELECT
 * the user is allowed to make, it runs on every launch, and it must not
 * fail closed and lock somebody out of an account they never deleted.
 * @returns {Promise<{pending: boolean, purgeAfter: Date|null}>}
 */
export const getDeletionStatus = async (userId) => {
  if (!userId) return { pending: false, purgeAfter: null };
  try {
    const { data, error } = await supabase
      .from('account_deletions')
      .select('purge_after')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return { pending: false, purgeAfter: null };

    return { pending: true, purgeAfter: new Date(data.purge_after) };
  } catch (err) {
    console.error('Failed to check deletion status:', err);
    return { pending: false, purgeAfter: null };
  }
};

/** Schedule deletion. Data is kept until purgeAfter. */
export const requestAccountDeletion = async () => {
  log('🗑️ Requesting account deletion');
  const data = await invoke('request');
  return { pending: true, purgeAfter: new Date(data.purge_after) };
};

/** Undo a pending deletion and restore the account. */
export const cancelAccountDeletion = async () => {
  log('↩️ Cancelling account deletion');
  await invoke('cancel');
  return { pending: false, purgeAfter: null };
};

/** Whole days left before the account is destroyed, floored at 0. */
export const daysUntilPurge = (purgeAfter) => {
  if (!purgeAfter) return 0;
  const ms = purgeAfter.getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
};

export default {
  getDeletionStatus,
  requestAccountDeletion,
  cancelAccountDeletion,
  daysUntilPurge,
};
