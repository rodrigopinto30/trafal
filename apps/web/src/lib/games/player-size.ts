/** The player is as wide as the page allows (up to 1280 px) but never so tall that it, with its control bar, falls below the fold: the 13.5 rem are the header, the gap above and the bar. Whatever sits right above or below the player uses the same width so their edges line up. */
export const PLAYER_WIDTH = "min(100%, 1280px, calc((100svh - 13.5rem) * 16 / 9))";
