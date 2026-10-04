import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { useEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { screenPadding, spacing, useTheme } from '@/theme';

import { useWide } from './layoutSize';
import { Text } from './Text';

export interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** e.g. ['90%'] for the full-height checkout. Default: fit the content. */
  snapPoints?: (string | number)[];
}

/** Radius-28 top corners and a grab handle. Needs <BottomSheetModalProvider> at the root. */
export function BottomSheet({ open, onClose, title, children, snapPoints }: BottomSheetProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const wide = useWide();
  const { width } = useWindowDimensions();
  const ref = useRef<BottomSheetModal>(null);
  /** Whether the modal is on screen right now (not what the parent asked for). */
  const visible = useRef(false);

  useEffect(() => {
    // Dismissing a sheet that is not on screen — never presented, or already closed by a tap on the backdrop or a
    // swipe — jams the modal: it marks the sheet as leaving, and every later present() closes it again at once, so
    // its button seems dead until the page reloads. So only dismiss a sheet that is still visible.
    if (open && !visible.current) {
      visible.current = true;
      ref.current?.present();
    } else if (!open && visible.current) {
      visible.current = false;
      ref.current?.dismiss();
    }
  }, [open]);

  return (
    <BottomSheetModal
      ref={ref}
      onDismiss={() => {
        // Closed by the person (backdrop, swipe) or by us: either way it is off screen now.
        visible.current = false;
        onClose();
      }}
      snapPoints={snapPoints}
      enableDynamicSizing={!snapPoints}
      // Tablets and computers: a centred panel of a readable width, not a strip across the whole screen.
      style={wide ? { marginHorizontal: Math.max(spacing['2xl'], (width - SHEET_MAX_WIDTH) / 2) } : undefined}
      backdropComponent={(props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          pressBehavior="close"
          accessibilityLabel={t('common.close')}
        />
      )}
      backgroundStyle={{ backgroundColor: theme.colors.surface, borderRadius: theme.radius.sheet }}
      handleIndicatorStyle={{ backgroundColor: theme.colors.border, width: 40 }}
    >
      {/* A modal dialog: screen readers (and VoiceOver via aria-modal) stay inside while it is open. */}
      <BottomSheetScrollView
        role="dialog"
        aria-modal
        aria-label={title}
        contentContainerStyle={[styles.content, { paddingBottom: spacing['2xl'] + insets.bottom }]}
      >
        {title ? (
          <Text variant="h3" accessibilityRole="header">
            {title}
          </Text>
        ) : null}
        {children}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

const SHEET_MAX_WIDTH = 640;

const styles = StyleSheet.create({
  content: { paddingHorizontal: screenPadding, paddingTop: spacing.sm, gap: spacing.lg },
});
