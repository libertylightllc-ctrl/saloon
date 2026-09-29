import { Stack } from 'expo-router';

/** Platform owner only; the screen itself checks and sends anyone else Home. */
export default function AdminLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
