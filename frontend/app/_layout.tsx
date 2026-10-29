import React from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { theme } from '../theme';
import { DesktopSidebar } from '../components/DesktopSidebar';
import { RoleProvider } from '../components/RoleContext';

export default function RootLayout() {
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const desktop = isWeb && width >= theme.layout.desktopBreakpoint;
  const compact = width < 560;

  return (
    <RoleProvider>
      <View style={[styles.root, desktop ? styles.desktopRoot : isWeb && !compact && styles.deskRoot]}>
        {isWeb && (
        <style
          dangerouslySetInnerHTML={{
            __html: `
              html, body, #root {
                width: 100%;
                height: 100%;
                margin: 0;
                padding: 0;
                overflow: hidden;
                background-color: ${desktop ? theme.colors.bgPrimary : '#0B0E14'};
                -webkit-tap-highlight-color: transparent;
                font-family: ${theme.typography.fontFamily};
                text-rendering: optimizeLegibility;
                -webkit-font-smoothing: antialiased;
              }
              * { box-sizing: border-box; }
              input, textarea, button { font-family: inherit; }
              input:focus, textarea:focus, select:focus { outline: none; }
              ::selection { background: #F1E2C6; color: #101828; }
              ::-webkit-scrollbar { width: 6px; height: 6px; }
              ::-webkit-scrollbar-track { background: transparent; }
              ::-webkit-scrollbar-thumb { background: #D8DDE6; border-radius: 999px; }
            `,
          }}
        />
      )}

      {desktop ? (
        <View style={styles.desktopFrame}>
          <DesktopSidebar />
          <View style={styles.desktopMain}>
            <StatusBar style="dark" />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: theme.colors.bgPrimary },
                animation: 'fade',
              }}
            />
          </View>
        </View>
      ) : (
        <View
          style={[
            styles.shell,
            isWeb && !compact && styles.webShell,
            { maxWidth: isWeb && !compact ? theme.layout.maxWidth : undefined },
          ]}
        >
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: theme.colors.bgPrimary },
              animation: 'slide_from_right',
            }}
          />
        </View>
      )}
    </View>
    </RoleProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.bgPrimary,
  },
  desktopRoot: {
    backgroundColor: theme.colors.bgPrimary,
  },
  deskRoot: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0B0E14',
    // Subtle dotted "desk" behind the compact web frame.
    backgroundImage:
      'radial-gradient(rgba(255,255,255,0.075) 1px, transparent 1px)',
    backgroundSize: '18px 18px',
  } as any,
  desktopFrame: {
    flex: 1,
    flexDirection: 'row',
    width: '100%',
    height: '100%',
    backgroundColor: theme.colors.bgPrimary,
  },
  desktopMain: {
    flex: 1,
    height: '100%',
    overflow: 'hidden',
    backgroundColor: theme.colors.bgPrimary,
  },
  shell: {
    flex: 1,
    width: '100%',
    backgroundColor: theme.colors.bgPrimary,
    overflow: 'hidden',
  },
  webShell: {
    height: '100%',
    maxHeight: 980,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 30 },
    shadowOpacity: 0.45,
    shadowRadius: 70,
  },
});
