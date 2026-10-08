import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Image, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { BEAR_ASPECT, BEAR_IMAGES } from '../config/bearImages';
import { levelUpCopy } from '../domain/levelUp';

const BLUE = '#003262';
const GOLD = '#FDB515';
const CONFETTI = [GOLD, '#ffffff', '#3b82f6', GOLD, '#fde68a', '#60a5fa'];
const PIECES = 22;
const PICTURE_WIDTH = 270;

/** "Stage N unlocked": the new bear pops in over a little confetti. */
export const LevelUpModal = ({ stage, onClose }: { stage: number | null; onClose: () => void }) => {
  const visible = stage !== null;
  const pop = useRef(new Animated.Value(0)).current;
  const fall = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => alive && setReduceMotion(value))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    pop.setValue(0);
    fall.setValue(0);
    if (!visible) return undefined;
    if (reduceMotion) {
      pop.setValue(1);
      return undefined;
    }
    const native = Platform.OS !== 'web';
    Animated.spring(pop, { toValue: 1, friction: 5, tension: 70, useNativeDriver: native }).start();
    Animated.timing(fall, { toValue: 1, duration: 2600, easing: Easing.out(Easing.quad), useNativeDriver: native }).start();
    return () => {
      pop.stopAnimation();
      fall.stopAnimation();
    };
  }, [visible, stage, reduceMotion, pop, fall]);

  // A fixed scatter, so the pieces don't jump around on re-render.
  const pieces = useMemo(
    () =>
      Array.from({ length: PIECES }, (_, i) => ({
        left: ((i * 47) % 100) + (i % 3),
        size: 8 + ((i * 5) % 9),
        drift: ((i * 29) % 60) - 30,
        delay: (i % 6) * 0.04,
        color: CONFETTI[i % CONFETTI.length],
      })),
    [],
  );

  if (stage === null) return null;
  const copy = levelUpCopy(stage);
  const art = BEAR_IMAGES[Math.min(10, Math.max(1, stage))];
  const scale = pop.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        {!reduceMotion
          ? pieces.map((piece, i) => (
              <Animated.View
                key={i}
                pointerEvents="none"
                style={[
                  styles.piece,
                  {
                    left: `${Math.min(96, piece.left)}%`,
                    width: piece.size,
                    height: piece.size * 1.6,
                    backgroundColor: piece.color,
                    opacity: fall.interpolate({ inputRange: [0, piece.delay + 0.01, 0.85, 1], outputRange: [0, 1, 1, 0] }),
                    transform: [
                      { translateY: fall.interpolate({ inputRange: [0, 1], outputRange: [-40, 620] }) },
                      { translateX: fall.interpolate({ inputRange: [0, 1], outputRange: [0, piece.drift] }) },
                      { rotate: fall.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${piece.drift * 9}deg`] }) },
                    ],
                  },
                ]}
              />
            ))
          : null}

        <Animated.View style={[styles.card, { opacity: pop, transform: [{ scale }] }]}>
          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.name}>{copy.name}</Text>
          <Text style={styles.stage}>{copy.stageLabel}</Text>
          <View style={styles.picture}>
            <Image
              source={art.source}
              style={styles.image}
              resizeMode="cover"
              accessibilityLabel={`${copy.name}, ${copy.stageLabel}`}
            />
          </View>
          <Text style={styles.next}>{copy.next}</Text>
          <TouchableOpacity style={styles.button} onPress={onClose} accessibilityRole="button">
            <Text style={styles.buttonText}>Keep lifting</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,32,64,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    overflow: 'hidden',
  },
  piece: { position: 'absolute', top: 0, borderRadius: 2 },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#fff',
    borderRadius: 24,
    borderWidth: 4,
    borderColor: GOLD,
    paddingVertical: 22,
    paddingHorizontal: 18,
    alignItems: 'center',
    gap: 4,
  },
  title: { fontSize: 14, fontWeight: '800', letterSpacing: 4, color: '#b45309' },
  name: { fontSize: 30, fontWeight: '800', color: BLUE, marginTop: 2 },
  stage: { fontSize: 13, fontWeight: '700', color: '#64748b', marginBottom: 10 },
  picture: {
    width: PICTURE_WIDTH,
    height: PICTURE_WIDTH / BEAR_ASPECT,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: BLUE,
  },
  image: { width: '100%', height: '100%' },
  next: { fontSize: 13, color: '#475569', textAlign: 'center', marginTop: 10, paddingHorizontal: 6 },
  button: { backgroundColor: BLUE, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 36, marginTop: 14 },
  buttonText: { color: GOLD, fontSize: 16, fontWeight: '800' },
});
