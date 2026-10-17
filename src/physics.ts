import type { BallState, PaddleState, ObstacleState } from "./game";
import type { DeepReadonly } from "ts-essentials";
import * as C from "./constants";
import { clamp } from "./world";
type MovingBall = { -readonly [K in keyof BallState]: BallState[K] };
/** Collision work is local to a frame; the caller's ball is never mutated. */
export function fly(
  ball: DeepReadonly<BallState>,
  paddles: DeepReadonly<{ left: PaddleState; right: PaddleState }>,
  obstacles: readonly ObstacleState[],
  dt: number,
  events: Set<string>,
): BallState {
  const b: MovingBall = { ...ball };
  const n = Math.max(
    1,
    Math.ceil((Math.hypot(b.vx, b.vy) * dt) / C.MAX_SUBSTEP),
  );
  const h = dt / n;
  for (let i = 0; i < n; i++) {
    const speed = Math.hypot(b.vx, b.vy);
    const a = speed > 0 ? (b.spin / speed) * h : 0;
    const vx = b.vx * Math.cos(a) - b.vy * Math.sin(a);
    b.vy = b.vx * Math.sin(a) + b.vy * Math.cos(a);
    b.vx = vx;
    b.spin *= Math.pow(0.5, h / C.SPIN_HALFLIFE);
    b.x += b.vx * h;
    b.y += b.vy * h;
    if (b.y - C.BALL_R < 0 && b.vy < 0) {
      b.y = C.BALL_R;
      b.vy = -b.vy;
      events.add(C.CUES.wallBounce);
    } else if (b.y + C.BALL_R > C.FIELD_H && b.vy > 0) {
      b.y = C.FIELD_H - C.BALL_R;
      b.vy = -b.vy;
      events.add(C.CUES.wallBounce);
    }
    paddle(b, paddles.left, C.P1_X0, C.P1_X1, 1, events);
    paddle(b, paddles.right, C.P2_X0, C.P2_X1, -1, events);
    for (const o of obstacles) oriented(b, o, events);
  }
  return b;
}
function paddle(
  b: MovingBall,
  p: DeepReadonly<PaddleState>,
  x0: number,
  x1: number,
  dir: number,
  events: Set<string>,
) {
  const y0 = p.cy - C.PADDLE_HALF,
    y1 = p.cy + C.PADDLE_HALF,
    r = C.BALL_R;
  if (b.x <= x0 - r || b.x >= x1 + r || b.y <= y0 - r || b.y >= y1 + r) return;
  const depths = [b.x - (x0 - r), x1 + r - b.x, b.y - (y0 - r), y1 + r - b.y];
  const face = depths.indexOf(Math.min(...depths));
  if (face < 2) {
    const a = clamp((b.y - p.cy) / C.PADDLE_HALF, -1, 1) * C.MAX_BOUNCE_ANGLE;
    const speed = Math.min(Math.hypot(b.vx, b.vy) * C.SPEED_MULT, C.SPEED_CAP);
    b.vx = dir * speed * Math.cos(a);
    b.vy = speed * Math.sin(a);
    b.spin = clamp(
      b.spin + p.vy * C.SPIN_FROM_PADDLE,
      -C.SPIN_CLAMP,
      C.SPIN_CLAMP,
    );
    b.x = dir === 1 ? C.P1_X1 + r : C.P2_X0 - r;
    events.add(C.CUES.paddleHit);
  } else {
    b.y = face === 2 ? y0 - r : y1 + r;
    if ((face === 2 && b.vy > 0) || (face === 3 && b.vy < 0)) {
      b.vy = -b.vy;
      events.add(C.CUES.wallBounce);
    }
  }
}
function oriented(b: MovingBall, o: ObstacleState, events: Set<string>) {
  const c = Math.cos(o.theta),
    s = Math.sin(o.theta);
  const dx = b.x - o.cx,
    dy = b.y - o.cy;
  const lx = dx * c + dy * s,
    ly = -dx * s + dy * c;
  const qx = clamp(lx, -C.OBSTACLE_HW, C.OBSTACLE_HW),
    qy = clamp(ly, -C.OBSTACLE_HH, C.OBSTACLE_HH);
  const dist = Math.hypot(lx - qx, ly - qy);
  if (dist >= C.BALL_R) return;
  let nx: number, ny: number, push: number;
  if (dist > 0) {
    nx = (lx - qx) / dist;
    ny = (ly - qy) / dist;
    push = C.BALL_R - dist;
  } else if (C.OBSTACLE_HW - Math.abs(lx) <= C.OBSTACLE_HH - Math.abs(ly)) {
    nx = lx < 0 ? -1 : 1;
    ny = 0;
    push = C.BALL_R + C.OBSTACLE_HW - Math.abs(lx);
  } else {
    nx = 0;
    ny = ly < 0 ? -1 : 1;
    push = C.BALL_R + C.OBSTACLE_HH - Math.abs(ly);
  }
  const wx = nx * c - ny * s,
    wy = nx * s + ny * c;
  const dot = b.vx * wx + b.vy * wy;
  if (dot < 0) {
    b.vx -= 2 * dot * wx;
    b.vy -= 2 * dot * wy;
    events.add(C.CUES.obstacleBounce);
  }
  b.x += wx * push;
  b.y += wy * push;
}
