import React from 'react';
import Svg, { Circle, Ellipse, Path, G } from 'react-native-svg';

interface OskiBearSVGProps {
  size: number; // Scale multiplier (0.5 to 1.5)
  stage: number; // Stage 1-10
}

export const OskiBearSVG: React.FC<OskiBearSVGProps> = ({ size, stage }) => {
  const baseSize = 120;
  const scaledSize = baseSize * size;
  const centerX = baseSize / 2;
  const centerY = baseSize / 2;

  // Berkeley colors
  const BERKELEY_BLUE = '#003262';
  const BERKELEY_GOLD = '#FDB515';
  const BEAR_BROWN = '#8B4513';
  const BEAR_TAN = '#D2B48C';
  const BEAR_DARK = '#654321';

  return (
    <Svg width={scaledSize} height={scaledSize} viewBox={`0 0 ${baseSize} ${baseSize}`}>
      <G transform={`translate(${centerX}, ${centerY})`}>
        {/* Bear Body */}
        <Ellipse
          cx={0}
          cy={20}
          rx={35}
          ry={40}
          fill={BEAR_TAN}
          stroke={BEAR_DARK}
          strokeWidth="2"
        />
        
        {/* Bear Head */}
        <Circle
          cx={0}
          cy={-15}
          r={30}
          fill={BEAR_TAN}
          stroke={BEAR_DARK}
          strokeWidth="2"
        />
        
        {/* Left Ear */}
        <Circle
          cx={-18}
          cy={-35}
          r={12}
          fill={BEAR_TAN}
          stroke={BEAR_DARK}
          strokeWidth="2"
        />
        <Circle
          cx={-18}
          cy={-35}
          r={7}
          fill={BEAR_BROWN}
        />
        
        {/* Right Ear */}
        <Circle
          cx={18}
          cy={-35}
          r={12}
          fill={BEAR_TAN}
          stroke={BEAR_DARK}
          strokeWidth="2"
        />
        <Circle
          cx={18}
          cy={-35}
          r={7}
          fill={BEAR_BROWN}
        />
        
        {/* Oski's Hat - Blue with Gold Band */}
        <Path
          d="M -25 -50 L -25 -60 L 25 -60 L 25 -50 L 20 -50 L 20 -45 L -20 -45 L -20 -50 Z"
          fill={BERKELEY_BLUE}
          stroke={BEAR_DARK}
          strokeWidth="1.5"
        />
        {/* Gold band on hat */}
        <Path
          d="M -20 -50 L -20 -52 L 20 -52 L 20 -50 Z"
          fill={BERKELEY_GOLD}
        />
        {/* Hat brim */}
        <Ellipse
          cx={0}
          cy={-45}
          rx={22}
          ry={3}
          fill={BERKELEY_BLUE}
        />
        
        {/* Left Eye */}
        <Circle
          cx={-10}
          cy={-20}
          r={5}
          fill="#000000"
        />
        <Circle
          cx={-8}
          cy={-22}
          r={2}
          fill="#FFFFFF"
        />
        
        {/* Right Eye */}
        <Circle
          cx={10}
          cy={-20}
          r={5}
          fill="#000000"
        />
        <Circle
          cx={12}
          cy={-22}
          r={2}
          fill="#FFFFFF"
        />
        
        {/* Nose */}
        <Ellipse
          cx={0}
          cy={-8}
          rx={4}
          ry={3}
          fill="#000000"
        />
        
        {/* Mouth */}
        <Path
          d="M -4 -5 Q 0 -2 4 -5"
          stroke="#000000"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
        />
        
        {/* Left Arm */}
        <Ellipse
          cx={-32}
          cy={15}
          rx={12}
          ry={20}
          fill={BEAR_TAN}
          stroke={BEAR_DARK}
          strokeWidth="2"
        />
        
        {/* Right Arm */}
        <Ellipse
          cx={32}
          cy={15}
          rx={12}
          ry={20}
          fill={BEAR_TAN}
          stroke={BEAR_DARK}
          strokeWidth="2"
        />
        
        {/* Left Paw */}
        <Circle
          cx={-32}
          cy={30}
          r={8}
          fill={BEAR_BROWN}
        />
        
        {/* Right Paw */}
        <Circle
          cx={32}
          cy={30}
          r={8}
          fill={BEAR_BROWN}
        />
        
        {/* Berkeley "C" on chest (for higher stages) */}
        {stage >= 5 && (
          <Path
            d="M -8 5 Q -12 5 -12 10 Q -12 15 -8 15 Q -4 15 -4 10 Q -4 5 -8 5"
            fill={BERKELEY_BLUE}
            stroke={BERKELEY_GOLD}
            strokeWidth="1"
          />
        )}
      </G>
    </Svg>
  );
};

