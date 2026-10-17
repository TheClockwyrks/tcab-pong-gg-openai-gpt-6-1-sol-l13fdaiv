import type { Game } from "@clockwyrks/simple-2d";
import { ACTIONS, BINDINGS, CUES } from "./constants";
import { initialState, createDebug } from "./world";
import { update } from "./simulation";
import { render, BACKGROUND } from "./view";
export { BACKGROUND };

export type Screen =
  "title" | "howto" | "countdown" | "playing" | "paused" | "matchover";

export type Mode = "solo" | "versus";

export type Side = "left" | "right";

export interface PaddleState {
  readonly cy: number;
  readonly vy: number;
  readonly driven: boolean;
  readonly drivenVy: number;
}

export interface AiState {
  readonly tracking: boolean;
  readonly movement: boolean;
}

export interface TrailSample {
  readonly x: number;
  readonly y: number;
  readonly t: number;
}

export interface BallState {
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly spin: number;
  readonly held: boolean;
  readonly holdTimer: number;
  readonly serveSign: 1 | -1;
  readonly trail: readonly TrailSample[];
}

export interface ObstacleState {
  readonly index: number;
  readonly cx: number;
  readonly cy: number;
  readonly theta: number;
}

export interface CaromState {
  readonly menuPress?: Readonly<Record<number, number>>;
  readonly screen: Screen;
  readonly mode: Mode;
  readonly menuIndex: number;
  readonly titleIndex: number;
  readonly resumeScreen: "countdown" | "playing";

  readonly score: { readonly p1: number; readonly p2: number };
  readonly winner: Side | null;

  readonly paddles: { readonly left: PaddleState; readonly right: PaddleState };
  readonly ai: AiState;

  readonly receiver: Side;
  readonly ball: BallState | null;
  readonly obstacles: readonly ObstacleState[];
  readonly obstacleClock: number;
  readonly obstacleClockRunning: boolean;

  readonly simTime: number;
  readonly muted: boolean;
}

export type CaromDebugApi = ReturnType<typeof createDebug>;
export const game: Game<CaromState, CaromDebugApi> = {
  initialize(api) {
    for (const action of ACTIONS)
      api.input.register(action, { keys: [...BINDINGS[action]] });
    const tones = [620, 260, 920, 440];
    Object.values(CUES).forEach((cue, i) =>
      api.audio.define(cue, {
        freq: tones[i],
        freqTo: tones[i] * 0.55,
        durationMs: 65 + i * 22,
        wave: i === 2 ? "triangle" : "sine",
        gain: 0.18,
      }),
    );
    api.diagnostics.register("screen", (s) => s.screen);
    api.diagnostics.register("mode", (s) => s.mode);
    api.diagnostics.register("score", (s) => `${s.score.p1} : ${s.score.p2}`);
    api.diagnostics.register("ball position", (s) =>
      s.ball ? `${s.ball.x.toFixed(1)}, ${s.ball.y.toFixed(1)}` : "absent",
    );
    api.diagnostics.register("ball velocity", (s) =>
      s.ball ? `${s.ball.vx.toFixed(1)}, ${s.ball.vy.toFixed(1)}` : "absent",
    );
    api.diagnostics.register("speed / spin", (s) =>
      s.ball
        ? `${Math.hypot(s.ball.vx, s.ball.vy).toFixed(1)} / ${s.ball.spin.toFixed(1)}`
        : "absent",
    );
    for (const side of ["left", "right"] as const)
      api.diagnostics.register(
        side,
        (s) =>
          `${s.paddles[side].cy.toFixed(1)} / ${s.paddles[side].vy.toFixed(1)}`,
      );
    return [initialState(false), createDebug()];
  },
  update,
  render,
};
