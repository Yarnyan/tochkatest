import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown } from "lucide-react";
import {
  COLS,
  CONNECT,
  ROWS,
  STORAGE_KEY,
} from "../../cfg/variables/variables";
import type {
  Cell,
  Coord,
  Player,
  StepInfo,
} from "./interfaces/game.interface";
import { translateUtils } from "../../utils/translate";
import Lottie from "lottie-react";
import ConfettiAnimation from "../../assets/lottie/Confetti.json";
import DrawModal from "./modal/DrawModal";

function createEmptyBoard(): Cell[][] {
  return Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => 0)
  );
}

function cloneBoard(board: Cell[][]): Cell[][] {
  return board.map((r) => r.slice());
}

function dropRowForColumn(board: Cell[][], col: number): number {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r][col] === 0) return r;
  }
  return -1;
}

function placeDisc(
  board: Cell[][],
  col: number,
  player: Player
): { row: number; board: Cell[][] } | null {
  const row = dropRowForColumn(board, col);
  if (row === -1) return null;
  const nb = cloneBoard(board);
  nb[row][col] = player;
  console.log(row, nb);
  return { row, board: nb };
}

function checkWin(
  board: Cell[][],
  player: Player,
  lastRow: number,
  lastCol: number
): Coord[] | null {
  const dirs = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];

  for (const [dr, dc] of dirs) {
    const positions: Coord[] = [[lastCol, lastRow]];
    for (let k = 1; k < CONNECT; k++) {
      const r = lastRow + dr * k;
      const c = lastCol + dc * k;
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) break;
      if (board[r][c] === player) positions.push([c, r]);
      else break;
    }
    for (let k = 1; k < CONNECT; k++) {
      const r = lastRow - dr * k;
      const c = lastCol - dc * k;
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) break;
      if (board[r][c] === player) positions.unshift([c, r]);
      else break;
    }
    if (positions.length >= CONNECT) {
      const idx = positions.findIndex(
        (p) => p[0] === lastCol && p[1] === lastRow
      );
      if (idx !== -1) {
        const start = Math.max(0, idx - (CONNECT - 1));
        const slice = positions.slice(start, start + CONNECT);
        if (slice.length === CONNECT) return slice as Coord[];
      }
    }
  }
  return null;
}

function isBoardFull(board: Cell[][]): boolean {
  for (let c = 0; c < COLS; c++) if (board[0][c] === 0) return false;
  return true;
}

// Валидатор
export function validator(moves: number[]): Record<string, StepInfo> {
  const result: Record<string, StepInfo> = {};
  const board = createEmptyBoard();
  const p1: Coord[] = [];
  const p2: Coord[] = [];

  function snapshot(
    step: number,
    state: "waiting" | "pending" | "win" | "draw",
    winner?: { who: "player_1" | "player_2"; positions: Coord[] }
  ) {
    result[`step_${step}`] = {
      player_1: p1.slice(),
      player_2: p2.slice(),
      board_state: state,
      ...(winner ? { winner } : {}),
    };
  }

  if (moves.length === 0) {
    snapshot(0, "waiting");
    return result;
  }

  snapshot(0, "waiting");

  let step = 0;
  let winnerFound = false;

  for (let i = 0; i < moves.length; i++) {
    const col = moves[i];
    const currentPlayer: Player = (i % 2 === 0 ? 1 : 2) as Player;
    const placed = placeDisc(board, col, currentPlayer);
    step++;
    if (!placed) {
      snapshot(step, "pending");
      continue;
    }
    const { row } = placed;
    if (currentPlayer === 1) p1.push([col, row]);
    else p2.push([col, row]);

    const winPositions = checkWin(board, currentPlayer, row, col);
    if (winPositions) {
      winnerFound = true;
      snapshot(step, "win", {
        who: currentPlayer === 1 ? "player_1" : "player_2",
        positions: winPositions,
      });
      break;
    }

    if (isBoardFull(board)) {
      snapshot(step, "draw");
      winnerFound = true;
      break;
    }

    snapshot(step, "pending");
  }

  return result;
}

// небольшой ии для игры

function getValidColumns(board: Cell[][]): number[] {
  const cols: number[] = [];
  for (let c = 0; c < COLS; c++) if (board[0][c] === 0) cols.push(c);
  return cols;
}

function aiPickColumn(board: Cell[][], aiPlayer: Player): number {
  const cols = getValidColumns(board);
  for (const c of cols) {
    const trial = placeDisc(board, c, aiPlayer);
    if (!trial) continue;
    const win = checkWin(trial.board, aiPlayer, trial.row, c);
    if (win) return c;
  }
  const opp: Player = aiPlayer === 1 ? 2 : 1;
  for (const c of cols) {
    const trial = placeDisc(board, c, opp);
    if (!trial) continue;
    const win = checkWin(trial.board, opp, trial.row, c);
    if (win) return c;
  }
  return cols[Math.floor(Math.random() * cols.length)];
}

export default function Game() {
  const [moves, setMoves] = useState<number[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.moves)) return parsed.moves;
      return [];
    } catch (e) {
      return [];
    }
  });

  const [onePlayer, setOnePlayer] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      return !!parsed.onePlayer;
    } catch (e) {
      return false;
    }
  });

  const [aiPlayer, setAiPlayer] = useState<Player>(2);

  const [isAnimating, setIsAnimating] = useState<boolean>(false);

  const [showWinAnimation, setShowWinAnimation] = useState<boolean>(false);

  const [showDrawModal, setShowDrawModal] = useState<boolean>(false);

  const historyRef = useRef<number[][]>([]);
  const historyIndexRef = useRef<number>(-1);

  const { board, currentPlayer, winner, winPositions, boardState } =
    useMemo(() => {
      let b = createEmptyBoard();
      let lastRow = -1;
      let lastCol = -1;
      let wPositions: Coord[] | null = null;
      for (let i = 0; i < moves.length; i++) {
        const col = moves[i];
        const player: Player = (i % 2 === 0 ? 1 : 2) as Player;
        const placed = placeDisc(b, col, player);
        if (!placed) continue;
        b = placed.board;
        lastRow = placed.row;
        lastCol = col;
        const win = checkWin(b, player, lastRow, lastCol);
        if (win) {
          wPositions = win;
          break;
        }
      }
      const winnerPlayer = wPositions
        ? (b[wPositions[0][1]][wPositions[0][0]] as Player)
        : null;
      const state: "waiting" | "pending" | "win" | "draw" =
        moves.length === 0
          ? "waiting"
          : wPositions
          ? "win"
          : isBoardFull(b)
          ? "draw"
          : "pending";
      const current: Player = (moves.length % 2 === 0 ? 1 : 2) as Player;
      return {
        board: b,
        currentPlayer: current,
        winner: winnerPlayer,
        winPositions: wPositions,
        boardState: state,
      };
    }, [moves]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ moves, onePlayer }));
  }, [moves, onePlayer]);

  useEffect(() => {
    if (boardState === "win") {
      setShowWinAnimation(true);
      const timer = setTimeout(() => {
        setShowWinAnimation(false);
      }, 3000);
      return () => clearTimeout(timer);
    } else if (boardState === "draw") {
      setShowDrawModal(true);
    }
  }, [boardState]);

  console.log(boardState);

  useEffect(() => {
    historyRef.current = [moves.slice()];
    historyIndexRef.current = 0;
  }, []);

  function pushToHistory(newMoves: number[]) {
    const hist = historyRef.current.slice(0, historyIndexRef.current + 1);
    hist.push(newMoves.slice());
    historyRef.current = hist;
    historyIndexRef.current = hist.length - 1;
  }

  function handleDrop(col: number) {
    console.log(col);
    if (boardState === "win" || boardState === "draw") return;
    if (isAnimating) return;

    const b = createEmptyBoard();
    for (let i = 0; i < moves.length; i++) {
      const p: Player = (i % 2 === 0 ? 1 : 2) as Player;
      placeDisc(b, moves[i], p);
    }

    const row = dropRowForColumn(b, col);
    if (row === -1) return;

    const newMoves = [...moves, col];
    setMoves(newMoves);
    pushToHistory(newMoves);
  }

  function handleRestart() {
    if (showDrawModal) setShowDrawModal(false);
    setMoves([]);
    pushToHistory([]);
  }

  function handleUndo() {
    const idx = historyIndexRef.current;
    if (idx <= 0) return;
    const newIdx = idx - 1;
    historyIndexRef.current = newIdx;
    const snapshot = historyRef.current[newIdx];
    setMoves(snapshot.slice());
  }

  useEffect(() => {
    if (!onePlayer) return;
    if (boardState === "win" || boardState === "draw") return;
    if (currentPlayer === aiPlayer) {
      const timer = setTimeout(() => {
        const col = aiPickColumn(board, aiPlayer);
        handleDrop(col);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [moves, onePlayer, aiPlayer, boardState]);

  function coordsOfPlayer(board: Cell[][], p: Player): Coord[] {
    const acc: Coord[] = [];
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) if (board[r][c] === p) acc.push([c, r]);
    return acc;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">4 в ряд</h1>
        <div className="flex gap-2 items-center">
          <button
            className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300"
            onClick={() => {
              setOnePlayer(!onePlayer);
            }}
          >
            {onePlayer ? "Играть вдвоем" : "Игра против ИИ"}
          </button>
          <button
            className="px-3 py-1 rounded bg-red-500 text-white hover:bg-red-600"
            onClick={handleRestart}
          >
            Перезапустить
          </button>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Текущий игрок:</span>
          <div
            className={`w-8 h-8 rounded-full ${
              currentPlayer === 1 ? "bg-yellow-400" : "bg-indigo-500"
            } border-2 border-gray-700`}
          ></div>
        </div>

        <div className="flex gap-2 items-center">
          <button
            className="px-2 py-1 bg-gray-100 rounded"
            onClick={handleUndo}
          >
            Отменить ход
          </button>
        </div>

        <div className="ml-auto text-sm text-gray-600">
          Состояние:
          <strong className="ml-1">{translateUtils[boardState]}</strong>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2 bg-blue-600 p-3 rounded-lg shadow-lg w-fit mx-auto ">
        {Array.from({ length: COLS }).map((_, c) => (
          <div
            key={`colcap-${c}`}
            className="h-6 w-12 flex items-center justify-center cursor-pointer hover:bg-blue-500 rounded"
            onClick={() => handleDrop(c)}
          >
            <ArrowDown color="white" />
          </div>
        ))}

        {Array.from({ length: ROWS }).map((_, r) => (
          <React.Fragment key={`row-${r}`}>
            {Array.from({ length: COLS }).map((_, c) => {
              const val = board[r][c];
              const isWinCell = winPositions
                ? winPositions.some((p) => p[0] === c && p[1] === r)
                : false;
              return (
                <div
                  key={`cell-${r}-${c}`}
                  className="h-12 w-12 flex items-center justify-center"
                >
                  <div
                    className={`w-10 h-10 rounded-full bg-white shadow-inner flex items-center justify-center transition-transform duration-300 ${
                      isAnimating && dropRowForColumn(board, c) > r
                        ? "translate-y-2"
                        : ""
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-full transform transition-all duration-300 ${
                        val === 0
                          ? "bg-transparent border-2 border-gray-300"
                          : val === 1
                          ? "bg-yellow-400 border-2 border-yellow-600"
                          : "bg-indigo-500 border-2 border-indigo-700"
                      } ${
                        isWinCell ? "ring-4 ring-offset-1 ring-green-400" : ""
                      }`}
                    ></div>
                  </div>
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 justify-items-center">
        <div className="p-4 border rounded w-full max-w-md">
          <h2 className="font-semibold mb-2">Информация</h2>
          <div className="text-sm text-gray-700">
            <div>
              Ходов сделано: <strong>{moves.length}</strong>
            </div>
            <div>
              Игрок 1 фишек: <strong>{coordsOfPlayer(board, 1).length}</strong>
            </div>
            <div>
              Игрок 2 фишек: <strong>{coordsOfPlayer(board, 2).length}</strong>
            </div>
            {boardState === "win" && winPositions && (
              <div className="mt-2 text-green-700">
                Победил
                {board[winPositions[0][1]][winPositions[0][0]] === 1
                  ? "Игрок 1"
                  : "Игрок 2"}
                !
              </div>
            )}
          </div>
        </div>
      </div>
      {showWinAnimation && (
        <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
          <Lottie
            animationData={ConfettiAnimation}
            loop={true}
            style={{ width: 400, height: 400 }}
          />
        </div>
      )}
      <DrawModal
        isOpen={showDrawModal}
        onRestart={handleRestart}
        onClose={() => setShowDrawModal(false)}
      />
    </div>
  );
}
