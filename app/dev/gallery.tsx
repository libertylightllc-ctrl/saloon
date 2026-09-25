import { Redirect } from 'expo-router';

import { GalleryScreen } from '@/features/dev/gallery/GalleryScreen';

/** Component gallery for design sign-off. Development builds only. */
export default function Gallery() {
  if (!__DEV__) return <Redirect href="/" />;
  return <GalleryScreen />;
}
