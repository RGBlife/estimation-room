import type { ComponentType } from 'react';
import UltimateBoard from './UltimateBoard.tsx';
import ConnectBoard from './ConnectBoard.tsx';
import BattleshipBoard from './BattleshipBoard.tsx';
import DotsBoard from './DotsBoard.tsx';
import MancalaBoard from './MancalaBoard.tsx';
import WordsBoard from './WordsBoard.tsx';
import ReactionBoard from './ReactionBoard.tsx';
import TypingBoard from './TypingBoard.tsx';
import MathsBoard from './MathsBoard.tsx';
import PongBoard from './PongBoard.tsx';
import CyclesBoard from './CyclesBoard.tsx';
import type { DuelGame } from '../../../types/games.ts';
import type { BoardProps } from './types.ts';

export const BOARDS: Record<DuelGame, ComponentType<BoardProps>> = {
  ultimate: UltimateBoard, connect: ConnectBoard, battleship: BattleshipBoard, dots: DotsBoard, mancala: MancalaBoard,
  words: WordsBoard, reaction: ReactionBoard, typing: TypingBoard, maths: MathsBoard, pong: PongBoard, cycles: CyclesBoard,
};
