import type { RefObject } from 'react';
import type { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { SHARE_CARD_HEIGHT, SHARE_CARD_WIDTH } from '../domain/shareCard';

/** Native: renders the view to a temporary PNG file and returns its file:// URI. */
export async function captureShareCard(ref: RefObject<View | null>): Promise<string> {
  return captureRef(ref, {
    format: 'png',
    quality: 1,
    result: 'tmpfile',
    width: SHARE_CARD_WIDTH,
    height: SHARE_CARD_HEIGHT,
  });
}
