import React, { useEffect, useRef, useState } from 'react';
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
import { OVERHEAD_PRESS, PRESS_STEPS } from '../config/oskiAnimation';
import { getBearStageName } from '../services/bearStreakService';

interface AnimatedOskiLiftingProps {
  stage: number; // 1-10
}

/**
 * Oski doing a shoulder press, looping. A stage that has press pictures (lockout, middle,
 * bottom) flips through them, so the arms really bend. A stage without them squashes its
 * single picture toward the ground instead (the ground stays put; the strip above the
 * picture is filled with its own sky colour while he is lowered).
 */
const SquashPress: React.FC<{ art: BearArt; stage: number }> = ({ art, stage }) => {
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [reduceMotion, setReduceMotion] = useState(false);
  // 0 = locked out overhead, 1 = bar at the shoulders
  const lowered = useRef(new Animated.Value(0)).current;

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
    lowered.setValue(0);
    if (reduceMotion) return undefined;
    const native = Platform.OS !== 'web';
    const rep = Animated.loop(
      Animated.sequence([
        Animated.delay(OVERHEAD_PRESS.duration * 0.15), // hold at the top
        Animated.timing(lowered, {
          toValue: 1,
          duration: OVERHEAD_PRESS.duration * 0.35, // controlled lowering
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: native,
        }),
        Animated.delay(OVERHEAD_PRESS.duration * 0.1), // pause at the shoulders
        Animated.timing(lowered, {
          toValue: 0,
          duration: OVERHEAD_PRESS.duration * 0.4, // drive it up
          easing: Easing.out(Easing.cubic),
          useNativeDriver: native,
        }),
      ]),
    );
    rep.start();
    return () => rep.stop();
  }, [lowered, reduceMotion]);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setBox((current) => (current.width === width && current.height === height ? current : { width, height }));
  };

  // Fit the 4:3 picture inside the available space.
  const width = Math.min(box.width, box.height * BEAR_ASPECT);
  const height = width / BEAR_ASPECT;
  const range = OVERHEAD_PRESS.movementRange;

  const scaleY = lowered.interpolate({ inputRange: [0, 1], outputRange: [1, 1 - range] });
  const scaleX = lowered.interpolate({ inputRange: [0, 1], outputRange: [1, 1 + range * 0.35] });

  return (
    <View style={[styles.container, { backgroundColor: art.sky }]} onLayout={onLayout}>
      {width > 0 ? (
        <Animated.View
          style={{
            width,
            height,
            // scale about the bottom edge: move it to the centre, scale, move it back
            transform: [{ translateY: height / 2 }, { scaleX }, { scaleY }, { translateY: -height / 2 }],
          }}
        >
          <Image
            source={art.source}
            style={styles.image}
            resizeMode="contain"
            accessibilityLabel={`${getBearStageName(stage)} doing a shoulder press`}
          />
        </Animated.View>
      ) : null}
    </View>
  );
};

/** Flips through the lockout, middle and bottom pictures. Later pictures fade in over earlier ones. */
const FlipbookPress: React.FC<{ frames: [number, number, number]; stage: number }> = ({ frames, stage }) => {
  const [reduceMotion, setReduceMotion] = useState(false);
  // 0 = lockout, 1 = middle, 2 = bottom
  const position = useRef(new Animated.Value(0)).current;

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
            duration: OVERHEAD_PRESS.duration * step.over,
            easing: Easing.linear,
            useNativeDriver: native,
          }),
        ),
      ),
    );
    rep.start();
    return () => rep.stop();
  }, [position, reduceMotion]);

  const middleOpacity = position.interpolate({ inputRange: [0, 1, 2], outputRange: [0, 1, 1] });
  const bottomOpacity = position.interpolate({ inputRange: [0, 1, 2], outputRange: [0, 0, 1] });
  const label = `${getBearStageName(stage)} doing a shoulder press`;

  return (
    <View style={[styles.container, styles.flipbook]} accessible accessibilityLabel={label}>
      <Image source={frames[0]} style={styles.layer} resizeMode="contain" />
      <Animated.Image source={frames[1]} style={[styles.layer, { opacity: middleOpacity }]} resizeMode="contain" />
      <Animated.Image source={frames[2]} style={[styles.layer, { opacity: bottomOpacity }]} resizeMode="contain" />
    </View>
  );
};

export const AnimatedOskiLifting: React.FC<AnimatedOskiLiftingProps> = ({ stage }) => {
  const clamped = Math.min(10, Math.max(1, Math.round(stage) || 1));
  const art = BEAR_IMAGES[clamped];
  return art.frames ? (
    <FlipbookPress frames={art.frames} stage={clamped} />
  ) : (
    <SquashPress art={art} stage={clamped} />
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
