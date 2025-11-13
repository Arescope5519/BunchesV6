/**
 * App.js - Main Application Entry Point
 * BunchesV6 - Recipe Manager (Local Mode Only)
 */

import React from 'react';
import HomeScreen from './src/screens/HomeScreen';

export default function App() {
  // Always run in local mode (no Firebase authentication)
  return <HomeScreen user={null} />;
}