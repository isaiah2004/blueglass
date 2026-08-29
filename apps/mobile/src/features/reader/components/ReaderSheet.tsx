/**
 * The sheet every reader control opens into.
 *
 * Purpose
 *   `design-language.md` §4: a sheet covers the bottom half of the screen, carries a grab
 *   handle, and leaves the scripture above it partly visible — "that visible scripture is
 *   the whole point of the interaction". This component is that shape, once, so the
 *   translation switcher, the display settings and the navigator cannot drift apart.
 *
 * On glass
 *   Decision `D-05` — "no excessive glass stuff" — so this is a solid elevated surface
 *   with a hairline and a rounded top, not a backdrop blur. The scrim behind it dims the
 *   canvas enough to signal modality without hiding it. `flutter-port-map.md` §7.6 records
 *   the other reason to stay off the blur: animating geometry over a blurred surface
 *   re-blurs every frame and stutters, which is why the prototype's own sheets used a
 *   plain fade.
 *
 * Dependencies
 *   React Native's `Modal`, the reader's theme hook, and the radius, spacing and size
 *   tokens. No navigation.
 */

import type { JSX, ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { borderWidth, radius, size, spacing, uiText } from '@/theme';
import { useTheme } from '@/theme/runtime';

/** What a sheet needs. */
export interface ReaderSheetProps {
  readonly visible: boolean;
  readonly title: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
  readonly testID?: string;
}

/** Share of the screen height a sheet may grow to (§4: "the bottom half"). */
const SHEET_MAX_HEIGHT = '70%';

/**
 * Render a bottom sheet.
 *
 * @param props - See {@link ReaderSheetProps}.
 * @returns The modal, or nothing when it is closed.
 *
 * Side effects: none beyond `onClose`.
 */
export function ReaderSheet({
  visible,
  title,
  onClose,
  children,
  testID,
}: ReaderSheetProps): JSX.Element {
  const theme = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Close ${title}`}
        style={[styles.scrim, { backgroundColor: theme.overlay.scrim }]}
        onPress={onClose}
      />
      <View
        testID={testID}
        style={[
          styles.sheet,
          { backgroundColor: theme.background.elevated, borderColor: theme.line.hairline },
        ]}
      >
        <View style={[styles.handle, { backgroundColor: theme.line.strong }]} />
        <Text accessibilityRole="header" style={[styles.title, { color: theme.ink.primary }]}>
          {title}
        </Text>
        <ScrollView contentContainerStyle={styles.body}>{children}</ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1 },
  sheet: {
    maxHeight: SHEET_MAX_HEIGHT,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderTopWidth: borderWidth.hairline,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  handle: {
    width: size.grabHandle.width,
    height: size.grabHandle.height,
    borderRadius: radius.pill,
    alignSelf: 'center',
  },
  title: { ...uiText('lg', 'semiBold'), marginTop: spacing.md, marginBottom: spacing.md },
  body: { paddingBottom: spacing.lg, gap: spacing.xs },
});
