import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View, StyleSheet } from 'react-native';
import { OskiBearLiftingSVG } from './OskiBearLiftingSVG';
import { OVERHEAD_PRESS } from '../config/oskiAnimation';

interface AnimatedOskiLiftingProps {
  size: number; // Scale multiplier (0.5 to 1.5)
  stage: number; // Stage 1-10
}

export const AnimatedOskiLifting: React.FC<AnimatedOskiLiftingProps> = ({
  size,
  stage,
}) => {
  const barbellY = useRef(new Animated.Value(-35)).current; // Start at overhead position

  // Overhead Press animation - only arms/barbell move, body stays still
  useEffect(() => {
    const chestLevel = 15; // Arms at chest/shoulder level (relative to center) - full range of motion
    const overheadLevel = -35; // Arms at overhead position

    // Reset animation value - start at overhead position
    barbellY.setValue(overheadLevel);

    const animate = () => {
      Animated.sequence([
        // Lower weight down (from overhead to chest level) - FULL REP
        Animated.timing(barbellY, {
          toValue: chestLevel,
          duration: OVERHEAD_PRESS.duration * 0.35,
          easing: Easing.in(Easing.quad), // Controlled lowering
          useNativeDriver: false, // Must be false for passing to SVG
        }),
        // Brief pause at bottom
        Animated.delay(OVERHEAD_PRESS.duration * 0.1),
        // Push weight up (from chest to overhead) - FULL REP
        Animated.timing(barbellY, {
          toValue: overheadLevel,
          duration: OVERHEAD_PRESS.duration * 0.4,
          easing: Easing.out(Easing.quad), // Slight acceleration as pushing up
          useNativeDriver: false,
        }),
        // Hold at top briefly
        Animated.delay(OVERHEAD_PRESS.duration * 0.15),
      ]).start((finished) => {
        // Loop continuously for reps
        if (finished) {
          animate();
        }
      });
    };

    // Start animation after a brief delay to ensure state is set
    const timeoutId = setTimeout(() => {
      animate();
    }, 100);

    // Cleanup function
    return () => {
      clearTimeout(timeoutId);
      barbellY.stopAnimation();
    };
  }, [size, stage, barbellY]);

  // Create interpolated value for SVG
  const [currentBarbellY, setCurrentBarbellY] = React.useState(-35);

  useEffect(() => {
    // Set initial value
    setCurrentBarbellY(barbellY._value);
    
    const listenerId = barbellY.addListener(({ value }) => {
      setCurrentBarbellY(value);
    });
    return () => {
      barbellY.removeListener(listenerId);
    };
  }, [barbellY]);

  return (
    <View style={styles.container}>
      <OskiBearLiftingSVG size={size} stage={stage} barbellY={currentBarbellY} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden', // Prevent spillover
    width: '100%',
    height: '100%',
    maxWidth: '100%',
    maxHeight: '100%',
  },
  animatedContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden', // Prevent spillover
    width: '100%',
    height: '100%',
    maxWidth: '100%',
    maxHeight: '100%',
  },
});

