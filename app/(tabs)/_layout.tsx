import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { Colors } from '../../src/theme/colors';

function TabIcon({ emoji }: { emoji: string }) {
  return <Text style={{ fontSize: 22 }}>{emoji}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
          height: 64,
          paddingBottom: 8,
          paddingTop: 4,
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        headerStyle: { backgroundColor: Colors.background },
        headerTintColor: Colors.textPrimary,
        headerTitleStyle: { fontWeight: '700', fontSize: 18 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Inicio', tabBarIcon: () => <TabIcon emoji="🏠" /> }} />
      <Tabs.Screen name="planner" options={{ title: 'Planner', tabBarIcon: () => <TabIcon emoji="📅" /> }} />
      <Tabs.Screen name="routines" options={{ title: 'Rutinas', tabBarIcon: () => <TabIcon emoji="💪" /> }} />
      <Tabs.Screen name="nutrition" options={{ title: 'Nutricion', tabBarIcon: () => <TabIcon emoji="🥗" /> }} />
      <Tabs.Screen name="progress" options={{ title: 'Progreso', tabBarIcon: () => <TabIcon emoji="📈" /> }} />
      <Tabs.Screen name="coach" options={{ title: 'AI Coach', tabBarIcon: () => <TabIcon emoji="🤖" /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Perfil', tabBarIcon: () => <TabIcon emoji="👤" /> }} />
    </Tabs>
  );
}