// This tab was replaced by the Discover tab.
// Kept as a placeholder to avoid Expo Router 404 during transition.
import { Redirect } from 'expo-router';

export default function ExploreRedirect() {
  return <Redirect href={"/(tabs)/discover" as any} />;
}
