import { useEffect, useEffectEvent, useRef } from "react";

const INITIAL_COLUMNS = 12;
const INITIAL_ROWS = 12;
const BASE_CELL_SIZE = 18;
const TICK_MS = 120;

type Direction = "up" | "down" | "left" | "right";
type Point = {
  x: number;
  y: number;
};

const DIRECTION_VECTORS: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPPOSITE_DIRECTIONS: Record<Direction, Direction> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

export function LoginSnakeGame({
  audioContextRef,
  onExit,
}: {
  audioContextRef: { current: AudioContext | null };
  onExit: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const snakeRef = useRef<Point[]>([]);
  const foodRef = useRef<Point>({ x: 0, y: 0 });
  const directionRef = useRef<Direction>("right");
  const pendingDirectionRef = useRef<Direction>("right");
  const timerRef = useRef<number | null>(null);
  const layoutRef = useRef({
    columns: INITIAL_COLUMNS,
    rows: INITIAL_ROWS,
    cell_size: BASE_CELL_SIZE,
    width: INITIAL_COLUMNS * BASE_CELL_SIZE,
    height: INITIAL_ROWS * BASE_CELL_SIZE,
  });

  const stopGameLoop = useEffectEvent(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  });

  const playTone = useEffectEvent((frequency: number, duration_ms: number, type: OscillatorType) => {
    if (typeof window === "undefined" || typeof window.AudioContext !== "function") {
      return;
    }

    const audio_context = audioContextRef.current;
    if (audio_context == null) {
      return;
    }

    if (audio_context.state === "suspended") {
      void audio_context.resume();
    }

    const oscillator = audio_context.createOscillator();
    const gain_node = audio_context.createGain();
    const duration_seconds = duration_ms / 1_000;
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain_node.gain.setValueAtTime(0.0001, audio_context.currentTime);
    gain_node.gain.exponentialRampToValueAtTime(0.18, audio_context.currentTime + 0.01);
    gain_node.gain.exponentialRampToValueAtTime(0.0001, audio_context.currentTime + duration_seconds);
    oscillator.connect(gain_node);
    gain_node.connect(audio_context.destination);
    oscillator.start();
    oscillator.stop(audio_context.currentTime + duration_seconds);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain_node.disconnect();
    };
  });

  const getColors = useEffectEvent(() => {
    if (typeof window === "undefined") {
      return { food: "#f97316", snake: "#111111" };
    }

    const document_style = getComputedStyle(document.documentElement);
    const snake =
      document_style.getPropertyValue("--color-text-foreground").trim() ||
      document_style.getPropertyValue("--app-shell-text").trim() ||
      "#111111";
    const food =
      document_style.getPropertyValue("--vscode-charts-red").trim() ||
      document_style.getPropertyValue("--color-text-accent").trim() ||
      "#f97316";
    return { food, snake };
  });

  const getContext = useEffectEvent(() => {
    const canvas = canvasRef.current;
    if (canvas == null) {
      return null;
    }

    const { height, width } = layoutRef.current;
    const device_pixel_ratio = Math.max(1, window.devicePixelRatio || 1);
    const pixel_width = Math.max(1, Math.floor(width * device_pixel_ratio));
    const pixel_height = Math.max(1, Math.floor(height * device_pixel_ratio));
    if (canvas.width !== pixel_width || canvas.height !== pixel_height) {
      canvas.width = pixel_width;
      canvas.height = pixel_height;
    }

    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const context = canvas.getContext("2d");
    if (context == null) {
      return null;
    }

    context.setTransform(device_pixel_ratio, 0, 0, device_pixel_ratio, 0, 0);
    context.imageSmoothingEnabled = false;
    return context;
  });

  const spawnFood = useEffectEvent((snake: Point[]) => {
    const { columns, rows } = layoutRef.current;
    const occupied = new Set(snake.map((segment) => `${segment.x}:${segment.y}`));
    const available: Point[] = [];
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const key = `${column}:${row}`;
        if (!occupied.has(key)) {
          available.push({ x: column, y: row });
        }
      }
    }

    return available[Math.floor(Math.random() * available.length)] ?? { x: 0, y: 0 };
  });

  const drawGame = useEffectEvent(() => {
    const context = getContext();
    if (context == null) {
      return;
    }

    const { food, snake } = getColors();
    const { cell_size, height, width } = layoutRef.current;
    context.clearRect(0, 0, width, height);
    context.fillStyle = snake;
    for (const segment of snakeRef.current) {
      context.fillRect(segment.x * cell_size, segment.y * cell_size, cell_size, cell_size);
    }
    context.fillStyle = food;
    context.fillRect(foodRef.current.x * cell_size, foodRef.current.y * cell_size, cell_size, cell_size);
  });

  const resetGame = useEffectEvent(() => {
    const { columns, rows } = layoutRef.current;
    const center_x = Math.floor(columns / 2);
    const center_y = Math.floor(rows / 2);
    snakeRef.current = [
      { x: center_x, y: center_y },
      { x: center_x - 1, y: center_y },
      { x: center_x - 2, y: center_y },
    ];
    directionRef.current = "right";
    pendingDirectionRef.current = "right";
    foodRef.current = spawnFood(snakeRef.current);
    drawGame();
  });

  const measureLayout = useEffectEvent(() => {
    const host = hostRef.current;
    if (host == null) {
      return;
    }

    const rect = host.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    const columns = Math.max(INITIAL_COLUMNS, Math.floor(width / BASE_CELL_SIZE));
    const cell_size = width / columns;
    const rows = Math.max(INITIAL_ROWS, Math.floor(height / cell_size));
    layoutRef.current = {
      columns,
      rows,
      cell_size,
      width,
      height,
    };
    resetGame();
  });

  const handleTick = useEffectEvent(() => {
    const snake = snakeRef.current;
    const head = snake[0];
    const next_direction = pendingDirectionRef.current;
    const vector = DIRECTION_VECTORS[next_direction];
    const next_head = {
      x: head.x + vector.x,
      y: head.y + vector.y,
    };
    const { columns, rows } = layoutRef.current;
    const is_eating = next_head.x === foodRef.current.x && next_head.y === foodRef.current.y;
    const collision_body = is_eating ? snake : snake.slice(0, -1);
    const hit_boundary =
      next_head.x < 0 || next_head.y < 0 || next_head.x >= columns || next_head.y >= rows;
    const hit_body = collision_body.some((segment) => segment.x === next_head.x && segment.y === next_head.y);
    if (hit_boundary || hit_body) {
      stopGameLoop();
      playTone(160, 220, "sawtooth");
      onExit();
      return;
    }

    const next_snake = is_eating ? [next_head, ...snake] : [next_head, ...snake.slice(0, -1)];
    snakeRef.current = next_snake;
    directionRef.current = next_direction;
    if (is_eating) {
      foodRef.current = spawnFood(next_snake);
      playTone(660, 120, "square");
    }
    drawGame();
  });

  useEffect(() => {
    measureLayout();
    const handleResize = () => {
      measureLayout();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      let next_direction: Direction | null = null;
      if (event.key === "ArrowUp" || event.key === "w" || event.key === "W") {
        next_direction = "up";
      } else if (event.key === "ArrowDown" || event.key === "s" || event.key === "S") {
        next_direction = "down";
      } else if (event.key === "ArrowLeft" || event.key === "a" || event.key === "A") {
        next_direction = "left";
      } else if (event.key === "ArrowRight" || event.key === "d" || event.key === "D") {
        next_direction = "right";
      }

      if (next_direction == null) {
        return;
      }

      event.preventDefault();
      if (OPPOSITE_DIRECTIONS[directionRef.current] !== next_direction) {
        pendingDirectionRef.current = next_direction;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleResize);
    timerRef.current = window.setInterval(() => {
      handleTick();
    }, TICK_MS);

    return () => {
      stopGameLoop();
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleResize);
      audioContextRef.current?.close().catch(() => undefined);
      audioContextRef.current = null;
    };
  }, [handleTick, measureLayout, stopGameLoop]);

  return (
    <div className="flex h-full w-full items-center justify-center overflow-hidden bg-token-main-surface-primary text-token-foreground">
      <div ref={hostRef} className="h-full w-full">
        <canvas ref={canvasRef} className="h-full w-full text-token-foreground" />
      </div>
    </div>
  );
}
