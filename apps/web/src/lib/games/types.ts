export type Creator = {
  username: string;
  display_name: string;
  avatar_path: string | null;
};

export type GameSummary = {
  id: string;
  public_id: string;
  title: string;
  short_description: string;
  genre_id: string | null;
  engine_id: string | null;
  tags: string[];
  cover_path: string | null;
  works_on_mobile: boolean;
  is_first_game: boolean;
  display_ratio: string;
  play_count: number;
  like_count: number;
  comment_count: number;
  published_at: string | null;
  owner: Creator;
};

export type GameDetail = GameSummary & {
  controls: string;
  save_count: number;
};

export type GameReference = {
  public_id: string;
  title: string;
};

export type PostKind = "avance" | "nuevo_juego" | "pide_feedback" | "hito";

export type PostSummary = {
  id: string;
  kind: PostKind;
  body: string;
  highlight: string | null;
  created_at: string;
  like_count: number;
  comment_count: number;
  author: Creator;
  game: GameReference | null;
};

export type CommentLabel = "liked" | "suggestion";

export type CommentSummary = {
  id: string;
  parent_id: string | null;
  body: string;
  label: CommentLabel | null;
  is_helpful: boolean;
  created_at: string;
  author: Creator;
};

export type CommunityHighlight = CommentSummary & { game: GameReference };

export type FeaturedGame = {
  quote: string | null;
  game: GameSummary;
};
