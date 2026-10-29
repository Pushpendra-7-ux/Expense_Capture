import React from 'react';
import { Redirect } from 'expo-router';

/**
 * The product opens straight into the ledger. The reference flow has no
 * marketing/welcome screen and no role picker.
 */
export default function IndexScreen() {
  return <Redirect href="/home" />;
}
