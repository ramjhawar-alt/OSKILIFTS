import type { RefObject } from 'react';
import type { View } from 'react-native';
import html2canvas from 'html2canvas';

import { SHARE_CARD_HEIGHT, SHARE_CARD_WIDTH } from '../domain/shareCard';

/**
 * Web: react-native-view-shot can't resolve refs under react-native-web, so
 * draw the DOM node directly. The card is laid out at exactly 1080x1920 CSS
 * pixels, so scale 1 gives the final image size.
 */
export async function captureShareCard(ref: RefObject<View | null>): Promise<string> {
  const node = ref.current as unknown as HTMLElement | null;
  if (!node) throw new Error('The share card is not on screen.');
  const canvas = await html2canvas(node, {
    scale: 1,
    width: SHARE_CARD_WIDTH,
    height: SHARE_CARD_HEIGHT,
    backgroundColor: null,
    useCORS: true,
    logging: false,
  });
  return canvas.toDataURL('image/png');
}
