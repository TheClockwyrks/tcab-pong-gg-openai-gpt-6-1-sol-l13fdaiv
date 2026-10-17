import { afterEach, describe, expect, it } from "vitest";
import { createCanvas } from "@napi-rs/canvas";
import { createEngine, ConstantClock } from "@clockwyrks/simple-2d";
import { game, BACKGROUND } from "./game";
import * as C from "./constants";

async function setup(ms = 8) {
  const events = new EventTarget();
  const canvas = createCanvas(C.FIELD_W, C.FIELD_H);
  const e = createEngine({
    canvas: canvas as unknown as HTMLCanvasElement,
    width: C.FIELD_W,
    height: C.FIELD_H,
    layout: C.LAYOUT,
    background: BACKGROUND,
    game,
    clock: new ConstantClock(ms),
    surface: {
      cssWidth: () => C.FIELD_W,
      cssHeight: () => C.FIELD_H,
      dpr: () => 1,
      events: () => events,
    },
  });
  await e.initialize();
  const key = (code: string, type = "keydown") =>
    events.dispatchEvent(
      Object.assign(new Event(type), { code, repeat: false }),
    );
  const press = async (code: string) => {
    key(code);
    await e.advance(1);
    key(code, "keyup");
  };
  const pointer = (
    type: string,
    x: number,
    y: number,
    id = 1,
    device = "mouse",
  ) =>
    events.dispatchEvent(
      Object.assign(new Event(type), {
        clientX: x,
        clientY: y,
        pointerId: id,
        pointerType: device,
        isPrimary: true,
        button: 0,
        buttons: type === "pointerup" ? 0 : 1,
      }),
    );
  instances.push(e);
  return { e, d: e.debug, key, press, pointer };
}
const instances: ReturnType<typeof createEngine>[] = [];
afterEach(() => {
  for (const e of instances) e.destroy();
  instances.length = 0;
});
async function arena(ms = 8) {
  const a = await setup(ms);
  const { e, d } = a;
  e.apply((s) => d.clearWorld(s));
  e.apply((s) => d.spawnBall(s));
  e.apply((s) => d.setScreen(s, "playing"));
  e.apply((s) => d.setMode(s, "versus"));
  e.apply((s) => d.setBallHeld(s, false));
  return a;
}
describe("screens and input", () => {
  it("initializes the complete title and diagnostic registry", async () => {
    const { e, d } = await setup();
    expect(d.snapshot(e.state)).toMatchObject({
      version: C.CAROM_DEBUG_VERSION,
      screen: "title",
      ball: { held: true, speed: 0 },
      ai: { tracking: true, movement: true },
    });
    expect(e.diagnostics().length).toBeGreaterThanOrEqual(8);
    expect(d.menuItemRect(e.state, 3)).toBeNull();
    await e.advance(1);
  });
  it("navigates, remembers title selection, and returns from instructions", async () => {
    const { e, press } = await setup();
    await press("KeyW");
    expect(e.state.menuIndex).toBe(2);
    await press("Enter");
    expect(e.state.screen).toBe("howto");
    await press("Escape");
    expect(e.state.menuIndex).toBe(2);
    await press("KeyW");
    await press("Enter");
    expect(e.state.mode).toBe("versus");
    expect(e.state.screen).toBe("countdown");
  });
  it("serves on expiry without flight, then moves; pauses and resumes once per Escape", async () => {
    const { e, d, press } = await setup();
    await press("Enter");
    e.apply((s) => d.setBallHoldTimer(s, 0));
    await e.advance(1);
    expect(e.state.ball?.x).toBe(C.FIELD_CX);
    expect(e.state.screen).toBe("playing");
    expect(e.state.ball?.vx).toBeLessThan(0);
    await e.advance(1);
    expect(e.state.ball!.x).toBeLessThan(C.FIELD_CX);
    await press("Escape");
    const frozen = e.state;
    await e.advance(6);
    expect(e.state.obstacleClock).toBe(frozen.obstacleClock);
    expect(e.state.ball).toEqual(frozen.ball);
    expect(e.state.simTime).toBeGreaterThan(frozen.simTime);
    await press("Escape");
    expect(e.state.screen).toBe("playing");
  });
  it("gives movement precedence over confirm and up over down", async () => {
    const { e, key } = await setup();
    key("KeyW");
    key("ArrowDown");
    key("Enter");
    await e.advance(1);
    expect(e.state.screen).toBe("title");
    expect(e.state.menuIndex).toBe(2);
  });
  it("accepts mouse and touch gestures, but not mismatched edges", async () => {
    const { e, d, pointer } = await setup();
    const a = d.menuItemRect(e.state, 0)!,
      b = d.menuItemRect(e.state, 1)!;
    pointer("pointerdown", a.x + 20, a.y + 20);
    await e.advance(1);
    pointer("pointerup", b.x + 20, b.y + 20);
    await e.advance(1);
    expect(e.state.screen).toBe("title");
    pointer("pointerdown", b.x + 20, b.y + 20, 2, "touch");
    pointer("pointerup", b.x + 20, b.y + 20, 2, "touch");
    await e.advance(1);
    expect(e.state.mode).toBe("versus");
    expect(e.state.screen).toBe("countdown");
  });
  it("restarts and quits through the pause menu; mutes on any screen", async () => {
    const { e, press } = await setup();
    await press("KeyM");
    expect(e.state.muted).toBe(true);
    await press("Enter");
    await press("KeyP");
    await press("KeyS");
    await press("Enter");
    expect(e.state.screen).toBe("countdown");
    await press("KeyP");
    await press("KeyW");
    await press("Enter");
    expect(e.state.screen).toBe("title");
    expect(e.state.muted).toBe(true);
  });
});
describe("simulation", () => {
  it("moves both countdown paddles and clamps actual velocity", async () => {
    const { e, d, key } = await setup(10);
    await e.advance(1);
    e.apply((s) => d.setScreen(s, "countdown"));
    e.apply((s) => d.setMode(s, "versus"));
    e.apply((s) => d.setPaddleCy(s, "left", C.PADDLE_MIN_CY));
    key("KeyW");
    key("ArrowDown");
    await e.advance(1);
    expect(e.state.paddles.left.vy).toBe(0);
    expect(e.state.paddles.right.vy).toBe(C.PADDLE_SPEED);
  });
  it("drives a paddle independently and preserves its requested velocity", async () => {
    const { e, d } = await arena();
    e.apply((s) => d.setPaddleVy(s, "left", -C.PADDLE_SPEED));
    e.apply((s) => d.setPaddleDriven(s, "left", true));
    e.apply((s) => d.setPaddleCy(s, "left", C.PADDLE_MIN_CY));
    await e.advance(2);
    expect(e.state.paddles.left.vy).toBe(0);
    expect(e.state.paddles.left.drivenVy).toBe(-C.PADDLE_SPEED);
  });
  it("bounces walls without speed loss and emits at most one cue per frame", async () => {
    const { e, d } = await arena();
    const cues: string[] = [];
    e.events.on("cue:played", (v) => cues.push(v.cue));
    e.apply((s) => d.setBallPosition(s, 400, 12));
    e.apply((s) => d.setBallVelocity(s, 0, -700));
    await e.advance(1);
    expect(e.state.ball!.vy).toBe(700);
    expect(cues).toEqual([C.CUES.wallBounce]);
  });
  it("adds speed and spin on moving paddle contact", async () => {
    const { e, d } = await arena();
    e.apply((s) => d.setPaddleDriven(s, "left", true));
    e.apply((s) => d.setPaddleVy(s, "left", 400));
    e.apply((s) => d.setBallPosition(s, C.P1_X1 + C.BALL_R + 1, C.FIELD_CY));
    e.apply((s) => d.setBallVelocity(s, -500, 0));
    await e.advance(1);
    expect(e.state.ball!.vx).toBeGreaterThan(0);
    expect(d.snapshot(e.state).ball!.speed).toBeCloseTo(520);
    expect(e.state.ball!.spin).toBeGreaterThan(300);
  });
  it("reflects end caps without boosting speed", async () => {
    const { e, d } = await arena();
    e.apply((s) =>
      d.setBallPosition(
        s,
        C.P1_X0 + 8,
        C.FIELD_CY - C.PADDLE_HALF - C.BALL_R - 1,
      ),
    );
    e.apply((s) => d.setBallVelocity(s, 0, 500));
    await e.advance(1);
    expect(e.state.ball!.vy).toBe(-500);
  });
  it.each([0, 0.7, 1.5])(
    "reflects oriented obstacle faces at t=%s",
    async (t) => {
      const { e, d } = await arena();
      e.apply((s) => d.spawnObstacle(s, 0));
      e.apply((s) => d.setObstacleClock(s, t));
      e.apply((s) => d.setObstacleClockRunning(s, false));
      const o = e.state.obstacles[0],
        nx = Math.cos(o.theta),
        ny = Math.sin(o.theta);
      e.apply((s) =>
        d.setBallPosition(
          s,
          o.cx + nx * (C.OBSTACLE_HW + C.BALL_R + 1),
          o.cy + ny * (C.OBSTACLE_HW + C.BALL_R + 1),
        ),
      );
      e.apply((s) => d.setBallVelocity(s, -500 * nx, -500 * ny));
      await e.advance(1);
      expect(e.state.ball!.vx * nx + e.state.ball!.vy * ny).toBeGreaterThan(0);
      expect(d.snapshot(e.state).ball!.speed).toBeCloseTo(500);
    },
  );
  it("turns velocity and decays spin independently of step size", async () => {
    const results = [];
    for (const ms of [2, 16]) {
      const { e, d } = await arena(ms);
      e.apply((s) => d.setBallPosition(s, 300, 300));
      e.apply((s) => d.setBallVelocity(s, 520, 0));
      e.apply((s) => d.setBallSpin(s, 600));
      await e.advance(400 / ms);
      results.push(d.snapshot(e.state).ball!);
    }
    expect(results[0].spin).toBeCloseTo(results[1].spin, 6);
    expect(results[0].vx).toBeCloseTo(results[1].vx, 0);
    expect(Math.abs(results[0].vy - results[1].vy)).toBeLessThan(2);
  });
  it("scores, parks toward the receiver and wins only by two", async () => {
    const { e, d } = await arena();
    e.apply((s) => d.setScore(s, 10, 10));
    const point = async () => {
      e.apply((s) => d.setScreen(s, "playing"));
      e.apply((s) => d.setBallHeld(s, false));
      e.apply((s) => d.setBallPosition(s, C.FIELD_W + C.BALL_R + 1, 100));
      e.apply((s) => d.setBallVelocity(s, 500, 0));
      await e.advance(1);
    };
    await point();
    expect(e.state.score.p1).toBe(11);
    expect(e.state.screen).toBe("countdown");
    expect(e.state.receiver).toBe("right");
    expect(e.state.ball!.trail).toEqual([]);
    await point();
    expect(e.state.screen).toBe("matchover");
    expect(e.state.winner).toBe("left");
    await e.advance(1);
  });
  it("scores the other goal and renders a right-side win", async () => {
    const { e, d, press } = await arena();
    e.apply((s) => d.setScore(s, 0, 10));
    e.apply((s) => d.setBallPosition(s, -C.BALL_R - 1, 100));
    e.apply((s) => d.setBallVelocity(s, -500, 0));
    await e.advance(1);
    expect(e.state.winner).toBe("right");
    await press("Escape");
    expect(e.state.screen).toBe("title");
  });
  it("AI gates tracking and motion independently", async () => {
    const { e, d } = await arena();
    e.apply((s) => d.setMode(s, "solo"));
    e.apply((s) => d.setBallPosition(s, 900, 600));
    e.apply((s) => d.setBallVelocity(s, 500, 0));
    await e.advance(1);
    expect(e.state.paddles.right.vy).toBeGreaterThan(0);
    e.apply((s) => d.setAiTracking(s, false));
    await e.advance(1);
    expect(e.state.paddles.right.vy).toBe(0);
    e.apply((s) => d.setAiMovement(s, false));
    e.apply((s) => d.setPaddleCy(s, "right", 200));
    await e.advance(1);
    expect(e.state.paddles.right.cy).toBe(200);
  });
});
describe("poses and readings", () => {
  it("poses all fields without advancing and fails loudly for absent entities", async () => {
    const { e, d } = await setup();
    const previous = e.state;
    e.apply((s) => d.setMode(s, "versus"));
    e.apply((s) => d.setWinner(s, "right"));
    e.apply((s) => d.setReceiver(s, "right"));
    e.apply((s) => d.setResumeScreen(s, "countdown"));
    e.apply((s) => d.setMenuIndex(s, 1));
    e.apply((s) => d.setTitleIndex(s, 2));
    e.apply((s) => d.setMuted(s, true));
    e.apply((s) => d.setBallServeSign(s, -1));
    e.apply((s) => d.drawBallServeSign(s));
    e.apply((s) => d.setObstacleClock(s, 1));
    const snap = d.snapshot(e.state);
    expect(snap).toMatchObject({
      mode: "versus",
      winner: "right",
      receiver: "right",
      resumeScreen: "countdown",
      menuIndex: 1,
      titleIndex: 2,
      muted: true,
      simTime: 0,
    });
    expect(previous.mode).toBe("solo");
    const reconciled = d.reconcile(e.state);
    expect(d.reconcile(reconciled)).toEqual(reconciled);
    expect(e.state.obstacles[0].theta).toBe(C.OBSTACLE_SPIN_RATE);
    e.apply((s) => d.clearWorld(s));
    expect(() => d.setBallSpin(e.state, 10)).toThrow();
    expect(() => d.spawnObstacle(e.state, 3)).toThrow();
    await e.advance(1);
    e.apply((s) => d.reset(s));
    expect(e.state.muted).toBe(true);
    expect(e.state.simTime).toBe(0);
    expect(e.state.obstacles.length).toBe(2);
  });
  it("records its own drawing and keeps a bounded trail", async () => {
    const { e, d } = await arena();
    e.apply((s) => d.setBallVelocity(s, 500, 100));
    e.startRecording();
    await e.advance(30);
    const recording = e.stopRecording();
    expect(recording.frames.length).toBe(30);
    expect(e.state.ball!.trail.length).toBeLessThan(20);
    expect(e.state.ball!.trail.length).toBeGreaterThan(1);
  });
});
