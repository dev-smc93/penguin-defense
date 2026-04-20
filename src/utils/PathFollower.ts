import { MapConfig } from '../data/MapData';

export interface PathPoint {
  x: number;
  y: number;
}

export function buildPixelPath(map: MapConfig, offsetX: number, offsetY: number): PathPoint[] {
  const points: PathPoint[] = [];
  const half = map.tileSize / 2;

  for (const [col, row] of map.path) {
    points.push({
      x: offsetX + col * map.tileSize + half,
      y: offsetY + row * map.tileSize + half,
    });
  }

  return points;
}

export function getPositionOnPath(
  path: PathPoint[],
  distance: number,
): { x: number; y: number; angle: number; finished: boolean } {
  let remaining = distance;

  for (let i = 0; i < path.length - 1; i++) {
    const dx = path[i + 1].x - path[i].x;
    const dy = path[i + 1].y - path[i].y;
    const segLen = Math.sqrt(dx * dx + dy * dy);

    if (remaining <= segLen) {
      const t = remaining / segLen;
      return {
        x: path[i].x + dx * t,
        y: path[i].y + dy * t,
        angle: Math.atan2(dy, dx),
        finished: false,
      };
    }

    remaining -= segLen;
  }

  const last = path[path.length - 1];
  return { x: last.x, y: last.y, angle: 0, finished: true };
}

export function getTotalPathLength(path: PathPoint[]): number {
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const dx = path[i + 1].x - path[i].x;
    const dy = path[i + 1].y - path[i].y;
    total += Math.sqrt(dx * dx + dy * dy);
  }
  return total;
}
