import { Platform } from 'react-native';

export type ShareOutcome = 'shared' | 'saved' | 'cancelled';

function dataUriToBlob(uri: string): Blob {
  const [header, payload] = uri.split(',');
  const mime = /data:([^;]+)/.exec(header)?.[1] ?? 'image/png';
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/**
 * Hands a captured PNG to the OS share sheet. On the web that is the Web Share
 * API where it can send files (phones), otherwise a plain download.
 */
export async function shareImage(uri: string, filename: string): Promise<ShareOutcome> {
  if (Platform.OS === 'web') {
    const blob = dataUriToBlob(uri);
    const file = new File([blob], filename, { type: blob.type });
    const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
    if (typeof nav.share === 'function' && nav.canShare?.({ files: [file] })) {
      try {
        await nav.share({ files: [file], title: 'OSKILIFTS' });
        return 'shared';
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return 'cancelled';
        // Fall through to a download if the share sheet itself failed.
      }
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return 'saved';
  }

  const Sharing = await import('expo-sharing');
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing isn’t available on this device.');
  }
  await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: 'Share your workout' });
  return 'shared';
}
