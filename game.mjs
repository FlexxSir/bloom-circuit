import { GARDENS, DIRECTIONS, generateGarden, connectedCells, rotateMask, isFlower, gardenScore, formatTime } from './core.mjs';
import { initStartNg, saveRun } from './startng.mjs';

const $ = id => document.getElementById(id);
const STORAGE = 'bloom-circuit-v1';
const BEST = 'bloom-circuit-best-v1';
let state, garden, reachable, cells = [], audio, sound = false, toastTimer;
let lastTick = performance.now();
const read = key => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } };
function write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Private browsing can disable storage. */ } }
function freshState() { return { version: 1, level: 0, rotations: [], moves: 0, hints: 0, history: [], locked: [], completed: 0, score: 0, elapsed: 0, phase: 'ready' }; }

function validState(value) {
  if (!value || value.version !== 1 || !Number.isInteger(value.level) || value.level < 0 || value.level >= GARDENS.length) return false;
  const size = GARDENS[value.level].size;
  return ['ready', 'playing', 'paused', 'won', 'finished'].includes(value.phase)
    && Array.isArray(value.rotations) && value.rotations.length === size * size
    && value.rotations.every(n => Number.isInteger(n) && n >= 0 && n <= 100000)
    && ['moves', 'hints', 'score', 'elapsed', 'completed'].every(key => Number.isFinite(value[key]) && value[key] >= 0)
    && value.completed <= 6 && Array.isArray(value.history) && value.history.every(h => Number.isInteger(h.index) && h.index >= 0 && h.index < size * size && Number.isInteger(h.rotation))
    && Array.isArray(value.locked) && value.locked.every(n => Number.isInteger(n) && n >= 0 && n < size * size);
}

function persist() { write(STORAGE, state); }
function tone(index = 0, bloom = false) {
  if (!sound) return;
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
    const notes = bloom ? [0, 4, 7, 12] : [index % 5 * 2];
    notes.forEach((note, i) => {
      const oscillator = audio.createOscillator(), gain = audio.createGain();
      const at = audio.currentTime + i * .09;
      oscillator.type = 'sine'; oscillator.frequency.value = 261.63 * 2 ** (note / 12);
      gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(.045, at + .015); gain.gain.exponentialRampToValueAtTime(.0001, at + .38);
      oscillator.connect(gain).connect(audio.destination); oscillator.start(at); oscillator.stop(at + .4);
    });
  } catch { /* Sound is decorative. */ }
}
function toast(message) {
  $('toast').textContent = message; $('toast').classList.add('visible');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 3200);
}

function tileSvg(mask, index) {
  const endpoints = [[50, 0], [100, 50], [50, 100], [0, 50]];
  const path = endpoints.map(([x, y], direction) => mask & (1 << direction) ? `M50 50L${x} ${y}` : '').join('');
  let center = '<circle class="junction" cx="50" cy="50" r="5"/>';
  if (index === garden.root) {
    center = '<g class="seed-glow"><path d="M50 31L64 50L50 69L36 50Z"/></g><circle class="seed-center" cx="50" cy="50" r="5"/>';
  } else if (isFlower(mask)) {
    const petals = Array.from({ length: 6 }, (_, i) => `<ellipse class="flower" cx="50" cy="39" rx="6" ry="10" transform="rotate(${i * 60} 50 50)"/>`).join('');
    center = `${petals}<circle class="flower-core" cx="50" cy="50" r="6"/>`;
  }
  return `<svg viewBox="0 0 100 100" aria-hidden="true"><g class="paths"><path class="pipe-shadow" d="${path}"/><path class="pipe" d="${path}"/></g>${center}</svg>`;
}

function loadGarden(restore = false) {
  garden = generateGarden(state.level);
  if (!restore) { state.rotations = [...garden.initial]; state.moves = 0; state.hints = 0; state.history = []; state.locked = []; }
  $('board').style.setProperty('--size', garden.size);
  $('board').replaceChildren();
  cells = garden.solution.map((mask, index) => {
    const tile = document.createElement('button');
    tile.className = 'tile'; tile.type = 'button'; tile.innerHTML = tileSvg(mask, index);
    tile.addEventListener('click', event => turn(index, event.shiftKey ? -1 : 1));
    tile.addEventListener('contextmenu', event => { event.preventDefault(); turn(index, -1); });
    tile.addEventListener('keydown', event => {
      const directions = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -garden.size, ArrowDown: garden.size };
      if (event.key in directions) {
        event.preventDefault();
        const next = index + directions[event.key];
        if (next >= 0 && next < cells.length) cells[next].focus();
      }
      if ((event.key === 'Enter' || event.key === ' ') && event.shiftKey) { event.preventDefault(); turn(index, -1); }
    });
    $('board').append(tile); return tile;
  });
  const detail = GARDENS[state.level];
  $('garden-name').textContent = detail.name;
  $('garden-number').textContent = `GARDEN ${String(state.level + 1).padStart(2, '0')} / 06`;
  $('garden-size').textContent = `${garden.size} × ${garden.size}`;
  $('garden-note').textContent = detail.note;
  render();
}

function render() {
  reachable = connectedCells(garden.solution, state.rotations, garden.size, garden.root);
  cells.forEach((tile, index) => {
    const lit = reachable.has(index), locked = state.locked.includes(index);
    tile.classList.toggle('lit', lit); tile.classList.toggle('hinted', locked);
    tile.style.setProperty('--turns', state.rotations[index]);
    // A source remains focusable for keyboard navigation, but cannot rotate.
    tile.setAttribute('aria-disabled', String(index === garden.root || locked));
    tile.setAttribute('aria-label', `Row ${Math.floor(index / garden.size) + 1}, column ${index % garden.size + 1}, ${index === garden.root ? 'golden seed, fixed' : locked ? 'hinted tile, fixed' : isFlower(garden.solution[index]) ? 'flower' : 'path'}, ${lit ? 'connected' : 'unconnected'}`);
    tile.disabled = state.phase !== 'playing';
  });
  $('connected').textContent = reachable.size;
  $('tile-total').textContent = ` / ${garden.size ** 2}`;
  $('moves').textContent = state.moves;
  $('timer').textContent = formatTime(state.elapsed);
  $('score').textContent = state.score.toLocaleString();
  $('undo').disabled = state.phase !== 'playing' || !state.history.length;
  $('hint').disabled = state.phase !== 'playing';
  $('pause').disabled = !['playing', 'paused'].includes(state.phase);
  $('pause').innerHTML = state.phase === 'paused' ? '<span aria-hidden="true">▷</span> Resume' : '<span aria-hidden="true">Ⅱ</span> Pause';
  $('board-overlay').hidden = state.phase !== 'ready' && state.phase !== 'paused';
  if (state.phase === 'paused') {
    $('board-overlay').querySelector('h2').textContent = 'A moment to breathe.';
    $('board-overlay').querySelector('.eyebrow').textContent = 'GARDEN AT REST';
    $('start').innerHTML = 'Keep growing <span>↗</span>';
  } else {
    $('board-overlay').querySelector('h2').textContent = 'A garden awaits.';
    $('board-overlay').querySelector('.eyebrow').textContent = 'READY WHEN YOU ARE';
    $('start').innerHTML = 'Let it grow <span>↗</span>';
  }
  $('journey-count').textContent = `${state.completed} / 6`;
  $('journey-list').replaceChildren(...GARDENS.map((entry, index) => {
    const row = document.createElement('div');
    row.className = `garden-step ${index < state.completed ? 'done' : index === state.level ? 'current' : ''}`;
    row.innerHTML = `<i>${index < state.completed ? '✓' : String(index + 1).padStart(2, '0')}</i><span>${entry.name}</span>`;
    return row;
  }));
  const best = read(BEST);
  $('personal-best').textContent = best ? Number(best.score).toLocaleString() : '—';
  $('best-description').textContent = best ? `${best.gardens} of 6 gardens · ${formatTime(best.time)}` : 'A fresh patch of possibility.';
}

function turn(index, direction) {
  if (state.phase !== 'playing') return;
  if (index === garden.root) { toast('The golden seed stays put. Turn the paths around it.'); return; }
  if (state.locked.includes(index)) { toast('This hint is already growing in the right direction.'); return; }
  state.history.push({ index, rotation: state.rotations[index] });
  state.rotations[index] += direction;
  // Keep nonnegative turns for safe restoration without losing CSS animation direction.
  if (state.rotations[index] < 0) state.rotations[index] += 4;
  state.moves++;
  const previous = reachable.size;
  render(); tone(reachable.size > previous ? 3 : index);
  if (reachable.size === garden.size ** 2) winGarden();
  persist();
}

function showModal(html, setup) {
  $('modal-content').innerHTML = html;
  if (!$('modal').open) $('modal').showModal();
  setup?.();
}
function closeModal() { $('modal').close(); }

async function winGarden() {
  state.phase = state.level === GARDENS.length - 1 ? 'finished' : 'won';
  state.completed = state.level + 1;
  const earned = gardenScore(state.moves, state.hints);
  state.score += earned;
  const stats = { gardens: state.completed, score: state.score, time: Math.floor(state.elapsed) };
  const best = read(BEST);
  if (!best || stats.gardens > best.gardens || (stats.gardens === best.gardens && (stats.score > best.score || stats.score === best.score && stats.time < best.time))) write(BEST, stats);
  render(); persist(); tone(0, true);
  $('board').classList.add('pulse'); setTimeout(() => $('board').classList.remove('pulse'), 800);
  resultModal(earned);
  const message = await saveRun(stats);
  if (state.completed === stats.gardens && $('save-message')) $('save-message').textContent = message;
}

function resultModal(earned = gardenScore(state.moves, state.hints)) {
  const finished = state.phase === 'finished';
  showModal(`<span class="modal-flower" aria-hidden="true">✳</span><div class="eyebrow" style="justify-content:center">${finished ? 'SIX GARDENS. ONE BEAUTIFUL JOURNEY.' : 'LOOK WHAT YOU GREW'}</div><h2>${finished ? 'A world in bloom.' : 'A little more life.'}</h2><p>${finished ? 'Every path connected. Every garden glowing.<br>You made something lovely.' : `${GARDENS[state.level].name} is in full bloom.<br>A new patch of possibility is waiting.`}</p><div class="result-stats"><div><b>${finished ? state.score.toLocaleString() : `+${earned.toLocaleString()}`}</b><span>${finished ? 'TOTAL SCORE' : 'BLOOM POINTS'}</span></div><div><b>${state.moves}</b><span>TURNS</span></div><div><b>${formatTime(state.elapsed)}</b><span>TOTAL TIME</span></div></div><p class="modal-save" id="save-message">Your progress is saved on this device.</p><button class="primary" id="next">${finished ? 'Grow again' : 'Next garden'} <span>↗</span></button><button class="secondary" id="admire">Admire this garden</button>`, () => {
    $('next').onclick = () => {
      closeModal();
      if (finished) { state = freshState(); state.phase = 'playing'; }
      else { state.level++; state.phase = 'playing'; }
      loadGarden(); lastTick = performance.now(); persist(); cells.find((_, i) => i !== garden.root)?.focus();
    };
    $('admire').onclick = () => { closeModal(); $('pause').disabled = false; $('pause').innerHTML = '<span aria-hidden="true">✳</span> Continue'; };
  });
}

$('start').onclick = () => { state.phase = 'playing'; lastTick = performance.now(); render(); persist(); tone(2); cells[0].focus(); };
$('pause').onclick = () => {
  if (['won', 'finished'].includes(state.phase)) { resultModal(); return; }
  state.phase = state.phase === 'paused' ? 'playing' : 'paused'; lastTick = performance.now(); render(); persist();
};
$('undo').onclick = () => {
  const previous = state.history.pop(); if (!previous || state.phase !== 'playing') return;
  state.rotations[previous.index] = previous.rotation; state.moves++; render(); persist(); tone(1);
};
$('hint').onclick = () => {
  if (state.phase !== 'playing') return;
  const wrong = index => index !== garden.root && !state.locked.includes(index) && rotateMask(garden.solution[index], state.rotations[index]) !== garden.solution[index];
  let index = garden.solution.findIndex((mask, i) => wrong(i) && DIRECTIONS.some(([dx, dy]) => {
    const x = i % garden.size + dx, y = Math.floor(i / garden.size) + dy;
    return x >= 0 && y >= 0 && x < garden.size && y < garden.size && reachable.has(y * garden.size + x);
  }));
  if (index < 0) index = garden.solution.findIndex((mask, i) => wrong(i));
  if (index < 0) return;
  state.rotations[index] += (4 - state.rotations[index] % 4) % 4;
  state.locked.push(index); state.hints++; state.history = [];
  render(); persist(); tone(4); toast('One tile is facing the right way. Keep following the light.');
  cells[index].focus();
  if (reachable.size === garden.size ** 2) winGarden();
};
$('new-run').onclick = () => {
  if (state.phase === 'ready') return;
  const previousPhase = state.phase;
  if (state.phase === 'playing') { state.phase = 'paused'; render(); }
  showModal('<span class="modal-flower" aria-hidden="true">✿</span><h2>A fresh start?</h2><p>This run will be replaced. Your personal best and shared leaderboard score will stay saved.</p><button class="primary" id="confirm-new">Start a new run <span>↗</span></button><button class="secondary" id="cancel-new">Keep this garden</button>', () => {
    $('confirm-new').onclick = () => { closeModal(); state = freshState(); state.phase = 'playing'; loadGarden(); lastTick = performance.now(); persist(); };
    $('cancel-new').onclick = () => { closeModal(); state.phase = previousPhase; lastTick = performance.now(); render(); };
  });
};
$('sound').onclick = () => {
  sound = !sound; $('sound').setAttribute('aria-pressed', String(sound)); $('sound').setAttribute('aria-label', `Turn sound ${sound ? 'off' : 'on'}`);
  $('sound').querySelector('.sound-label').textContent = `Sound ${sound ? 'on' : 'off'}`; if (sound) tone(2, true);
};
$('modal').addEventListener('cancel', event => { event.preventDefault(); closeModal(); if (['won', 'finished'].includes(state.phase)) { $('pause').disabled = false; $('pause').innerHTML = '<span aria-hidden="true">✳</span> Continue'; } });
document.addEventListener('visibilitychange', () => { if (document.hidden && state.phase === 'playing') { state.phase = 'paused'; render(); persist(); } lastTick = performance.now(); });
addEventListener('pagehide', persist);
setInterval(() => {
  const now = performance.now();
  if (state.phase === 'playing' && !document.hidden && !$('modal').open) {
    state.elapsed += Math.min((now - lastTick) / 1000, 2); $('timer').textContent = formatTime(state.elapsed);
    if (Math.floor(state.elapsed) % 5 === 0) persist();
  }
  lastTick = now;
}, 500);

const restored = read(STORAGE);
state = validState(restored) ? restored : freshState();
const restore = validState(restored);
if (state.phase === 'playing') state.phase = 'paused';
loadGarden(restore);
if (['won', 'finished'].includes(state.phase)) resultModal();
initStartNg();
