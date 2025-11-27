import React from 'react';
import Svg, { Circle, Ellipse, Path, G, Rect } from 'react-native-svg';

interface OskiBearLiftingSVGProps {
  size: number; // Scale multiplier (0.5 to 1.5)
  stage: number; // Stage 1-10
  barbellY?: number; // Animated Y position for barbell (for lifting motion)
}

export const OskiBearLiftingSVG: React.FC<OskiBearLiftingSVGProps> = ({ size, stage, barbellY }) => {
  const baseSize = 200;
  const centerX = baseSize / 2;
  const centerY = baseSize / 2;

  // Berkeley colors
  const BERKELEY_BLUE = '#003262';
  const BERKELEY_GOLD = '#FDB515';
  const BEAR_BROWN = '#8B4513';
  const BEAR_TAN = '#D2B48C';
  const BEAR_DARK = '#654321';
  const WEIGHT_GRAY = '#4a5568';
  const WEIGHT_DARK = '#1a1a1a';
  const BARBELL_BLACK = '#1a1a1a';

  // Calculate weight plate size based on stage
  const baseWeightSize = 10;
  const weightSize = baseWeightSize + (stage - 1) * 1.2;
  const numPlates = Math.min(2 + Math.floor(stage / 3), 4);

  // Barbell dimensions
  const barWidth = 120;
  const barHeight = 3;
  // Use animated barbellY if provided, otherwise default to overhead position
  const barY = barbellY !== undefined ? barbellY : -35;
  
  // Adaptive landscape viewBox - expands at higher stages to accommodate larger Oski
  // Base size for stage 6 (reference stage)
  const baseViewBoxWidth = 400;
  const baseViewBoxHeight = 250;
  const baseAspectRatio = baseViewBoxWidth / baseViewBoxHeight; // 1.6:1
  
  // Get current Oski size (matches OskiBear.tsx multipliers)
  const sizeMultipliers: Record<number, number> = {
    1: 0.5, 2: 0.6, 3: 0.7, 4: 0.8, 5: 0.9,
    6: 1.0, 7: 1.08, 8: 1.15, 9: 1.22, 10: 1.3,
  };
  const currentSize = sizeMultipliers[stage] || 1.0;
  const referenceSize = 1.0; // Stage 6 size
  
  // Adaptive expansion: expand viewBox at higher stages to accommodate larger Oski
  // Expansion factor: how much to expand per size unit above 1.0
  const expansionFactor = 60; // Expand 60 units per size unit above 1.0
  const sizeDifference = Math.max(0, currentSize - referenceSize);
  
  // Calculate adaptive viewBox dimensions
  const viewBoxWidth = baseViewBoxWidth + sizeDifference * expansionFactor;
  const viewBoxHeight = baseViewBoxHeight + sizeDifference * expansionFactor;
  // Maintain aspect ratio
  const adjustedViewBoxHeight = viewBoxWidth / baseAspectRatio;
  const finalViewBoxHeight = Math.max(viewBoxHeight, adjustedViewBoxHeight);
  
  // Ground level - Oski's feet are at y=62 relative to center
  const groundLevel = 62;
  
  // Calculate grass height to match stage 6 (size = 1.0)
  // At stage 6: groundLevel = 62, viewBox bottom relative to center = baseViewBoxHeight/2 = 125
  // Grass should extend from groundLevel to bottom of viewBox
  // Use base height for grass calculation to keep it consistent
  const grassHeight = (baseViewBoxHeight / 2) - groundLevel; // Fixed grass height matching stage 6
  
  // Calculate maximum weight extend for positioning
  const maxWeightExtend = weightSize * numPlates * 1.5;
  
  // Ensure weights fit within the adaptive viewBox
  // If weights are too wide, we'll scale them down slightly if needed
  const maxAllowedWidth = viewBoxWidth * 0.75; // 75% of viewBox width for safety (more margin)
  const actualWeightWidth = barWidth + maxWeightExtend * 2;
  const weightScale = actualWeightWidth > maxAllowedWidth ? maxAllowedWidth / actualWeightWidth : 1;

  // Background environment colors - consistent grass color
  const SKY_BLUE = '#87CEEB';
  const GRASS_GREEN = '#7CB342'; // Consistent grass green throughout
  const TREE_GREEN = '#2E7D32';
  const TREE_BROWN = '#5D4037';
  const ROCK_GRAY = '#757575';
  const MOUNTAIN_GRAY = '#9E9E9E';

  // Calculate viewBox origin - centered on Oski both horizontally and vertically
  // Oski is at (0, 0) in transformed space (after translate(centerX, centerY))
  // ViewBox should be centered on Oski
  const viewBoxX = centerX - viewBoxWidth / 2;
  const viewBoxY = centerY - finalViewBoxHeight / 2;

  return (
    <Svg 
      width="100%" 
      height="100%" 
      viewBox={`${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${finalViewBoxHeight}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ 
        width: '100%', 
        height: '100%',
        maxWidth: '100%', 
        maxHeight: '100%',
        alignSelf: 'center',
      }}
    >
      <G transform={`scale(${size}) translate(${centerX}, ${centerY})`}>
        {/* BACKGROUND ENVIRONMENT - Progressive with stages */}
        {/* Sky gradient background */}
        <Rect
          x={-viewBoxWidth/2}
          y={-finalViewBoxHeight/2}
          width={viewBoxWidth}
          height={finalViewBoxHeight}
          fill={SKY_BLUE}
          opacity={0.3}
        />
        
        {/* Ground/grass - fixed length matching stage 6, positioned at Oski's feet */}
        <Rect
          x={-viewBoxWidth/2}
          y={groundLevel}
          width={viewBoxWidth}
          height={grassHeight} // Fixed grass height matching stage 6
          fill={GRASS_GREEN}
        />

        {/* Stage 1-3: Simple trees in background - positioned on ground */}
        {stage >= 1 && (
          <>
            {/* Left tree */}
            <Rect
              x={-viewBoxWidth/2 + 30}
              y={groundLevel}
              width={10}
              height={30}
              fill={TREE_BROWN}
            />
            <Circle
              cx={-viewBoxWidth/2 + 35}
              cy={groundLevel - 5}
              r={15}
              fill={TREE_GREEN}
            />
            
            {/* Right tree */}
            <Rect
              x={viewBoxWidth/2 - 40}
              y={groundLevel}
              width={10}
              height={30}
              fill={TREE_BROWN}
            />
            <Circle
              cx={viewBoxWidth/2 - 35}
              cy={groundLevel - 5}
              r={15}
              fill={TREE_GREEN}
            />
          </>
        )}

        {/* Stage 4-6: More trees and simple rocks - on ground */}
        {stage >= 4 && (
          <>
            {/* Additional trees */}
            <Rect
              x={-viewBoxWidth/2 + 60}
              y={groundLevel}
              width={8}
              height={25}
              fill={TREE_BROWN}
            />
            <Circle
              cx={-viewBoxWidth/2 + 64}
              cy={groundLevel - 3}
              r={12}
              fill={TREE_GREEN}
            />
            
            <Rect
              x={viewBoxWidth/2 - 68}
              y={groundLevel}
              width={8}
              height={25}
              fill={TREE_BROWN}
            />
            <Circle
              cx={viewBoxWidth/2 - 64}
              cy={groundLevel - 3}
              r={12}
              fill={TREE_GREEN}
            />

            {/* Simple rocks - on ground */}
            <Ellipse
              cx={-viewBoxWidth/2 + 45}
              cy={groundLevel + 3}
              rx={10}
              ry={6}
              fill={ROCK_GRAY}
              opacity={0.7}
            />
            <Ellipse
              cx={viewBoxWidth/2 - 45}
              cy={groundLevel + 3}
              rx={10}
              ry={6}
              fill={ROCK_GRAY}
              opacity={0.7}
            />
          </>
        )}

        {/* Stage 7-9: Mountains and more detailed environment */}
        {stage >= 7 && (
          <>
            {/* Mountains in background */}
            <Path
              d={`M ${-viewBoxWidth/2} ${groundLevel - 20} L ${-viewBoxWidth/2 + 50} ${-finalViewBoxHeight/2 + 20} L ${-viewBoxWidth/2 + 100} ${groundLevel - 20} Z`}
              fill={MOUNTAIN_GRAY}
              opacity={0.5}
            />
            <Path
              d={`M ${viewBoxWidth/2 - 100} ${groundLevel - 20} L ${viewBoxWidth/2 - 50} ${-finalViewBoxHeight/2 + 20} L ${viewBoxWidth/2} ${groundLevel - 20} Z`}
              fill={MOUNTAIN_GRAY}
              opacity={0.5}
            />

            {/* More detailed rocks - on ground */}
            <Ellipse
              cx={-viewBoxWidth/2 + 70}
              cy={groundLevel + 4}
              rx={8}
              ry={5}
              fill={ROCK_GRAY}
              opacity={0.7}
            />
            <Ellipse
              cx={viewBoxWidth/2 - 70}
              cy={groundLevel + 4}
              rx={8}
              ry={5}
              fill={ROCK_GRAY}
              opacity={0.7}
            />
          </>
        )}

        {/* Stage 10: Full advanced environment */}
        {stage >= 10 && (
          <>
            {/* Additional mountain peaks */}
            <Path
              d={`M ${-viewBoxWidth/2 + 30} ${groundLevel - 20} L ${-viewBoxWidth/2 + 60} ${-finalViewBoxHeight/2 + 30} L ${-viewBoxWidth/2 + 90} ${groundLevel - 20} Z`}
              fill={MOUNTAIN_GRAY}
              opacity={0.4}
            />
            <Path
              d={`M ${viewBoxWidth/2 - 90} ${groundLevel - 20} L ${viewBoxWidth/2 - 60} ${-finalViewBoxHeight/2 + 30} L ${viewBoxWidth/2 - 30} ${groundLevel - 20} Z`}
              fill={MOUNTAIN_GRAY}
              opacity={0.4}
            />

            {/* Boulder rocks - on ground */}
            <Circle
              cx={-viewBoxWidth/2 + 35}
              cy={groundLevel + 5}
              r={12}
              fill={ROCK_GRAY}
              opacity={0.8}
            />
            <Circle
              cx={viewBoxWidth/2 - 35}
              cy={groundLevel + 5}
              r={12}
              fill={ROCK_GRAY}
              opacity={0.8}
            />

            {/* Extra trees for depth - on ground */}
            <Rect
              x={-viewBoxWidth/2 + 20}
              y={groundLevel}
              width={7}
              height={22}
              fill={TREE_BROWN}
            />
            <Circle
              cx={-viewBoxWidth/2 + 23.5}
              cy={groundLevel - 4}
              r={10}
              fill={TREE_GREEN}
            />
          </>
        )}

        {/* STATIC BODY - Head, torso, legs stay in place */}
        
        {/* Bear Body/Torso - More rounded, Oski-like */}
        <Ellipse
          cx={0}
          cy={25}
          rx={30}
          ry={32}
          fill={BEAR_TAN}
          stroke={BEAR_DARK}
          strokeWidth="2"
        />

        {/* Bear Head - More rounded, friendly Oski shape */}
        <Circle
          cx={0}
          cy={-18}
          r={26}
          fill={BEAR_TAN}
          stroke={BEAR_DARK}
          strokeWidth="2"
        />

        {/* Left Ear - Rounded Oski ears */}
        <Circle
          cx={-15}
          cy={-38}
          r={10}
          fill={BEAR_TAN}
          stroke={BEAR_DARK}
          strokeWidth="2"
        />
        <Circle
          cx={-15}
          cy={-38}
          r={5.5}
          fill={BEAR_BROWN}
        />

        {/* Right Ear */}
        <Circle
          cx={15}
          cy={-38}
          r={10}
          fill={BEAR_TAN}
          stroke={BEAR_DARK}
          strokeWidth="2"
        />
        <Circle
          cx={15}
          cy={-38}
          r={5.5}
          fill={BEAR_BROWN}
        />

        {/* Cal Hat - Actual Oski bear hat style */}
        {/* Hat base/crown - blue cap */}
        <Path
          d="M -20 -46 L -20 -64 L 20 -64 L 20 -46 L 16 -46 L 16 -41 L -16 -41 L -16 -46 Z"
          fill={BERKELEY_BLUE}
          stroke={BEAR_DARK}
          strokeWidth="1.5"
        />
        {/* Gold "C" letter on hat - Cal logo */}
        <Path
          d="M -8 -58 Q -12 -58 -12 -54 Q -12 -50 -8 -50 Q -4 -50 -4 -54 Q -4 -58 -8 -58"
          fill={BERKELEY_GOLD}
          stroke={BERKELEY_GOLD}
          strokeWidth="1"
        />
        {/* Gold band below C */}
        <Rect
          x={-16}
          y={-52}
          width={32}
          height={3}
          fill={BERKELEY_GOLD}
          rx={1}
        />
        {/* Hat brim - blue */}
        <Ellipse
          cx={0}
          cy={-41}
          rx={19}
          ry={3}
          fill={BERKELEY_BLUE}
        />
        {/* Gold button on top of hat */}
        <Circle
          cx={0}
          cy={-64}
          r={2.5}
          fill={BERKELEY_GOLD}
        />

        {/* Left Eye - Oski's friendly, rounded eyes */}
        <Circle
          cx={-9}
          cy={-24}
          r={4.5}
          fill="#000000"
        />
        <Circle
          cx={-7.5}
          cy={-26}
          r={2}
          fill="#FFFFFF"
        />

        {/* Right Eye */}
        <Circle
          cx={9}
          cy={-24}
          r={4.5}
          fill="#000000"
        />
        <Circle
          cx={10.5}
          cy={-26}
          r={2}
          fill="#FFFFFF"
        />

        {/* Nose - Oski's distinctive rounded nose */}
        <Ellipse
          cx={0}
          cy={-9}
          rx={3.5}
          ry={2.8}
          fill="#000000"
        />

        {/* Mouth - Oski's friendly, wide smile */}
        <Path
          d="M -6 -5 Q 0 0 6 -5"
          stroke="#000000"
          strokeWidth="2.2"
          fill="none"
          strokeLinecap="round"
        />
        {/* Smile creases */}
        <Path
          d="M -7 -3 Q -4 0 0 2"
          stroke="#000000"
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
          opacity={0.5}
        />
        <Path
          d="M 7 -3 Q 4 0 0 2"
          stroke="#000000"
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
          opacity={0.5}
        />

        {/* Legs - Stable stance, wider for balance */}
        <Ellipse
          cx={-14}
          cy={52}
          rx={7.5}
          ry={16}
          fill={BEAR_TAN}
          stroke={BEAR_DARK}
          strokeWidth="2"
        />
        <Ellipse
          cx={14}
          cy={52}
          rx={7.5}
          ry={16}
          fill={BEAR_TAN}
          stroke={BEAR_DARK}
          strokeWidth="2"
        />

        {/* Feet - Rounded Oski feet */}
        <Ellipse
          cx={-14}
          cy={62}
          rx={9}
          ry={4}
          fill={BEAR_BROWN}
        />
        <Ellipse
          cx={14}
          cy={62}
          rx={9}
          ry={4}
          fill={BEAR_BROWN}
        />

        {/* Berkeley "C" on chest (for higher stages) */}
        {stage >= 5 && (
          <Path
            d="M -6 10 Q -9 10 -9 14 Q -9 18 -6 18 Q -3 18 -3 14 Q -3 10 -6 10"
            fill={BERKELEY_BLUE}
            stroke={BERKELEY_GOLD}
            strokeWidth="0.8"
          />
        )}

        {/* ANIMATED ARMS AND BARBELL - These move up and down */}
        <G transform={`translate(0, ${barY - (-35)})`}>
          {/* Left Arm - Extended upward, moves with barbell */}
          <Ellipse
            cx={-36}
            cy={-8}
            rx={8.5}
            ry={20}
            fill={BEAR_TAN}
            stroke={BEAR_DARK}
            strokeWidth="2"
            transform={`rotate(-12 ${-36} ${-8})`}
          />

          {/* Right Arm - Extended upward, moves with barbell */}
          <Ellipse
            cx={36}
            cy={-8}
            rx={8.5}
            ry={20}
            fill={BEAR_TAN}
            stroke={BEAR_DARK}
            strokeWidth="2"
            transform={`rotate(12 ${36} ${-8})`}
          />

          {/* Left Paw/Hand - Gripping barbell */}
          <Circle
            cx={-40}
            cy={-35}
            r={5.5}
            fill={BEAR_BROWN}
            stroke={BEAR_DARK}
            strokeWidth="1.5"
          />
          <Rect
            x={-43}
            y={-37}
            width={6}
            height={4}
            fill={BEAR_BROWN}
            rx={1}
          />

          {/* Right Paw/Hand - Gripping barbell */}
          <Circle
            cx={40}
            cy={-35}
            r={5.5}
            fill={BEAR_BROWN}
            stroke={BEAR_DARK}
            strokeWidth="1.5"
          />
          <Rect
            x={37}
            y={-37}
            width={6}
            height={4}
            fill={BEAR_BROWN}
            rx={1}
          />

          {/* Barbell Bar - Moves with arms, scaled to fit viewBox */}
          <Rect
            x={(-barWidth / 2) * weightScale}
            y={-35 - barHeight / 2}
            width={barWidth * weightScale}
            height={barHeight}
            fill={BARBELL_BLACK}
            rx={barHeight / 2}
          />
          <Rect
            x={-25 * weightScale}
            y={-35 - barHeight / 2}
            width={50 * weightScale}
            height={barHeight}
            fill="#2c2c2c"
            rx={barHeight / 2}
          />

          {/* Left Side Weights - Move with barbell, scaled to fit viewBox */}
          {Array.from({ length: numPlates }).map((_, i) => {
            const plateX = (-barWidth / 2 - weightSize * (i + 1) - i * 3) * weightScale;
            const plateSize = weightSize * (1 - i * 0.12) * weightScale;
            return (
              <G key={`left-${i}`}>
                <Circle
                  cx={plateX}
                  cy={-35}
                  r={plateSize}
                  fill={WEIGHT_GRAY}
                  stroke={WEIGHT_DARK}
                  strokeWidth="2"
                />
                <Circle
                  cx={plateX}
                  cy={-35}
                  r={plateSize * 0.5}
                  fill="#2d3748"
                  stroke={WEIGHT_DARK}
                  strokeWidth="1"
                />
                <Circle
                  cx={plateX}
                  cy={-35}
                  r={plateSize * 0.2}
                  fill={WEIGHT_DARK}
                />
              </G>
            );
          })}

          {/* Right Side Weights - Move with barbell, scaled to fit viewBox */}
          {Array.from({ length: numPlates }).map((_, i) => {
            const plateX = (barWidth / 2 + weightSize * (i + 1) + i * 3) * weightScale;
            const plateSize = weightSize * (1 - i * 0.12) * weightScale;
            return (
              <G key={`right-${i}`}>
                <Circle
                  cx={plateX}
                  cy={-35}
                  r={plateSize}
                  fill={WEIGHT_GRAY}
                  stroke={WEIGHT_DARK}
                  strokeWidth="2"
                />
                <Circle
                  cx={plateX}
                  cy={-35}
                  r={plateSize * 0.5}
                  fill="#2d3748"
                  stroke={WEIGHT_DARK}
                  strokeWidth="1"
                />
                <Circle
                  cx={plateX}
                  cy={-35}
                  r={plateSize * 0.2}
                  fill={WEIGHT_DARK}
                />
              </G>
            );
          })}
        </G>
      </G>
    </Svg>
  );
};
