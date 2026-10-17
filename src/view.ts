import type { RenderApi } from "@clockwyrks/simple-2d";
import * as C from "./constants";
import { type State, items, menuItemRect } from "./world";
export const BACKGROUND = "#101b21";
const ink = "#edf1df",
  muted = "#80969a",
  left = "#c7f279",
  right = "#60d9d0",
  orange = "#ff9268",
  line = "#2b3a3e";
type Context = CanvasRenderingContext2D;
function text(
  ctx: Context,
  copy: string,
  x: number,
  y: number,
  size = 14,
  color = ink,
  weight = 500,
  align: CanvasTextAlign = "left",
) {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px ${size <= 16 ? '"Courier New", monospace' : '"Arial", sans-serif'}`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(copy, x, y);
}
function rule(
  ctx: Context,
  x: number,
  y: number,
  x1: number,
  y1: number,
  color = line,
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}
function bar(
  ctx: Context,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  r = 7,
) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}
function dot(ctx: Context, x: number, y: number, r: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}
function arrow(ctx: Context, x: number, y: number, color = ink) {
  rule(ctx, x - 12, y, x + 12, y, color);
  rule(ctx, x + 5, y - 7, x + 12, y, color);
  rule(ctx, x + 5, y + 7, x + 12, y, color);
}
function furniture(s: State, ctx: Context) {
  // An understated technical grid gives the ball's curved flight a reference plane.
  ctx.strokeStyle = "#17272e";
  ctx.lineWidth = 1;
  for (let x = 80; x < C.FIELD_W; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, C.FIELD_H);
    ctx.stroke();
  }
  for (let y = 40; y < C.FIELD_H; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(C.FIELD_W, y);
    ctx.stroke();
  }
  ctx.setLineDash([5, 13]);
  rule(ctx, C.NET_X, 28, C.NET_X, C.FIELD_H - 28, "#3d4e50");
  ctx.setLineDash([]);
  ctx.strokeStyle = line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(C.FIELD_CX, C.FIELD_CY, 82, 0, Math.PI * 2);
  ctx.stroke();
  rule(ctx, 24, 1, C.FIELD_W - 24, 1, "#5d7274");
  rule(ctx, 24, C.FIELD_H - 1, C.FIELD_W - 24, C.FIELD_H - 1, "#5d7274");
  for (const [side, x, color] of [
    ["left", C.P1_X0, left],
    ["right", C.P2_X0, right],
  ] as const) {
    const p = s.paddles[side];
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
    bar(ctx, x, p.cy - C.PADDLE_HALF, C.PADDLE_W, C.PADDLE_H, color);
    ctx.shadowBlur = 0;
    rule(ctx, x + 5, p.cy - 14, x + 5, p.cy + 14, "#41635a");
  }
  for (const o of s.obstacles) {
    ctx.save();
    ctx.translate(o.cx, o.cy);
    ctx.rotate(o.theta);
    ctx.strokeStyle = "#4c3a32";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, 87, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowColor = orange;
    ctx.shadowBlur = 14;
    bar(
      ctx,
      -C.OBSTACLE_HW,
      -C.OBSTACLE_HH,
      C.OBSTACLE_W,
      C.OBSTACLE_H,
      orange,
    );
    ctx.shadowBlur = 0;
    dot(ctx, 0, 0, 3, "#633b2d");
    ctx.restore();
    text(ctx, `0${o.index + 1}`, o.cx + 26, o.cy - 82, 11, orange);
  }
  const b = s.ball;
  if (b) {
    for (let i = 1; i < b.trail.length; i++) {
      const p = b.trail[i - 1],
        q = b.trail[i];
      const alpha = Math.max(0, 1 - (s.simTime - q.t) / C.TRAIL_TIME);
      ctx.strokeStyle = `rgba(237,241,223,${alpha * 0.5})`;
      ctx.lineWidth = C.BALL_R * 2 * alpha;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(q.x, q.y);
      ctx.stroke();
    }
    ctx.shadowColor = ink;
    ctx.shadowBlur = 22;
    dot(ctx, b.x, b.y, C.BALL_R, ink);
    ctx.shadowBlur = 0;
    if (Math.abs(b.spin) > 30) {
      ctx.strokeStyle = orange;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 19, s.simTime * 5, s.simTime * 5 + Math.PI * 1.3);
      ctx.stroke();
    }
  }
  ctx.lineCap = "butt";
}
function header(ctx: Context, s: State) {
  text(ctx, C.TITLE_TEXT, 32, 35, 19, ink, 800);
  text(
    ctx,
    s.mode === "solo" ? "01 / SOLO DUEL" : "02 / LOCAL VERSUS",
    200,
    36,
    12,
    muted,
  );
  text(
    ctx,
    `M ${s.muted ? "SOUND OFF" : "SOUND ON"}     P PAUSE`,
    C.FIELD_W - 32,
    35,
    12,
    muted,
    500,
    "right",
  );
}
function field(s: State, ctx: Context) {
  furniture(s, ctx);
  header(ctx, s);
  bar(ctx, C.FIELD_CX - 147, 24, 294, 98, BACKGROUND, 16);
  text(
    ctx,
    String(s.score.p1).padStart(2, "0"),
    C.FIELD_CX - 72,
    67,
    62,
    left,
    700,
    "center",
  );
  text(
    ctx,
    String(s.score.p2).padStart(2, "0"),
    C.FIELD_CX + 72,
    67,
    62,
    right,
    700,
    "center",
  );
  text(
    ctx,
    "FIRST TO 11 · WIN BY 2",
    C.FIELD_CX,
    119,
    10,
    muted,
    500,
    "center",
  );
  text(
    ctx,
    s.mode === "solo" ? "YOU / W S OR ↑ ↓" : "PLAYER 01 / W S",
    95,
    681,
    12,
    left,
  );
  text(
    ctx,
    s.mode === "solo" ? "CPU / ADAPTIVE" : "PLAYER 02 / ↑ ↓",
    C.FIELD_W - 95,
    681,
    12,
    right,
    500,
    "right",
  );
  if (s.screen === "countdown") {
    text(
      ctx,
      "READY TO RECEIVE",
      C.FIELD_CX,
      C.FIELD_CY - 68,
      12,
      ink,
      500,
      "center",
    );
    text(
      ctx,
      s.receiver === "left" ? "← PLAYER 01" : "PLAYER 02 →",
      C.FIELD_CX,
      C.FIELD_CY + 66,
      12,
      muted,
      500,
      "center",
    );
    const progress = 1 - (s.ball?.holdTimer ?? C.HOLD_TIME) / C.HOLD_TIME;
    bar(ctx, C.FIELD_CX - 45, C.FIELD_CY + 92, 90, 3, line, 1);
    bar(
      ctx,
      C.FIELD_CX - 45,
      C.FIELD_CY + 92,
      Math.max(1, 90 * progress),
      3,
      left,
      1,
    );
  }
}
function menus(s: State, ctx: Context) {
  items(s.screen).forEach((copy, i) => {
    const r = menuItemRect(s, i)!;
    const selected = s.menuIndex === i;
    if (selected) bar(ctx, r.x, r.y, r.w, r.h, left, 4);
    else {
      ctx.strokeStyle = line;
      ctx.lineWidth = 1;
      ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
    }
    text(
      ctx,
      `0${i + 1}`,
      r.x + 20,
      r.y + r.h / 2,
      12,
      selected ? "#354b2c" : muted,
    );
    text(
      ctx,
      copy,
      r.x + 60,
      r.y + r.h / 2,
      17,
      selected ? BACKGROUND : ink,
      700,
    );
    if (selected) arrow(ctx, r.x + r.w - 29, r.y + r.h / 2, BACKGROUND);
  });
}
function titleScreen(s: State, ctx: Context) {
  text(ctx, "C /", 48, 43, 24, left, 800);
  text(ctx, "THE ANGLE IS EVERYTHING", 106, 44, 12, muted);
  text(
    ctx,
    "A PADDLE DUEL IN MOTION",
    C.FIELD_W - 48,
    44,
    12,
    muted,
    500,
    "right",
  );
  rule(ctx, 48, 77, C.FIELD_W - 48, 77);
  text(ctx, "01 — PRECISION MEETS INSTINCT", 100, 166, 12, left);
  text(ctx, C.TITLE_TEXT, 91, 250, 112, ink, 900);
  text(ctx, "Find your angle.", 100, 325, 24, ink, 500);
  text(ctx, "Put a little spin on it.", 100, 356, 24, muted, 500);
  menus(s, ctx);
  text(ctx, "W S / ↑ ↓  SELECT     ENTER  PLAY", 100, 620, 11, muted);
  // A diagram of a bank shot, not an animated simulation hidden behind the menu.
  ctx.save();
  ctx.translate(616, 136);
  bar(ctx, 0, 0, 574, 476, "#14252b", 18);
  ctx.strokeStyle = "#314448";
  ctx.lineWidth = 1;
  ctx.strokeRect(22, 22, 530, 432);
  ctx.setLineDash([4, 10]);
  rule(ctx, 287, 23, 287, 454, "#314448");
  ctx.setLineDash([]);
  ctx.strokeStyle = "#253b3f";
  ctx.beginPath();
  ctx.arc(287, 238, 69, 0, Math.PI * 2);
  ctx.stroke();
  bar(ctx, 42, 278, 12, 88, left, 6);
  bar(ctx, 520, 111, 12, 88, right, 6);
  for (const [x, y, rotation] of [
    [214, 145, -0.48],
    [364, 322, -0.48],
  ]) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    bar(ctx, -8, -56, 16, 112, orange, 5);
    dot(ctx, 0, 0, 3, "#633b2d");
    ctx.restore();
  }
  ctx.strokeStyle = "#a9c3ad";
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 7]);
  ctx.beginPath();
  ctx.moveTo(59, 320);
  ctx.bezierCurveTo(145, 333, 183, 286, 233, 192);
  ctx.lineTo(404, 42);
  ctx.quadraticCurveTo(443, 100, 477, 158);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = ink;
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(444, 103);
  ctx.quadraticCurveTo(463, 132, 477, 158);
  ctx.stroke();
  ctx.lineCap = "butt";
  ctx.shadowColor = ink;
  ctx.shadowBlur = 22;
  dot(ctx, 477, 158, 10, ink);
  ctx.shadowBlur = 0;
  text(ctx, "↗", 459, 81, 28, left);
  text(ctx, "SPIN", 80, 374, 11, left);
  rule(ctx, 101, 357, 114, 323, left);
  text(ctx, "BANK", 301, 104, 11, orange);
  text(ctx, "01", 206, 69, 10, orange);
  text(ctx, "02", 356, 400, 10, orange);
  text(
    ctx,
    "CHANGE THE FLIGHT. CHANGE THE GAME.",
    287,
    504,
    11,
    muted,
    500,
    "center",
  );
  ctx.restore();
  rule(ctx, 48, 660, C.FIELD_W - 48, 660);
  text(ctx, "SINGLE PLAYER / LOCAL TWO PLAYER", 48, 691, 11, muted);
  text(
    ctx,
    "MOVE. STRIKE. CURVE. REPEAT.",
    C.FIELD_CX,
    691,
    11,
    muted,
    500,
    "center",
  );
  text(
    ctx,
    `M / ${s.muted ? "SOUND OFF" : "SOUND ON"}`,
    C.FIELD_W - 48,
    691,
    11,
    left,
    500,
    "right",
  );
}
function howto(s: State, ctx: Context) {
  text(ctx, "C / THE PLAYBOOK", 64, 54, 18, left, 700);
  rule(ctx, 64, 86, C.FIELD_W - 64, 86);
  text(ctx, "A simple duel. A different angle.", 100, 150, 43, ink, 700);
  const cards = [
    {
      x: 100,
      n: "01",
      title: "OWN YOUR SIDE",
      lines: [
        "SOLO   W / S or ↑ / ↓",
        "VERSUS   P1 W / S · P2 ↑ / ↓",
        "P / ESC pauses · M toggles sound",
      ],
      color: left,
    },
    {
      x: 478,
      n: "02",
      title: "BEND THE BALL",
      lines: [
        "Strike while moving to add spin.",
        "Up curves up. Down curves down.",
        "Hit near an edge for a wider angle.",
      ],
      color: right,
    },
    {
      x: 856,
      n: "03",
      title: "PLAY THE BANK",
      lines: [
        "Orange bars sway and rotate.",
        "Use their faces for a bank shot.",
        "First to 11, with a two-point lead.",
      ],
      color: orange,
    },
  ];
  for (const card of cards) {
    text(ctx, card.n, card.x, 234, 13, card.color);
    rule(ctx, card.x, 260, card.x + 322, 260);
    text(ctx, card.title, card.x, 300, 20, card.color, 700);
    card.lines.forEach((l, i) => text(ctx, l, card.x, 348 + i * 32, 14, ink));
  }
  // Small motion diagrams reinforce the instructions.
  bar(ctx, 148, 465, C.PADDLE_W, 85, left);
  arrow(ctx, 211, 508, left);
  ctx.strokeStyle = right;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(510, 534);
  ctx.quadraticCurveTo(630, 538, 720, 463);
  ctx.stroke();
  dot(ctx, 720, 463, 8, ink);
  ctx.save();
  ctx.translate(1000, 500);
  ctx.rotate(0.5);
  bar(ctx, -10, -50, 20, 100, orange);
  ctx.restore();
  menus(s, ctx);
  text(ctx, "ENTER / ESC TO RETURN", C.FIELD_CX, 676, 11, muted, 500, "center");
}
export function render(s: State, { ctx }: RenderApi): void {
  ctx.save();
  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, C.FIELD_W, C.FIELD_H);
  if (s.screen === "title") titleScreen(s, ctx);
  else if (s.screen === "howto") howto(s, ctx);
  else {
    field(s, ctx);
    if (s.screen === "paused" || s.screen === "matchover") {
      ctx.fillStyle = "rgba(10,20,25,0.86)";
      ctx.fillRect(0, 0, C.FIELD_W, C.FIELD_H);
      text(
        ctx,
        s.screen === "paused" ? "TAKE A BREATHER" : "MATCH COMPLETE",
        C.FIELD_CX,
        207,
        12,
        left,
        500,
        "center",
      );
      text(
        ctx,
        s.screen === "paused"
          ? "Paused."
          : s.winner === "left"
            ? "Player 01 wins."
            : s.mode === "solo"
              ? "The house wins."
              : "Player 02 wins.",
        C.FIELD_CX,
        273,
        54,
        ink,
        800,
        "center",
      );
      text(
        ctx,
        s.screen === "paused"
          ? "Your next angle can wait."
          : `${s.score.p1} — ${s.score.p2}  /  ${s.mode.toUpperCase()}`,
        C.FIELD_CX,
        326,
        15,
        muted,
        500,
        "center",
      );
      menus(s, ctx);
      text(
        ctx,
        "W S / ↑ ↓  SELECT     ENTER  CONFIRM",
        C.FIELD_CX,
        627,
        11,
        muted,
        500,
        "center",
      );
    }
  }
  ctx.restore();
}
