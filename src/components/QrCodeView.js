/**
 * FILENAME: src/components/QrCodeView.js
 * PURPOSE: Render a QR code as plain Views - no native modules, no SVG.
 * Uses the pure-JS `qrcode` package to compute the module matrix.
 *
 * Fine for one-shot renders like the share card; don't mount dozens of
 * these in a scrolling list (each code is ~1000 small Views).
 */

import React, { useMemo } from 'react';
import { View } from 'react-native';
import QRCodeGen from 'qrcode';

export const QrCodeView = ({ value, size = 64, color = '#000', backgroundColor = '#fff' }) => {
  const matrix = useMemo(() => {
    try {
      const qr = QRCodeGen.create(String(value || ''), { errorCorrectionLevel: 'M' });
      const count = qr.modules.size;
      const data = qr.modules.data;
      const rows = [];
      for (let r = 0; r < count; r++) {
        const row = [];
        for (let c = 0; c < count; c++) {
          row.push(!!data[r * count + c]);
        }
        rows.push(row);
      }
      return rows;
    } catch (err) {
      console.error('❌ QR generation failed:', err);
      return null;
    }
  }, [value]);

  if (!matrix) return null;

  const cell = size / matrix.length;

  return (
    <View style={{ width: size, height: size, backgroundColor }}>
      {matrix.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row', height: cell }}>
          {row.map((on, c) => (
            <View
              key={c}
              style={{ width: cell, height: cell, backgroundColor: on ? color : backgroundColor }}
            />
          ))}
        </View>
      ))}
    </View>
  );
};

export default QrCodeView;
