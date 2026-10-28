import React from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { theme } from '../theme';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      {Platform.OS === 'web' && (
        <style
          dangerouslySetInnerHTML={{
            __html: `
              html, body, #root {
                width: 100%;
                min-height: 100%;
                margin: 0;
                padding: 0;
                overflow-x: hidden;
                background-color: #F5F5F7;
                -webkit-tap-highlight-color: transparent;
                font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              }
              * {
                box-sizing: border-box;
              }
              ::-webkit-scrollbar {
                width: 6px;
                height: 6px;
              }
              ::-webkit-scrollbar-track {
                background: #F5F5F7;
              }
              ::-webkit-scrollbar-thumb {
                background: #E8E8EC;
                border-radius: 3px;
              }
            `,
          }}
        />
      )}
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.bgPrimary },
          animation: 'slide_from_right',
        }}
      />
    </>
  );
}
