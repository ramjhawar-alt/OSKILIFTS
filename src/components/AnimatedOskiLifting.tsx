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

import { BEAR_ASPECT, BEAR_IMAGES } from '../config/bearImages';
import { OVERHEAD_PRESS } from '../config/oskiAnimation';
import { getBearStageName } from '../services/bearStreakService';

interface AnimatedOskiLiftingProps {
  stage: number; // 1-10
}

/**
 * The stage picture of Oski with a shoulder-press rep looping on it: he sinks to the
 * shoulders (the picture squashes down toward the ground and widens a touch), pauses,
 * presses back up to lockout, and holds. The ground stays put; the strip above the
 * picture is filled with its own sky colour while he is lowered.
 */
export const AnimatedOskiLifting: React.FC<AnimatedOskiLiftingProps> = ({ stage }) => {
  const art = BEAR_IMAGES[Math.min(10, Math.max(1, Math.round(stage) || 1))];
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

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
    width: '100%',
    height: '100%',
  },
  image: { width: '100%', height: '100%' },
});
