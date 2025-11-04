export type Cell = 0 | 1 | 2;

export type Player = 1 | 2;

export type Coord = [number, number];

export interface StepInfo {
  player_1: Coord[];
  player_2: Coord[];
  board_state: "waiting" | "pending" | "win" | "draw";
  winner?: {
    who: "player_1" | "player_2";
    positions: Coord[];
  };
}
