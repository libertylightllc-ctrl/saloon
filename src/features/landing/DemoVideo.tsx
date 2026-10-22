/**
 * A 60–90 second walkthrough (website brief 2.9), only when the owner has set `site.demoVideoUrl` (YouTube, Vimeo or
 * an MP4). A poster first: no player is loaded until the visitor taps play. Hidden while the link is empty.
 */
import { createElement, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Linking, Platform, Pressable, StyleSheet, View } from 'react-native';

import { site } from '@/config/site';
import { brandPalette as B, spacing } from '@/theme';
import { Icon, Text } from '@/ui';

import { Band, NavyBackdrop, useLandingLayout } from './parts';

type Video = { kind: 'youtube' | 'vimeo' | 'file'; id: string };

/** What the link is: a YouTube or Vimeo id, or a video file. */
export function videoOf(url: string): Video | null {
  if (!url) return null;
  const yt = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{6,})/.exec(url);
  if (yt) return { kind: 'youtube', id: yt[1]! };
  const vimeo = /vimeo\.com\/(?:video\/)?(\d+)/.exec(url);
  if (vimeo) return { kind: 'vimeo', id: vimeo[1]! };
  return { kind: 'file', id: url };
}

const VIDEO = videoOf(site.demoVideoUrl);

export function DemoVideo({ onLayoutY }: { onLayoutY?: (y: number) => void }) {
  const { t } = useTranslation();
  const { compact } = useLandingLayout();
  const [playing, setPlaying] = useState(false);
  if (!VIDEO) return null;
  const play = () => (Platform.OS === 'web' ? setPlaying(true) : void Linking.openURL(site.demoVideoUrl));
  const frame = { width: '100%', height: '100%', border: 0, borderRadius: 20 };
  const player =
    VIDEO.kind === 'file'
      ? createElement('video', { src: VIDEO.id, controls: true, autoPlay: true, playsInline: true, style: frame })
      : createElement('iframe', {
          src: VIDEO.kind === 'youtube' ? `https://www.youtube-nocookie.com/embed/${VIDEO.id}?autoplay=1&rel=0` : `https://player.vimeo.com/video/${VIDEO.id}?autoplay=1`,
          title: t('auth.landing.video.title'),
          allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen',
          allowFullScreen: true,
          style: frame,
        });
  return (
    <View style={styles.ground} onLayout={(e) => onLayoutY?.(e.nativeEvent.layout.y)} testID="landing-video">
      <NavyBackdrop glowAt={['50%', '50%']} />
      <Band ground="transparent" style={[styles.band, compact && styles.bandCompact]}>
        <Text variant={compact ? 'sectionCompact' : 'section'} align="center" style={styles.white} accessibilityRole="header">
          {t('auth.landing.video.title')}
        </Text>
        <View style={styles.box}>
          {playing ? (
            player
          ) : (
            <Pressable onPress={play} accessibilityRole="button" accessibilityLabel={t('auth.landing.video.play')} style={styles.poster} testID="landing-video-play">
              {VIDEO.kind === 'youtube' ? (
                <Image source={{ uri: `https://i.ytimg.com/vi/${VIDEO.id}/hqdefault.jpg` }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              ) : null}
              <View style={styles.playButton}>
                <Icon name="play" size={30} color={B.navy} />
              </View>
            </Pressable>
          )}
        </View>
      </Band>
    </View>
  );
}

const styles = StyleSheet.create({
  ground: { backgroundColor: B.navy, overflow: 'hidden' },
  band: { paddingVertical: 72, gap: spacing['2xl'], alignItems: 'center' },
  bandCompact: { paddingVertical: 40 },
  white: { color: B.onNavy },
  box: { width: '100%', maxWidth: 880, aspectRatio: 16 / 9, borderRadius: 20, overflow: 'hidden', backgroundColor: B.navyRaised },
  poster: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  playButton: { width: 76, height: 76, borderRadius: 38, backgroundColor: B.teal, alignItems: 'center', justifyContent: 'center' },
});
