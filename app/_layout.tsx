import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { initDb } from '../src/db/connection';
import { useAuthStore } from '../src/stores/authStore';
import { Colors } from '../src/theme/colors';

export default function RootLayout() {
  const [dbReady, setDbReady] = useState(false);
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    initDb()
      .then(() => setDbReady(true))
      .catch((e) => {
        console.error('Error iniciando DB:', e);
        setDbReady(true);
      });
  }, []);

  useEffect(() => {
    if (!dbReady) return;
    const inAuth = segments[0] === '(auth)';
    if (!isAuthenticated && !inAuth) {
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuth) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, dbReady, segments]);

  if (!dbReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" backgroundColor={Colors.background} />
      <Slot />
    </>
  );
}