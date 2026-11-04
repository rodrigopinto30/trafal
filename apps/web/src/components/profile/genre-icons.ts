import {
  BookOpenIcon,
  CarIcon,
  CastleIcon,
  CoffeeIcon,
  CompassIcon,
  CrosshairIcon,
  DicesIcon,
  FootprintsIcon,
  Gamepad2Icon,
  GhostIcon,
  MousePointerClickIcon,
  MusicIcon,
  PuzzleIcon,
  ShapesIcon,
  SproutIcon,
  SwordsIcon,
  VolleyballIcon,
  type LucideIcon,
} from "lucide-react";

/** Un ícono por género (los ids son los de la tabla `genres`). Un test comprueba que no falte ninguno. */
export const GENRE_ICONS: Record<string, LucideIcon> = {
  platformer: FootprintsIcon,
  arcade: Gamepad2Icon,
  puzzle: PuzzleIcon,
  narrative: BookOpenIcon,
  roguelike: DicesIcon,
  cozy: CoffeeIcon,
  horror: GhostIcon,
  rhythm: MusicIcon,
  racing: CarIcon,
  adventure: CompassIcon,
  strategy: CastleIcon,
  shooter: CrosshairIcon,
  simulation: SproutIcon,
  sports: VolleyballIcon,
  fighting: SwordsIcon,
  idle: MousePointerClickIcon,
  other: ShapesIcon,
};

export const FALLBACK_GENRE_ICON: LucideIcon = ShapesIcon;
