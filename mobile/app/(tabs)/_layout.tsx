import { Tabs } from 'expo-router';

export default function FinanceTabs() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarStyle: { display: 'none' },
    }}>
      <Tabs.Screen name="index" options={{ title: 'Libro' }} />
    </Tabs>
  );
}
