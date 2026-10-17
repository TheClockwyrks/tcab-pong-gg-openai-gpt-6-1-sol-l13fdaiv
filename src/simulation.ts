import type { UpdateApi } from "@clockwyrks/simple-2d";
import type { CaromState, PaddleState, Side } from "./game";
import * as C from "./constants";
import {
  type State,
  clamp,
  start,
  title,
  items,
  menuItemRect,
  parked,
  obstacle,
} from "./world";
import { fly } from "./physics";

function confirm(s: State): CaromState {
  if (s.screen === "title") {
    const next = { ...s, titleIndex: s.menuIndex };
    return s.menuIndex === 2
      ? { ...next, screen: "howto", menuIndex: 0 }
      : start(next, s.menuIndex === 0 ? "solo" : "versus");
  }
  if (s.screen === "howto") return title(s);
  if (s.screen === "paused")
    return s.menuIndex === 0
      ? { ...s, screen: s.resumeScreen }
      : s.menuIndex === 1
        ? start(s, s.mode)
        : title(s);
  if (s.screen === "matchover")
    return s.menuIndex === 0 ? start(s, s.mode) : title(s);
  return s;
}
function move(p: PaddleState, vy: number, dt: number): PaddleState {
  const raw = p.cy + vy * dt,
    cy = clamp(raw, C.PADDLE_MIN_CY, C.PADDLE_MAX_CY);
  return { ...p, cy, vy: raw !== cy && dt > 0 ? (cy - p.cy) / dt : vy };
}
export function update(state: State, api: UpdateApi, dt: number): CaromState {
  const edge = Object.fromEntries(
    C.ACTIONS.map((a) => [a, api.input.pressed(a)]),
  );
  const held = Object.fromEntries(
    C.ACTIONS.map((a) => [a, api.input.value(a) > 0]),
  );
  const samples = api.input.pointerSamples();
  api.input.pointer();
  api.input.pointerContacts();
  let s: CaromState = { ...state, simTime: state.simTime + dt };
  // Poses change the same bit as the action; synchronization happens before any cues.
  api.audio.setMuted(edge.mute ? !s.muted : s.muted);
  s = { ...s, muted: api.audio.muted() };
  const screen = state.screen;
  let keyboardConfirmed = false;
  if ((screen === "playing" || screen === "countdown") && edge.pause)
    s = { ...s, resumeScreen: screen, screen: "paused", menuIndex: 0 };
  else if (screen === "paused" && (edge.pause || edge.back))
    s = { ...s, screen: s.resumeScreen };
  else if ((screen === "howto" || screen === "matchover") && edge.back)
    s = title(s);
  else if (items(screen).length) {
    const count = items(screen).length;
    if (edge["p1-up"] || edge["p2-up"])
      s = { ...s, menuIndex: (s.menuIndex + count - 1) % count };
    else if (edge["p1-down"] || edge["p2-down"])
      s = { ...s, menuIndex: (s.menuIndex + 1) % count };
    else if (edge.confirm) {
      s = confirm(s);
      keyboardConfirmed = true;
    }
    const presses = { ...state.menuPress };
    for (const sample of samples) {
      let hit = -1;
      for (let i = 0; i < count; i++) {
        const r = menuItemRect(state, i)!;
        if (
          sample.x >= r.x &&
          sample.x <= r.x + r.w &&
          sample.y >= r.y &&
          sample.y <= r.y + r.h
        )
          hit = i;
      }
      if (!keyboardConfirmed && s.screen === screen && hit >= 0)
        s = { ...s, menuIndex: hit };
      if (sample.type === "down" && sample.button === "primary")
        presses[sample.id] = hit;
      if (sample.type === "up") {
        if (
          !keyboardConfirmed &&
          s.screen === screen &&
          hit >= 0 &&
          presses[sample.id] === hit
        ) {
          s = confirm({ ...s, menuIndex: hit });
          keyboardConfirmed = true;
        }
        delete presses[sample.id];
      }
    }
    s = { ...s, menuPress: s.screen === screen ? presses : {} };
  }
  if (s.screen !== "countdown" && s.screen !== "playing") return s;
  const p1up = held["p1-up"] || (s.mode === "solo" && held["p2-up"]);
  const p1down = held["p1-down"] || (s.mode === "solo" && held["p2-down"]);
  const velocities: { left: number; right: number } = {
    left: (Number(p1down) - Number(p1up)) * C.PADDLE_SPEED,
    right: (Number(held["p2-down"]) - Number(held["p2-up"])) * C.PADDLE_SPEED,
  };
  if (s.mode === "solo") {
    let target = C.AI_HOME_Y,
      deadzone = C.AI_HOME_DEADZONE;
    if (s.ai.tracking && s.screen === "playing" && s.ball && s.ball.vx > 0) {
      target = s.ball.y - s.ball.vy * C.AI_REACT;
      deadzone = C.AI_DEADZONE;
    }
    const diff = target - s.paddles.right.cy;
    velocities.right =
      !s.ai.movement || Math.abs(diff) <= deadzone
        ? 0
        : Math.sign(diff) *
          Math.min(C.AI_SPEED, dt > 0 ? Math.abs(diff) / dt : 0);
  }
  let paddles = s.paddles;
  for (const side of ["left", "right"] as const) {
    const p = paddles[side];
    paddles = {
      ...paddles,
      [side]: move(p, p.driven ? p.drivenVy : velocities[side], dt),
    };
  }
  s = { ...s, paddles };
  const events = new Set<string>();
  let ball = s.ball;
  if (ball) {
    if (s.screen === "countdown") {
      const timer = ball.holdTimer - dt;
      ball = { ...ball, holdTimer: Math.max(0, timer) };
      if (timer <= 0) {
        ball = {
          ...ball,
          held: false,
          trail: [],
          vx:
            (s.receiver === "left" ? -1 : 1) *
            C.SERVE_SPEED *
            Math.cos(C.SERVE_ANGLE),
          vy: ball.serveSign * C.SERVE_SPEED * Math.sin(C.SERVE_ANGLE),
        };
        s = { ...s, screen: "playing" };
      }
    } else if (!ball.held) ball = fly(ball, paddles, s.obstacles, dt, events);
    ball = {
      ...ball,
      trail: [
        ...ball.trail.filter((p) => s.simTime - p.t <= C.TRAIL_TIME),
        { x: ball.x, y: ball.y, t: s.simTime },
      ],
    };
  }
  const clock = s.obstacleClock + (s.obstacleClockRunning ? dt : 0);
  s = {
    ...s,
    ball,
    obstacleClock: clock,
    obstacles: s.obstacles.map((o) => obstacle(o.index, clock)),
  };
  if (
    ball &&
    s.screen === "playing" &&
    (ball.x - C.BALL_R > C.FIELD_W || ball.x + C.BALL_R < 0)
  ) {
    const scorer: Side = ball.x > C.FIELD_W ? "left" : "right";
    const score = {
      p1: s.score.p1 + Number(scorer === "left"),
      p2: s.score.p2 + Number(scorer === "right"),
    };
    const win =
      (score.p1 >= C.WIN_SCORE && score.p1 - score.p2 >= C.WIN_LEAD) ||
      (score.p2 >= C.WIN_SCORE && score.p2 - score.p1 >= C.WIN_LEAD);
    s = win
      ? { ...s, score, winner: scorer, screen: "matchover", menuIndex: 0 }
      : {
          ...s,
          score,
          receiver: scorer === "left" ? "right" : "left",
          ball: parked(),
          screen: "countdown",
        };
    events.add(C.CUES.score);
  }
  for (const event of events) api.audio.play(event);
  return s;
}
