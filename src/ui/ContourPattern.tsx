import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

/** Faint wavy lines, like the Barber kit's profile band. */
export function ContourPattern({ color }: { color: string }) {
  const lines = [20, 48, 76, 104, 132, 160, 188, 216];
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox="0 0 360 220" preserveAspectRatio="xMidYMid slice">
        {lines.map((y, i) => (
          <Path
            key={y}
            d={`M-20 ${y} C 60 ${y - 26 - i * 2}, 140 ${y + 30}, 220 ${y + 4} S 330 ${y - 30}, 390 ${y - 6}`}
            stroke={color}
            strokeOpacity={0.35}
            strokeWidth={1.2}
            fill="none"
          />
        ))}
      </Svg>
    </View>
  );
}
