// minimal “press/hold SPACE” breathing game for a popup

// elements
const cvs = document.getElementById('cvs');
const ctx = cvs.getContext('2d');
const breathsEl = document.getElementById('breaths');
const bestEl = document.getElementById('best');
const paceEl = document.getElementById('pace');
const resetBtn = document.getElementById('reset');
const muteBtn  = document.getElementById('mute');

// state
let inhaling = false;       // true while Space is held
let radius = 32;            // px; starting circle radius
let minR = 28;
let maxR = 110;
let speedBase = 0.55;       // growth/shrink rate
let breaths = 0;            // completed inhale+exhale cycles
let best = 0;
let soundOn = true;
let completedInhale = false;

// audio (gentle sine tone on inhale)
let audioCtx = null;
let osc = null;
let gain = null;

function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  osc = audioCtx.createOscillator();
  gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.value = 220; // base A-ish, chill
  gain.gain.value = 0.0;     // start silent
  osc.connect(gain).connect(audioCtx.destination);
  osc.start();
}

function setTone(active) {
  if (!audioCtx || !gain) return;
  const target = (active && soundOn) ? 0.05 : 0.0; // very soft
  gain.gain.cancelScheduledValues(audioCtx.currentTime);
  gain.gain.linearRampToValueAtTime(target, audioCtx.currentTime + 0.05);
}

// storage
chrome.storage.local.get(['bestBreaths', 'soundOn'], (res) => {
  best = Number(res.bestBreaths || 0);
  soundOn = (res.soundOn !== undefined) ? res.soundOn : true;
  bestEl.textContent = `Best: ${best}`;
  muteBtn.setAttribute('aria-pressed', soundOn ? 'false' : 'true');
  muteBtn.textContent = soundOn ? 'Sound: On' : 'Sound: Off';
});

// drawing
function draw() {
  const w = cvs.width, h = cvs.height;
  ctx.clearRect(0, 0, w, h);

  // background subtle glow depends on radius
  const glow = (radius - minR) / (maxR - minR);
  const cx = w / 2, cy = h / 2;

  // outer aura
  const grad = ctx.createRadialGradient(cx, cy, radius * 0.6, cx, cy, radius * 1.8);
  grad.addColorStop(0, `rgba(122,167,255,${0.20 + glow * 0.15})`);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 1.8, 0, Math.PI * 2);
  ctx.fill();

  // main circle
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = '#7aa7ff';
  ctx.globalAlpha = 0.25 + glow * 0.35;
  ctx.fill();
  ctx.globalAlpha = 1;

  // ring
  ctx.lineWidth = 2 + glow * 3;
  ctx.strokeStyle = '#e8ebff';
  ctx.beginPath();
  ctx.arc(cx, cy, radius - ctx.lineWidth, 0, Math.PI * 2);
  ctx.stroke();
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function tick() {
  const pace = Number(paceEl.value);        // 0.5 .. 2.0
  const spd = speedBase * pace;             // scale speed

  if (inhaling) {
    radius += spd;
    if (radius >= maxR) {
      radius = maxR;
      completedInhale = true;               // reached the top
    }
  } else {
    radius -= spd * 0.9;                    // slightly slower exhale
    if (radius <= minR) {
      radius = minR;
      // count a breath only if we had a full inhale before
      if (completedInhale) {
        breaths++;
        breathsEl.textContent = `Breaths: ${breaths}`;
        completedInhale = false;
        // update best
        if (breaths > best) {
          best = breaths;
          bestEl.textContent = `Best: ${best}`;
          chrome.storage.local.set({ bestBreaths: best });
        }
      }
    }
  }

  radius = clamp(radius, minR, maxR);
  // modulate tone frequency by radius for subtle feedback
  if (osc) {
    const t = (radius - minR) / (maxR - minR);
    const f = 180 + t * 80; // 180–260 Hz
    osc.frequency.setTargetAtTime(f, audioCtx?.currentTime || 0, 0.05);
  }

  draw();
  requestAnimationFrame(tick);
}

// input
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !e.repeat) {
    e.preventDefault();
    initAudio();
    inhaling = true;
    setTone(true);
  }
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    inhaling = false;
    setTone(false);
  }
});

// controls
paceEl.addEventListener('input', () => {
  // no-op; read live in tick()
});

resetBtn.addEventListener('click', () => {
  breaths = 0;
  breathsEl.textContent = `Breaths: ${breaths}`;
});

muteBtn.addEventListener('click', () => {
  soundOn = !soundOn;
  chrome.storage.local.set({ soundOn });
  muteBtn.setAttribute('aria-pressed', soundOn ? 'false' : 'true');
  muteBtn.textContent = soundOn ? 'Sound: On' : 'Sound: Off';
  setTone(inhaling && soundOn);
});

// bootstrap
draw();
requestAnimationFrame(tick);
