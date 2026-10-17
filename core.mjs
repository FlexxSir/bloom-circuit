// A seeded spanning tree guarantees that every garden has a solution.
export const DIRECTIONS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
export const GARDENS = [
  { name: 'First light', size: 4, seed: 12719, note: 'Every garden starts with a little spark.' },
  { name: 'Fern hollow', size: 4, seed: 89243, note: 'Follow the light. Let the quiet corners grow.' },
  { name: 'Apricot hour', size: 5, seed: 31051, note: 'A few more branches. A little more possibility.' },
  { name: 'Moon meadow', size: 5, seed: 71491, note: 'Even the smallest bloom needs a way home.' },
  { name: 'Wildwood', size: 6, seed: 44257, note: 'Take your time. The forest is listening.' },
  { name: 'Full bloom', size: 6, seed: 95111, note: 'One last garden. Make every connection count.' },
];
export function randomSeed(seed) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export function rotateMask(mask, turns = 1) {
  const n = ((turns % 4) + 4) % 4;
  return ((mask << n) | (mask >>> (4 - n))) & 15;
}
export function generateGarden(level) {
  const { size, seed } = GARDENS[level];
  const random = randomSeed(seed);
  const root = Math.floor(size / 2) * size;
  const solution = Array(size * size).fill(0);
  const visited = new Set([root]);
  const stack = [root];
  while (stack.length) {
    const current = stack[stack.length - 1];
    const x = current % size, y = Math.floor(current / size);
    const candidates = DIRECTIONS.map(([dx, dy], direction) => ({ x: x + dx, y: y + dy, direction }))
      .filter(p => p.x >= 0 && p.y >= 0 && p.x < size && p.y < size && !visited.has(p.y * size + p.x));
    if (!candidates.length) { stack.pop(); continue; }
    const next = candidates[Math.floor(random() * candidates.length)];
    const index = next.y * size + next.x;
    solution[current] |= 1 << next.direction;
    solution[index] |= 1 << ((next.direction + 2) % 4);
    visited.add(index); stack.push(index);
  }
  const initial = solution.map((mask, index) => index === root ? 0 : Math.floor(random() * 4));
  if (connectedCells(solution, initial, size, root).size === size * size) {
    const index = solution.findIndex((mask, i) => i !== root && rotateMask(mask) !== mask);
    initial[index] = (initial[index] + 1) % 4;
  }
  return { size, root, solution, initial };
}
export function connectedCells(solution, rotations, size, root) {
  const connected = new Set([root]), queue = [root];
  for (let head = 0; head < queue.length; head++) {
    const index = queue[head], mask = rotateMask(solution[index], rotations[index]);
    const x = index % size, y = Math.floor(index / size);
    DIRECTIONS.forEach(([dx, dy], direction) => {
      const nx = x + dx, ny = y + dy, next = ny * size + nx;
      if (nx < 0 || ny < 0 || nx >= size || ny >= size || !(mask & (1 << direction))) return;
      if ((rotateMask(solution[next], rotations[next]) & (1 << ((direction + 2) % 4))) && !connected.has(next)) {
        connected.add(next); queue.push(next);
      }
    });
  }
  return connected;
}
export const isFlower = mask => (mask & (mask - 1)) === 0;
export const gardenScore = (moves, hints) => Math.max(100, 1800 - moves * 12 - hints * 180);
export const formatTime = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
