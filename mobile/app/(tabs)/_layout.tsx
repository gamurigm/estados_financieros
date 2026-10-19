import { Tabs } from 'expo-router';

export default function FinanceTabs() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: '#173c32',
      tabBarInactiveTintColor: '#78837b',
      tabBarLabelStyle: { fontSize: 12, fontWeight: '700' },
      tabBarStyle: { backgroundColor: '#ffffff', borderTopColor: '#e3e9e2', height: 62, paddingTop: 7, paddingBottom: 8 },
    }}>
      <Tabs.Screen name="index" options={{ title: 'Libro' }} />
    </Tabs>
  );
}
