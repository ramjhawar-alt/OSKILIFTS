import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { ShareCard } from './ShareCard';
import { SHARE_CARD_HEIGHT, SHARE_CARD_WIDTH, type ShareCardModel } from '../domain/shareCard';
import { captureShareCard } from '../services/captureShareCard';
import { shareImage } from '../services/shareImage';
import { showMessage } from '../utils/alert';

const PREVIEW_WIDTH = 270;

/**
 * Renders the share card offscreen, captures it, and shows the resulting PNG
 * as the preview, so what people see is exactly what gets shared.
 */
export const ShareWorkoutModal = ({
  model,
  onClose,
}: {
  model: ShareCardModel | null;
  onClose: () => void;
}) => {
  const cardRef = useRef<View>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [bearReady, setBearReady] = useState(false);
  const visible = model !== null;

  useEffect(() => {
    setImageUri(null);
    setFailed(false);
    if (!model) {
      setBearReady(false);
      return undefined;
    }
    let active = true;
    // Wait for the bear picture (or give up after a few seconds), then a beat to lay out.
    const timer = setTimeout(async () => {
      try {
        const uri = await captureShareCard(cardRef);
        if (active) setImageUri(uri);
      } catch (error) {
        console.error('Share card capture failed:', error);
        if (active) setFailed(true);
      }
    }, bearReady ? 250 : 3500);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [model, bearReady]);

  const handleShare = useCallback(async () => {
    if (!imageUri || !model) return;
    setSharing(true);
    try {
      const outcome = await shareImage(imageUri, model.filename);
      if (outcome === 'saved') showMessage('Image saved', 'Your workout card was downloaded.');
    } catch (error) {
      showMessage('Couldn’t share', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSharing(false);
    }
  }, [imageUri, model]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.heading}>Share your workout</Text>

          <View style={styles.preview}>
            {imageUri ? (
              <Image
                source={{ uri: imageUri }}
                style={styles.previewImage}
                accessibilityLabel="Preview of your workout card"
              />
            ) : failed ? (
              <Text style={styles.failed}>Couldn’t create the image. Please try again.</Text>
            ) : (
              <ActivityIndicator color="#2563eb" />
            )}
          </View>

          <TouchableOpacity
            style={[styles.primary, (!imageUri || sharing) && styles.disabled]}
            onPress={handleShare}
            disabled={!imageUri || sharing}
            accessibilityRole="button"
          >
            <Text style={styles.primaryText}>{Platform.OS === 'web' ? 'Share or download' : 'Share'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondary} onPress={onClose} accessibilityRole="button">
            <Text style={styles.secondaryText}>Close</Text>
          </TouchableOpacity>
        </View>

        {/* Drawn at full size but out of sight; captureRef reads this view. */}
        {model ? (
          <View pointerEvents="none" style={styles.offscreen}>
            <ShareCard ref={cardRef} model={model} onBearLoaded={() => setBearReady(true)} />
          </View>
        ) : null}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  sheet: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 12,
  },
  heading: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  preview: {
    width: PREVIEW_WIDTH,
    height: (PREVIEW_WIDTH * SHARE_CARD_HEIGHT) / SHARE_CARD_WIDTH,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: { width: '100%', height: '100%' },
  failed: { color: '#dc2626', fontSize: 14, textAlign: 'center', padding: 16 },
  primary: {
    alignSelf: 'stretch',
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  disabled: { opacity: 0.5 },
  secondary: { paddingVertical: 8 },
  secondaryText: { color: '#64748b', fontSize: 15, fontWeight: '600' },
  offscreen: { position: 'absolute', left: -20000, top: 0 },
});
