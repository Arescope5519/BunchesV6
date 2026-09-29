/**
 * FILENAME: src/components/ReorderFolderList.js
 * PURPOSE: Drag-to-reorder list for cookbooks. Hand-rolled with
 * PanResponder so no gesture/animation native modules are needed.
 *
 * Rendered inside the Cookbook manager's ScrollView; the parent must
 * disable its own scrolling while a drag is active (onDragActive), or
 * the scroll gesture and the drag fight over the finger.
 */

import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, PanResponder } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../constants/colors';

const ROW_HEIGHT = 52;

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

export const ReorderFolderList = ({ folderNames, onReorder, onDragActive }) => {
  const [order, setOrder] = useState(folderNames);
  // Index being dragged and where it would land if dropped now
  const [dragFrom, setDragFrom] = useState(null);
  const [dragTo, setDragTo] = useState(null);
  const dragY = useRef(new Animated.Value(0)).current;

  // Refs mirror state for use inside PanResponder callbacks, which
  // capture the values from the render they were created in
  const orderRef = useRef(order);
  orderRef.current = order;
  const dragFromRef = useRef(null);
  const dragToRef = useRef(null);

  // Adopt external changes (rename/delete elsewhere) when not dragging
  useEffect(() => {
    if (dragFromRef.current === null) setOrder(folderNames);
  }, [folderNames.join('\u0000')]);

  const endDrag = (commit) => {
    const from = dragFromRef.current;
    const to = dragToRef.current;
    if (commit && from !== null && to !== null && from !== to) {
      const next = [...orderRef.current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      setOrder(next);
      onReorder?.(next);
    }
    dragFromRef.current = null;
    dragToRef.current = null;
    setDragFrom(null);
    setDragTo(null);
    dragY.setValue(0);
    onDragActive?.(false);
  };

  const makeResponder = (index) =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        dragFromRef.current = index;
        dragToRef.current = index;
        setDragFrom(index);
        setDragTo(index);
        dragY.setValue(0);
        onDragActive?.(true);
      },
      onPanResponderMove: (_evt, gesture) => {
        dragY.setValue(gesture.dy);
        const from = dragFromRef.current;
        if (from === null) return;
        const target = clamp(
          from + Math.round(gesture.dy / ROW_HEIGHT),
          0,
          orderRef.current.length - 1
        );
        if (target !== dragToRef.current) {
          dragToRef.current = target;
          setDragTo(target);
        }
      },
      onPanResponderRelease: () => endDrag(true),
      onPanResponderTerminate: () => endDrag(false),
    });

  return (
    <View>
      {order.map((name, index) => {
        const isDragged = dragFrom === index;

        // Rows between the pickup point and the drop target slide one
        // slot to make room; everything else stays put
        let shift = 0;
        if (dragFrom !== null && dragTo !== null && !isDragged) {
          if (dragFrom < dragTo && index > dragFrom && index <= dragTo) shift = -ROW_HEIGHT;
          if (dragFrom > dragTo && index >= dragTo && index < dragFrom) shift = ROW_HEIGHT;
        }

        return (
          <Animated.View
            key={name}
            {...makeResponder(index).panHandlers}
            style={[
              styles.row,
              { transform: [{ translateY: isDragged ? dragY : shift }] },
              isDragged && styles.rowDragged,
            ]}
          >
            <Ionicons name="reorder-three" size={22} color={colors.textSecondary} style={styles.handle} />
            <Text style={styles.rowText} numberOfLines={1}>{name}</Text>
          </Animated.View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    height: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 14,
    marginBottom: 0,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  rowDragged: {
    zIndex: 10,
    elevation: 4,
    borderColor: colors.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  handle: {
    marginRight: 12,
  },
  rowText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
  },
});

export default ReorderFolderList;
