/**
 * Line icons from lucide at 1.75 stroke (matches both reference kits). Referenced by name so
 * config and data can pick icons. Directional icons mirror in RTL.
 */
import {
  Armchair,
  ArrowLeft,
  Banknote,
  Bell,
  Boxes,
  Brush,
  Calculator,
  Calendar,
  CalendarClock,
  CalendarPlus,
  ChartColumn,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  ClipboardList,
  Clock,
  Coins,
  Contact,
  CreditCard,
  Ellipsis,
  Feather,
  FileText,
  Flower2,
  Gem,
  Hand,
  HandCoins,
  HandHeart,
  Hourglass,
  House,
  Image,
  Inbox,
  Languages,
  LayoutGrid,
  LogOut,
  MapPin,
  Minus,
  Package,
  Palette,
  PartyPopper,
  Percent,
  Phone,
  Play,
  Plus,
  Printer,
  ReceiptText,
  Rocket,
  RotateCcw,
  ScanFace,
  Scissors,
  Search,
  SearchX,
  Settings,
  Share2,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Star,
  Store,
  Tag,
  Timer,
  TriangleAlert,
  Truck,
  UserCheck,
  UserPlus,
  UserRound,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { View } from 'react-native';

import { useIsRTL, useTheme } from '@/theme';

export const icons = {
  alert: CircleAlert,
  armchair: Armchair,
  arrowLeft: ArrowLeft,
  banknote: Banknote,
  bell: Bell,
  boxes: Boxes,
  brush: Brush,
  calculator: Calculator,
  calendar: Calendar,
  calendarClock: CalendarClock,
  calendarPlus: CalendarPlus,
  chart: ChartColumn,
  check: Check,
  chevronDown: ChevronDown,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  circleCheck: CircleCheck,
  clipboard: ClipboardList,
  clock: Clock,
  coins: Coins,
  contact: Contact,
  creditCard: CreditCard,
  ellipsis: Ellipsis,
  face: ScanFace,
  feather: Feather,
  fileText: FileText,
  flower: Flower2,
  gem: Gem,
  grid: LayoutGrid,
  hand: Hand,
  handCoins: HandCoins,
  home: House,
  hourglass: Hourglass,
  image: Image,
  inbox: Inbox,
  languages: Languages,
  logOut: LogOut,
  mapPin: MapPin,
  massage: HandHeart,
  minus: Minus,
  package: Package,
  palette: Palette,
  partyPopper: PartyPopper,
  percent: Percent,
  phone: Phone,
  play: Play,
  plus: Plus,
  printer: Printer,
  receipt: ReceiptText,
  rocket: Rocket,
  rotate: RotateCcw,
  scissors: Scissors,
  search: Search,
  searchX: SearchX,
  settings: Settings,
  share: Share2,
  shield: ShieldCheck,
  shoppingBag: ShoppingBag,
  sliders: SlidersHorizontal,
  smartphone: Smartphone,
  sparkles: Sparkles,
  star: Star,
  store: Store,
  tag: Tag,
  timer: Timer,
  truck: Truck,
  user: UserRound,
  userCheck: UserCheck,
  userPlus: UserPlus,
  users: Users,
  wallet: Wallet,
  warning: TriangleAlert,
  x: X,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof icons;

/** Icons that point somewhere and so flip in right-to-left layouts. */
const DIRECTIONAL: ReadonlySet<IconName> = new Set([
  'arrowLeft',
  'chevronLeft',
  'chevronRight',
  'logOut',
]);

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  /** Override automatic RTL mirroring. */
  mirror?: boolean;
}

export function Icon({ name, size = 20, color, strokeWidth = 1.75, mirror }: IconProps) {
  const theme = useTheme();
  const rtl = useIsRTL();
  const Glyph = icons[name];
  const flip = rtl && (mirror ?? DIRECTIONAL.has(name));
  return (
    <View
      style={flip ? { transform: [{ scaleX: -1 }] } : undefined}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Glyph size={size} color={color ?? theme.colors.text} strokeWidth={strokeWidth} />
    </View>
  );
}
