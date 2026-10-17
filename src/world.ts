import type { DeepReadonly } from "ts-essentials";
import type {
  CaromState,
  BallState,
  Side,
  Screen,
  Mode,
  PaddleState,
} from "./game";
import * as C from "./constants";
export type State = DeepReadonly<CaromState>;
export const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));
export const sign = (): 1 | -1 => (Math.random() < 0.5 ? -1 : 1);
export function parked(): BallState {
  return {
    x: C.FIELD_CX,
    y: C.FIELD_CY,
    vx: 0,
    vy: 0,
    spin: 0,
    held: true,
    holdTimer: C.HOLD_TIME,
    serveSign: sign(),
    trail: [],
  };
}
export function obstacle(index: number, t: number) {
  const base = C.OBSTACLE_CENTERS[index];
  if (!base) throw new Error("Unknown obstacle index");
  return {
    index,
    cx: base.x,
    cy:
      base.y +
      (index === 0 ? 1 : -1) *
        C.OBSTACLE_SWAY_AMP *
        Math.sin((2 * Math.PI * t) / C.OBSTACLE_SWAY_PERIOD),
    theta: C.OBSTACLE_SPIN_RATE * t,
  };
}
export function initialState(muted: boolean): CaromState {
  const paddle = () => ({ cy: C.FIELD_CY, vy: 0, driven: false, drivenVy: 0 });
  return {
    screen: "title",
    mode: "solo",
    menuIndex: 0,
    titleIndex: 0,
    resumeScreen: "playing",
    score: { p1: 0, p2: 0 },
    winner: null,
    paddles: { left: paddle(), right: paddle() },
    ai: { tracking: true, movement: true },
    receiver: "left",
    ball: parked(),
    obstacles: C.OBSTACLE_CENTERS.map((_, i) => obstacle(i, 0)),
    obstacleClock: 0,
    obstacleClockRunning: true,
    simTime: 0,
    muted,
  };
}
export function start(s: State, mode: Mode): CaromState {
  const fresh = initialState(s.muted);
  // Debug ownership is changed only by its dedicated pose or reset.
  return {
    ...fresh,
    screen: "countdown",
    mode,
    titleIndex: s.titleIndex,
    simTime: s.simTime,
    paddles: {
      left: {
        ...fresh.paddles.left,
        driven: s.paddles.left.driven,
        drivenVy: s.paddles.left.drivenVy,
      },
      right: {
        ...fresh.paddles.right,
        driven: s.paddles.right.driven,
        drivenVy: s.paddles.right.drivenVy,
      },
    },
  };
}
export function title(s: State): CaromState {
  const fresh = initialState(s.muted);
  return {
    ...fresh,
    titleIndex: s.titleIndex,
    menuIndex: s.titleIndex,
    simTime: s.simTime,
    paddles: {
      left: {
        ...fresh.paddles.left,
        driven: s.paddles.left.driven,
        drivenVy: s.paddles.left.drivenVy,
      },
      right: {
        ...fresh.paddles.right,
        driven: s.paddles.right.driven,
        drivenVy: s.paddles.right.drivenVy,
      },
    },
  };
}
export function items(screen: Screen): readonly string[] {
  return screen === "title"
    ? C.TITLE_ITEMS
    : screen === "paused"
      ? C.PAUSE_ITEMS
      : screen === "matchover"
        ? C.MATCHOVER_ITEMS
        : screen === "howto"
          ? ["BACK TO MENU"]
          : [];
}
export function menuItemRect(s: State, index: number) {
  if (index < 0 || index >= items(s.screen).length || !Number.isInteger(index))
    return null;
  return {
    x: s.screen === "title" ? 100 : 440,
    y:
      (s.screen === "title" ? 390 : s.screen === "howto" ? 590 : 365) +
      index * 66,
    w: 400,
    h: 54,
  };
}
function ballPatch(s: State, patch: Partial<BallState>): CaromState {
  if (!s.ball) throw new Error("No ball on field");
  return { ...s, ball: { ...s.ball, ...patch } };
}
function paddlePatch(
  s: State,
  side: Side,
  patch: Partial<PaddleState>,
): CaromState {
  return {
    ...s,
    paddles: { ...s.paddles, [side]: { ...s.paddles[side], ...patch } },
  };
}
export function createDebug() {
  return {
    version: C.CAROM_DEBUG_VERSION,
    clearWorld: (s: State): CaromState => ({ ...s, ball: null, obstacles: [] }),
    spawnBall: (s: State): CaromState => ({ ...s, ball: parked() }),
    spawnObstacle: (s: State, index: number): CaromState => ({
      ...s,
      obstacles: [
        ...s.obstacles.filter((o) => o.index !== index),
        obstacle(index, s.obstacleClock),
      ].sort((a, b) => a.index - b.index),
    }),
    reset: (s: State) => initialState(s.muted),
    reconcile: (s: State): CaromState => ({
      ...s,
      obstacles: s.obstacles.map((o) => obstacle(o.index, s.obstacleClock)),
    }),
    setScreen: (s: State, screen: Screen): CaromState => ({ ...s, screen }),
    setMode: (s: State, mode: Mode): CaromState => ({ ...s, mode }),
    setMenuIndex: (s: State, menuIndex: number): CaromState => ({
      ...s,
      menuIndex,
    }),
    setTitleIndex: (s: State, titleIndex: number): CaromState => ({
      ...s,
      titleIndex,
    }),
    setResumeScreen: (
      s: State,
      resumeScreen: "countdown" | "playing",
    ): CaromState => ({ ...s, resumeScreen }),
    setScore: (s: State, p1: number, p2: number): CaromState => ({
      ...s,
      score: { p1, p2 },
    }),
    setWinner: (s: State, winner: Side | null): CaromState => ({
      ...s,
      winner,
    }),
    setReceiver: (s: State, receiver: Side): CaromState => ({ ...s, receiver }),
    setPaddleCy: (s: State, side: Side, cy: number) =>
      paddlePatch(s, side, { cy }),
    setPaddleVy: (s: State, side: Side, drivenVy: number) =>
      paddlePatch(s, side, { drivenVy }),
    setPaddleDriven: (s: State, side: Side, driven: boolean) =>
      paddlePatch(s, side, { driven }),
    setBallPosition: (s: State, x: number, y: number) => ballPatch(s, { x, y }),
    setBallVelocity: (s: State, vx: number, vy: number) =>
      ballPatch(s, { vx, vy }),
    setBallSpin: (s: State, spin: number) => ballPatch(s, { spin }),
    setBallHeld: (s: State, held: boolean) => ballPatch(s, { held }),
    setBallHoldTimer: (s: State, holdTimer: number) =>
      ballPatch(s, { holdTimer }),
    setBallServeSign: (s: State, serveSign: 1 | -1) =>
      ballPatch(s, { serveSign }),
    drawBallServeSign: (s: State) => ballPatch(s, { serveSign: sign() }),
    setAiTracking: (s: State, tracking: boolean): CaromState => ({
      ...s,
      ai: { ...s.ai, tracking },
    }),
    setAiMovement: (s: State, movement: boolean): CaromState => ({
      ...s,
      ai: { ...s.ai, movement },
    }),
    setMuted: (s: State, muted: boolean): CaromState => ({ ...s, muted }),
    setObstacleClock: (s: State, obstacleClock: number): CaromState => ({
      ...s,
      obstacleClock,
      obstacles: s.obstacles.map((o) => obstacle(o.index, obstacleClock)),
    }),
    setObstacleClockRunning: (
      s: State,
      obstacleClockRunning: boolean,
    ): CaromState => ({ ...s, obstacleClockRunning }),
    menuItemRect,
    snapshot: (s: State) => ({
      ...declared(s),
      version: C.CAROM_DEBUG_VERSION,
      ball: s.ball
        ? {
            ...structuredClone(s.ball),
            speed: Math.hypot(s.ball.vx, s.ball.vy),
          }
        : null,
    }),
  };
}

function declared(s: State) {
  const { menuPress: _press, ...rest } = structuredClone(s);
  return rest;
}
