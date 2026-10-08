import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  LayoutChangeEvent,
  Platform,
  StyleSheet,
  View,
} from 'react-native';

import { BEAR_ASPECT, BEAR_IMAGES, BearArt } from '../config/bearImages';
import { PRESS_REP_MS, PRESS_STEPS } from '../config/oskiAnimation';
import { barKnots, fadeWindows } from '../domain/pressFrames';
import { getBearStageName } from '../services/bearStreakService';

interface AnimatedOskiLiftingProps {
  stage: number; // 1-10
}

/**
 * Oski doing a shoulder press, looping. A stage that has press pictures (lockout to bottom)
 * flips through them, so the arms really bend. A stage without them shows its single
 * picture with a slow idle breath (the ground stays put).
 */
const BOB_MS = 3200;
const BOB_AMOUNT = 0.016; // +/-1.6% of the picture height: a slow breath, not a bounce

const IdleBob: React.FC<{ art: BearArt; stage: number }> = ({ art, stage }) => {
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [reduceMotion, setReduceMotion] = useState(false);
  const breath = useRef(new Animated.Value(0)).current; // 0 = settled, 1 = chest up

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
    breath.setValue(0);
    if (reduceMotion) return undefined;
    const native = Platform.OS !== 'web';
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: 1, duration: BOB_MS / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
        Animated.timing(breath, { toValue: 0, duration: BOB_MS / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breath, reduceMotion]);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setBox((current) => (current.width === width && current.height === height ? current : { width, height }));
  };

  // Fit the 4:3 picture inside the available space.
  const width = Math.min(box.width, box.height * BEAR_ASPECT);
  const height = width / BEAR_ASPECT;
  // Scale about the bottom edge so the ground stays put and the bear rises and settles.
  const scaleY = breath.interpolate({ inputRange: [0, 1], outputRange: [1 - BOB_AMOUNT, 1 + BOB_AMOUNT] });
  const scaleX = breath.interpolate({ inputRange: [0, 1], outputRange: [1 + BOB_AMOUNT / 3, 1 - BOB_AMOUNT / 3] });

  return (
    <View style={[styles.container, { backgroundColor: art.sky }]} onLayout={onLayout}>
      {width > 0 ? (
        <Animated.View
          style={{
            width,
            height,
            transform: [{ translateY: height / 2 }, { scaleX }, { scaleY }, { translateY: -height / 2 }],
          }}
        >
          <Image
            source={art.source}
            style={styles.image}
            resizeMode="contain"
            accessibilityLabel={`${getBearStageName(stage)}`}
          />
        </Animated.View>
      ) : null}
    </View>
  );
};

/** Flips through the press pictures, lockout to bottom. Later pictures fade in over earlier ones. */
const FlipbookPress: React.FC<{ art: BearArt; frames: number[]; stage: number }> = ({ art, frames, stage }) => {
  const [reduceMotion, setReduceMotion] = useState(false);
  // 0 = lockout, 1 = bottom, measured along the bar's real travel
  const position = useRef(new Animated.Value(0)).current;
  const windows = useMemo(
    () => fadeWindows(barKnots(art.bar && art.bar.length === frames.length ? art.bar : frames.map((_, i) => i))),
    [art.bar, frames],
  );

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => alive && setReduceMotion(value))
      .catch(() => undefined);
    // Decode every frame up front so the first rep doesn't flash an empty picture.
    frames.forEach((frame) => {
      try {
        const uri = Image.resolveAssetSource(frame)?.uri;
        if (uri) Image.prefetch(uri).catch(() => undefined);
      } catch {
        // prefetch is only a head start
      }
    });
    return () => {
      alive = false;
    };
  }, [frames]);

  useEffect(() => {
    position.setValue(0);
    if (reduceMotion) return undefined;
    const native = Platform.OS !== 'web';
    const rep = Animated.loop(
      Animated.sequence(
        PRESS_STEPS.map((step) =>
          Animated.timing(position, {
            toValue: step.to,
            duration: PRESS_REP_MS * step.over,
            easing:
              step.ease === 'inOut'
                ? Easing.inOut(Easing.sin)
                : step.ease === 'out'
                  ? Easing.out(Easing.quad)
                  : Easing.linear,
            useNativeDriver: native,
          }),
        ),
      ),
    );
    rep.start();
    return () => rep.stop();
  }, [position, reduceMotion]);

  const label = `${getBearStageName(stage)} doing a shoulder press`;

  return (
    <View style={[styles.container, styles.flipbook]} accessible accessibilityLabel={label}>
      <Image source={frames[0]} style={styles.layer} resizeMode="contain" />
      {frames.slice(1).map((frame, i) => (
        <Animated.Image
          key={i}
          source={frame}
          style={[
            styles.layer,
            { opacity: position.interpolate({ inputRange: windows[i].input, outputRange: windows[i].output }) },
          ]}
          resizeMode="contain"
        />
      ))}
    </View>
  );
};

export const AnimatedOskiLifting: React.FC<AnimatedOskiLiftingProps> = ({ stage }) => {
  const clamped = Math.min(10, Math.max(1, Math.round(stage) || 1));
  const art = BEAR_IMAGES[clamped];
  return art.frames && art.frames.length >= 2 ? (
    <FlipbookPress art={art} frames={art.frames} stage={clamped} />
  ) : (
    <IdleBob art={art} stage={clamped} />
  );
};

const styles = StyleSheet.create({
  flipbook: { backgroundColor: 'transparent' },
  layer: { position: 'absolute', width: '100%', height: '100%' },
  container: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
    width: '100%',
    height: '100%',
  },
  image: { width: '100%', height: '100%' },
});
