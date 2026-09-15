import {
  Bag, BookOpenText, ChartLineUp, Compass, Crosshair, FileText, Gauge, Globe,
  InstagramLogo, Lightning, Megaphone, PencilSimple, Repeat, SquaresFour, UsersThree,
} from "@phosphor-icons/react";

/** Kept out of the component files so fast refresh stays intact. */
export const HOME_ICONS: Record<string, typeof Bag> = {
  globe: Globe, bag: Bag, users: UsersThree, pen: PencilSimple, megaphone: Megaphone,
  instagram: InstagramLogo, chart: ChartLineUp, gauge: Gauge, book: BookOpenText,
  file: FileText, app: Lightning, repeat: Repeat,
  grid: SquaresFour, target: Crosshair, compass: Compass,
};

export { Bag as FallbackIcon };
