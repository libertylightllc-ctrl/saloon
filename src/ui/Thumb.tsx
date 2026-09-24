import { View } from 'react-native';

import { useTheme } from '@/theme';

import { Icon, type IconName } from './Icon';

/** Square list thumbnail: tinted fill + line icon, until real photos/artwork exist. */
export function Thumb({
  icon,
  index = 0,
  size = 56,
}: {
  icon: IconName;
  index?: number;
  size?: number;
}) {
  const theme = useTheme();
  const { thumbFills, thumbIcons } = theme.colors;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: theme.radius.thumb,
        backgroundColor: thumbFills[index % thumbFills.length],
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon
        name={icon}
        size={Math.round(size * 0.42)}
        color={thumbIcons[index % thumbIcons.length]}
      />
    </View>
  );
}
