const START_NG = 'https://start.ng';
const hosted = /^[a-z0-9-]+\.start\.ng$/.test(location.hostname);
let framePromise, player = null, signedIn = false;
const $ = id => document.getElementById(id);

function connectFrame() {
  if (framePromise) return framePromise;
  framePromise = new Promise(resolve => {
    const frame = document.createElement('iframe');
    frame.src = `${START_NG}/connect`;
    frame.hidden = true;
    frame.title = 'start.ng player connection';
    const timer = setTimeout(() => resolve(null), 6000);
    frame.onload = () => { clearTimeout(timer); resolve(frame); };
    frame.onerror = () => { clearTimeout(timer); resolve(null); };
    document.body.append(frame);
  });
  return framePromise;
}

export async function askStartNg(message, replyType, timeoutMs = 5000) {
  if (!hosted) return null;
  const frame = await connectFrame();
  if (!frame) return null;
  return new Promise(resolve => {
    const requestId = crypto.randomUUID();
    const done = reply => { clearTimeout(timer); removeEventListener('message', onMessage); resolve(reply); };
    const timer = setTimeout(() => done(null), timeoutMs);
    function onMessage(event) {
      if (event.origin !== START_NG || event.source !== frame.contentWindow) return;
      if (event.data?.type === replyType && event.data.requestId === requestId) done(event.data);
    }
    addEventListener('message', onMessage);
    frame.contentWindow.postMessage({ ...message, requestId }, START_NG);
  });
}

export async function refreshPlayer() {
  const reply = await askStartNg({ type: 'startng:whoami' }, 'startng:user');
  signedIn = !!reply?.user;
  player = reply?.user ?? reply?.guest ?? null;
  $('player-name').textContent = player?.name || 'Guest gardener';
  $('player-account').textContent = signedIn && player.account ? `@${player.account}` : hosted ? 'Guest on start.ng' : 'Playing locally';
  const face = typeof player?.face === 'string' && /^data:image\/png;base64,[a-zA-Z0-9+/=]+$/.test(player.face) ? player.face : null;
  $('player-face').hidden = !face;
  $('guest-face').hidden = !!face;
  if (face) $('player-face').src = face;
  $('player-sign-in').hidden = signedIn;
  $('leaderboard-sign-in').hidden = signedIn;
  return player;
}

export async function refreshLeaderboard() {
  if (!hosted) return;
  $('leaderboard-status').textContent = 'Checking the greenhouse…';
  let reply = await askStartNg({ type: 'startng:leaderboard', limit: 7 }, 'startng:leaderboardData');
  if (!reply?.ok) {
    try {
      const response = await fetch(`https://api.start.ng/games/${location.hostname.split('.')[0]}/leaderboard?limit=7`, { signal: AbortSignal.timeout(6000) });
      if (response.ok) reply = { ok: true, entries: await response.json() };
    } catch { /* The game stays playable when the service is unavailable. */ }
  }
  const list = $('leaderboard-list');
  list.replaceChildren();
  if (reply?.ok && Array.isArray(reply.entries)) {
    reply.entries.slice(0, 7).forEach(entry => {
      const li = document.createElement('li');
      if (signedIn && entry.player_id === player?.id) li.className = 'self';
      const rank = document.createElement('span'); rank.className = 'rank'; rank.textContent = String(entry.rank);
      const name = document.createElement('span'); name.className = 'leader-name'; name.textContent = entry.name; name.title = `${entry.stats?.gardens ?? 0} gardens grown`;
      const score = document.createElement('b'); score.textContent = Number(entry.stats?.score ?? entry.score ?? 0).toLocaleString();
      li.append(rank, name, score); list.append(li);
    });
    $('leaderboard-status').textContent = reply.entries.length ? 'Ranked by gardens, then score, then time.' : 'The greenhouse is quiet. Grow the first garden.';
  } else $('leaderboard-status').textContent = 'The greenhouse is resting. Try refreshing in a moment.';
}

export async function saveRun(stats) {
  if (!hosted) return 'Saved on this device. Shared scores unlock on start.ng.';
  if (!signedIn) return 'Your run is saved here. Sign in to join the greenhouse.';
  const saved = await askStartNg({ type: 'startng:score', stats }, 'startng:scoreSaved');
  if (saved?.ok) {
    refreshLeaderboard();
    return saved.result?.improved ? `New best in the greenhouse! Rank #${saved.result.rank}.` : 'Run saved. Your best garden stays on the board.';
  }
  return saved?.error || 'Could not reach start.ng. Your run is saved on this device.';
}

export function initStartNg() {
  const signInUrl = `${START_NG}/?return_to=${encodeURIComponent(location.origin + location.pathname)}`;
  $('player-sign-in').href = signInUrl;
  $('leaderboard-sign-in').href = signInUrl;
  // The connect bridge handles authentication; remove an unused return token.
  if (new URLSearchParams(location.hash.slice(1)).has('startng_session')) history.replaceState(null, '', location.pathname + location.search);
  $('refresh-board').addEventListener('click', refreshLeaderboard);
  let refreshing = false;
  async function refresh() {
    if (refreshing) return;
    refreshing = true;
    try { await refreshPlayer(); } finally { refreshing = false; }
  }
  addEventListener('focus', refresh);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  refresh(); refreshLeaderboard();
}
