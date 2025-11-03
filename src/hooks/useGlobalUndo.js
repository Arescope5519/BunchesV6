/**
 * useGlobalUndo Hook
 * Global undo system that works across all pages and actions
 */

import { useState, useCallback } from 'react';

export const useGlobalUndo = () => {
  const [undoStack, setUndoStack] = useState([]);
  const [showUndoButton, setShowUndoButton] = useState(false);
  const [undoTimer, setUndoTimer] = useState(null);

  /**
   * Add an action to the undo stack
   * @param {Object} action - { type, undo, description }
   */
  const addUndoAction = useCallback((action) => {
    // Clear existing timer
    if (undoTimer) {
      clearTimeout(undoTimer);
    }

    // Add to stack
    setUndoStack(prev => [...prev, { ...action, timestamp: Date.now() }]);
    setShowUndoButton(true);

    // Auto-hide after 10 seconds
    const timer = setTimeout(() => {
      setShowUndoButton(false);
    }, 10000);
    setUndoTimer(timer);
  }, [undoTimer]);

  /**
   * Undo the last action
   */
  const performUndo = useCallback(async () => {
    if (undoStack.length === 0) return;

    // Get the last action
    const lastAction = undoStack[undoStack.length - 1];

    // Execute the undo function
    if (lastAction.undo) {
      await lastAction.undo();
    }

    // Remove from stack
    setUndoStack(prev => prev.slice(0, -1));

    // Hide button if no more actions
    if (undoStack.length <= 1) {
      setShowUndoButton(false);
      if (undoTimer) {
        clearTimeout(undoTimer);
      }
    }
  }, [undoStack, undoTimer]);

  /**
   * Clear all undo history
   */
  const clearUndoStack = useCallback(() => {
    setUndoStack([]);
    setShowUndoButton(false);
    if (undoTimer) {
      clearTimeout(undoTimer);
    }
  }, [undoTimer]);

  /**
   * Get the description of the last action
   */
  const getLastActionDescription = useCallback(() => {
    if (undoStack.length === 0) return '';
    return undoStack[undoStack.length - 1].description || 'Last Change';
  }, [undoStack]);

  return {
    addUndoAction,
    performUndo,
    clearUndoStack,
    showUndoButton,
    canUndo: undoStack.length > 0,
    undoCount: undoStack.length,
    lastActionDescription: getLastActionDescription(),
  };
};
