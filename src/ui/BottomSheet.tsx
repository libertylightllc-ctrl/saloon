import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { useEffect, useRef, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { screenPadding, spacing, useTheme } from '@/theme';

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
  const insets = useSafeAreaInsets();
  const ref = useRef<BottomSheetModal>(null);
  const shown = useRef(false);

  useEffect(() => {
    // Dismissing a sheet that was never presented confuses the modal's state machine.
    if (open) ref.current?.present();
    else if (shown.current) ref.current?.dismiss();
    shown.current = open;
  }, [open]);

  return (
    <BottomSheetModal
      ref={ref}
      onDismiss={onClose}
      snapPoints={snapPoints}
      enableDynamicSizing={!snapPoints}
      backdropComponent={(props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          pressBehavior="close"
        />
      )}
      backgroundStyle={{ backgroundColor: theme.colors.surface, borderRadius: theme.radius.sheet }}
      handleIndicatorStyle={{ backgroundColor: theme.colors.border, width: 40 }}
    >
      <BottomSheetScrollView
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

const styles = StyleSheet.create({
  content: { paddingHorizontal: screenPadding, paddingTop: spacing.sm, gap: spacing.lg },
});
