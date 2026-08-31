import * as THREE from 'three';
import { CELL_SIZE } from './config.js?v=11.2';
import { Game } from './game.js?v=11.2';
import { loadGLB } from './modelLoader.js?v=11.2';
import { basement } from './stages/basement.js?v=11.2';
import { clubroom } from './stages/clubroom.js?v=11.2';
import { facility } from './stages/facility.js?v=11.2';
import { battleArena } from './stages/battleArena.js?v=11.2';
import { TouchControls } from './touchControls.js?v=11.2';
import { OnlineMatchClient } from './onlineMatch.js?v=11.2';

console.log('=== RAT ESCAPE VERSION 11.2 ===');

const SOLO_STAGES = new Map([
  [basement.id, basement],
  [clubroom.id, clubroom],
  [facility.id, facility]
]);

const root = document.querySelector('#game-root');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;
root.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x171c1d);
scene.fog = new THREE.Fog(0x171c1d, 26, 45);

const camera = new THREE.OrthographicCamera(-14, 14, 9, -9, 0.1, 100);
const DEFAULT_CAMERA_POSE = {
  position: { x: 0, y: 20, z: 18 },
  lookAt: { x: 0, y: 0, z: 0 }
};

function applyCameraPose(stageData = null) {
  const pose = stageData?.camera ?? DEFAULT_CAMERA_POSE;
  camera.position.set(pose.position.x, pose.position.y, pose.position.z);
  camera.lookAt(pose.lookAt.x, pose.lookAt.y, pose.lookAt.z);
}
applyCameraPose();

const hemi = new THREE.HemisphereLight(0xb8c3bd, 0x25221e, 1.35);
scene.add(hemi);
const keyLight = new THREE.DirectionalLight(0xffe6ba, 2.15);
keyLight.position.set(-8, 18, 9);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.left = -16;
keyLight.shadow.camera.right = 16;
keyLight.shadow.camera.top = 14;
keyLight.shadow.camera.bottom = -14;
scene.add(keyLight);
const sideLight = new THREE.PointLight(0x9ac0c0, 12, 30, 2);
sideLight.position.set(9, 5, -5);
scene.add(sideLight);

const titleScreen = document.querySelector('#title-screen');
const stageScreen = document.querySelector('#stage-screen');
const howtoScreen = document.querySelector('#howto-screen');
const onlineScreen = document.querySelector('#online-screen');
const gameUIs = [...document.querySelectorAll('.game-ui')];
const hud = document.querySelector('#hud');
const messageEl = document.querySelector('#message');
const joystickZone = document.querySelector('#joystick-zone');
const joystickBase = document.querySelector('#joystick-base');
const joystickThumb = document.querySelector('#joystick-thumb');
const mobileRestartButton = document.querySelector('#mobile-restart-button');
const touchControls = new TouchControls(joystickZone, joystickBase, joystickThumb);

const scoreEl = document.querySelector('#score');
const scoreSecondaryEl = document.querySelector('#score-secondary');
const timerEl = document.querySelector('#timer');
const stageLabelEl = document.querySelector('.stage-label');
const stageNameEl = document.querySelector('.stage-name');
const helpEl = document.querySelector('#help');
const onlineStatusEl = document.querySelector('#online-status');
const roomCodeEl = document.querySelector('#room-code-display');
const roomPlayersEl = document.querySelector('#room-players-display');
const serverUrlInput = document.querySelector('#server-url-input');
const joinCodeInput = document.querySelector('#join-code-input');
const countdownOverlay = document.querySelector('#countdown-overlay');
const countdownText = document.querySelector('#countdown-text');
const restartButton = document.querySelector('#restart-button');

const assetPromises = new Map();
const clock = new THREE.Clock();
const keys = new Set();
let mode = 'menu';
let currentStageData = null;
let soloGame = null;
let onlineMatch = null;

serverUrlInput.value = localStorage.getItem('ratEscapeServerUrl')
  || `${window.location.protocol}//${window.location.hostname}${window.location.port ? `:${window.location.port}` : ''}`;

function loadAsset(url, label = url) {
  if (!url) return Promise.resolve(null);
  if (!assetPromises.has(url)) {
    assetPromises.set(url, loadGLB(url).catch((error) => {
      console.error(`${label} の読み込みに失敗しました`, error);
      return null;
    }));
  }
  return assetPromises.get(url);
}

function loadSoloCharacter(stageData) {
  return loadAsset(stageData.character?.url, stageData.name);
}

function loadBattleAssets() {
  return Promise.all([
    loadAsset(battleArena.battleCharacters.p1.url, 'Battle Blue'),
    loadAsset(battleArena.battleCharacters.p2.url, 'Battle Red')
  ]).then(([p1, p2]) => ({ p1, p2 }));
}

function cleanAddressBar() {
  history.replaceState(null, '', window.location.pathname);
}

function hideAllMenuScreens() {
  titleScreen.classList.add('hidden');
  stageScreen.classList.add('hidden');
  howtoScreen.classList.add('hidden');
  onlineScreen.classList.add('hidden');
}

function resetResult() {
  messageEl.classList.add('hidden');
  messageEl.classList.remove('win', 'lose');
}

function showHudForSolo(stageData) {
  hud.classList.remove('hidden');
  helpEl.classList.remove('hidden');
  stageLabelEl.textContent = `STAGE ${stageData.stageNumber ?? 1}`;
  stageNameEl.textContent = stageData.name;
  scoreEl.textContent = `退治 0 / ${stageData.targetKills}`;
  scoreSecondaryEl.textContent = '';
  scoreSecondaryEl.classList.add('hidden');
  timerEl.textContent = '';
  timerEl.classList.add('hidden');
  helpEl.innerHTML = '<b>WASD / 矢印</b> 移動<br>ネズミの正面 → GAME OVER<br>ネズミの背後 → 退治<br><b>R</b> リスタート';
}

function showHudForOnline() {
  hud.classList.remove('hidden');
  helpEl.classList.remove('hidden');
  stageLabelEl.textContent = 'ONLINE BATTLE';
  stageNameEl.textContent = battleArena.name;
  scoreEl.textContent = 'BLUE 0  •  HIT 0/3';
  scoreSecondaryEl.textContent = 'RED 0  •  HIT 0/3';
  scoreSecondaryEl.classList.remove('hidden');
  timerEl.textContent = 'TIME 60';
  timerEl.classList.remove('hidden');
  helpEl.innerHTML = '<b>60秒対戦</b><br>背後から触れる → +1匹<br>正面・横から接触 → 得点0 / 3秒無敵<br><b>3回接触したら即敗北</b>';
}

function hideGameplayUI() {
  gameUIs.forEach((el) => el.classList.add('hidden'));
  touchControls.reset();
}

function showTitle() {
  mode = 'menu';
  currentStageData = null;
  hideAllMenuScreens();
  titleScreen.classList.remove('hidden');
  hideGameplayUI();
  resetResult();
  applyMenuAtmosphere();
  fitCamera(basement);
  cleanAddressBar();
}

function showHowTo() {
  mode = 'menu';
  hideAllMenuScreens();
  howtoScreen.classList.remove('hidden');
  hideGameplayUI();
  resetResult();
  applyMenuAtmosphere();
  fitCamera(basement);
  cleanAddressBar();
}

function showStageSelect() {
  mode = 'menu';
  hideAllMenuScreens();
  stageScreen.classList.remove('hidden');
  hideGameplayUI();
  resetResult();
  applyMenuAtmosphere();
  fitCamera(basement);
  cleanAddressBar();
}

function showOnlineSetup() {
  mode = 'online-setup';
  hideAllMenuScreens();
  onlineScreen.classList.remove('hidden');
  hideGameplayUI();
  resetResult();
  applyStageAtmosphere(battleArena);
  fitCamera(battleArena);
  cleanAddressBar();
}

async function startSoloStage(stageData) {
  mode = 'loading';
  currentStageData = stageData;
  hideAllMenuScreens();
  resetResult();
  applyStageAtmosphere(stageData);
  fitCamera(stageData);

  const playerGLTF = await loadSoloCharacter(stageData);
  soloGame = new Game(scene, stageData, playerGLTF);
  gameUIs.forEach((el) => el.classList.remove('hidden'));
  showHudForSolo(stageData);
  mode = 'playing-solo';
  history.replaceState(null, '', `#${stageData.id}`);
  clock.getDelta();
}

async function connectOnline() {
  mode = 'online-loading';
  currentStageData = battleArena;
  applyStageAtmosphere(battleArena);
  fitCamera(battleArena);
  const assets = await loadBattleAssets();

  const serverUrl = serverUrlInput.value.trim();
  localStorage.setItem('ratEscapeServerUrl', serverUrl);

  onlineMatch = new OnlineMatchClient(scene, battleArena, assets);
  onlineMatch.onStatus = (text) => { onlineStatusEl.textContent = text; };
  onlineMatch.onRoom = ({ code, players }) => {
    roomCodeEl.textContent = code || '----';
    roomPlayersEl.textContent = `${players ?? 0} / 2`;
  };
  onlineMatch.onCountdown = (value) => {
    hideAllMenuScreens();
    gameUIs.forEach((el) => el.classList.remove('hidden'));
    showHudForOnline();
    resetResult();
    mode = 'online-countdown';
    countdownText.textContent = String(value);
    countdownOverlay.classList.remove('hidden');
    history.replaceState(null, '', '#online');
  };
  onlineMatch.onMatchStarted = () => {
    hideAllMenuScreens();
    gameUIs.forEach((el) => el.classList.remove('hidden'));
    showHudForOnline();
    countdownOverlay.classList.add('hidden');
    restartButton.textContent = 'もう一度';
    mode = 'playing-online';
    history.replaceState(null, '', '#online');
  };
  onlineMatch.onMatchEnded = (payload) => {
    mode = 'online-ended';
    countdownOverlay.classList.add('hidden');
    restartButton.textContent = 'もう一度遊ぶ';
    const p1 = payload.scores.p1;
    const p2 = payload.scores.p2;
    const h1 = payload.hits?.p1 ?? 0;
    const h2 = payload.hits?.p2 ?? 0;
    const localWon = (payload.winner === onlineMatch.localSlot);
    const draw = payload.winner === 'draw';
    messageEl.classList.remove('hidden', 'win', 'lose');
    messageEl.classList.add(draw || localWon ? 'win' : 'lose');
    document.querySelector('#result-badge').textContent = draw ? '△' : (localWon ? '★' : '×');
    document.querySelector('#message-title').textContent = draw
      ? 'DRAW'
      : (localWon ? 'YOU WIN!' : 'YOU LOSE');

    if (payload.reason === 'three_hits') {
      const loserName = payload.loser === 'p1' ? 'BLUE' : 'RED';
      document.querySelector('#message-sub').textContent = `${loserName} がネズミに3回ぶつかりました  •  BLUE ${p1} - RED ${p2}`;
    } else {
      document.querySelector('#message-sub').textContent = `TIME UP  •  BLUE ${p1} - RED ${p2}  •  HIT ${h1}/3 - ${h2}/3`;
    }
  };
  onlineMatch.onRematchStatus = (payload) => {
    if (mode !== 'online-ended' && mode !== 'online-rematch-wait') return;
    const mySlot = onlineMatch.localSlot;
    const otherSlot = mySlot === 'p1' ? 'p2' : 'p1';
    const myReady = Boolean(payload.ready?.[mySlot]);
    const otherReady = Boolean(payload.ready?.[otherSlot]);
    if (myReady && !otherReady) {
      mode = 'online-rematch-wait';
      countdownText.textContent = '相手を待っています…';
      countdownOverlay.classList.remove('hidden');
    }
  };
  onlineMatch.onRoomClosed = (payload) => {
    onlineStatusEl.textContent = payload.message;
    window.alert(payload.message);
    reloadTo('title');
  };
  onlineMatch.connect(serverUrl);
}

function collectKeyboardInput() {
  let x = 0;
  let z = 0;
  if (keys.has('w') || keys.has('arrowup')) z -= 1;
  if (keys.has('s') || keys.has('arrowdown')) z += 1;
  if (keys.has('a') || keys.has('arrowleft')) x -= 1;
  if (keys.has('d') || keys.has('arrowright')) x += 1;
  return { x, z };
}

function reloadTo(screen = 'title') {
  const url = new URL(window.location.href);
  url.hash = '';
  url.search = '';
  url.searchParams.set('_reload', Date.now().toString());
  if (screen !== 'title') url.searchParams.set('_screen', screen);
  window.location.replace(url.toString());
}

function fitCamera(data = null) {
  const aspect = window.innerWidth / window.innerHeight;
  const stage = data ?? currentStageData ?? basement;
  applyCameraPose(stage);
  const requiredHalfW = (stage.cols * CELL_SIZE) / 2 + 0.75;
  const requiredHalfH = (stage.rows * CELL_SIZE) / 2 + 0.75;
  const baseAspect = requiredHalfW / requiredHalfH;

  let halfW;
  let halfH;
  if (aspect >= baseAspect) {
    halfH = requiredHalfH;
    halfW = halfH * aspect;
  } else {
    halfW = requiredHalfW;
    halfH = halfW / aspect;
  }

  camera.left = -halfW;
  camera.right = halfW;
  camera.top = halfH;
  camera.bottom = -halfH;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function applyMenuAtmosphere() {
  scene.background = new THREE.Color(0x171c1d);
  scene.fog = new THREE.Fog(0x171c1d, 26, 45);
  hemi.color.setHex(0xb8c3bd);
  hemi.groundColor.setHex(0x25221e);
  keyLight.color.setHex(0xffe6ba);
  sideLight.color.setHex(0x9ac0c0);
  renderer.toneMappingExposure = 0.92;
}

function applyStageAtmosphere(stageData) {
  if (stageData.theme === 'clubroom') {
    scene.background = new THREE.Color(0x242622);
    scene.fog = new THREE.Fog(0x242622, 29, 50);
    hemi.color.setHex(0xd4d1bd);
    hemi.groundColor.setHex(0x40382d);
    keyLight.color.setHex(0xffefd0);
    sideLight.color.setHex(0xb7c7b0);
    renderer.toneMappingExposure = 1.02;
  } else if (stageData.theme === 'facility') {
    scene.background = new THREE.Color(0x10181a);
    scene.fog = new THREE.Fog(0x10181a, 38, 66);
    hemi.color.setHex(0xaec9c7);
    hemi.groundColor.setHex(0x1c2a2a);
    keyLight.color.setHex(0xd9f2e8);
    sideLight.color.setHex(0x86b8b0);
    renderer.toneMappingExposure = 0.96;
  } else if (stageData.theme === 'battle') {
    scene.background = new THREE.Color(0x1b1d22);
    scene.fog = new THREE.Fog(0x1b1d22, 34, 58);
    hemi.color.setHex(0xd0d3df);
    hemi.groundColor.setHex(0x2b2d35);
    keyLight.color.setHex(0xfce7c5);
    sideLight.color.setHex(0xb4bddb);
    renderer.toneMappingExposure = 1.0;
  } else {
    applyMenuAtmosphere();
  }
}

window.addEventListener('resize', () => fitCamera());
window.addEventListener('keydown', (e) => {
  keys.add(e.key.toLowerCase());
  if (e.key.toLowerCase() === 'r' && mode === 'playing-solo' && currentStageData) {
    reloadTo(currentStageData.id);
  }
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));

// Title / menu buttons

document.querySelector('#title-start-button').addEventListener('click', showStageSelect);
document.querySelector('#title-online-button').addEventListener('click', showOnlineSetup);
document.querySelector('#title-howto-button').addEventListener('click', showHowTo);
document.querySelector('#howto-back-button').addEventListener('click', showTitle);
document.querySelector('#howto-start-button').addEventListener('click', showStageSelect);
document.querySelector('#stage-back-button').addEventListener('click', showTitle);
document.querySelector('#online-back-button').addEventListener('click', () => reloadTo('title'));
document.querySelector('#basement-stage-button').addEventListener('click', () => startSoloStage(basement));
document.querySelector('#clubroom-stage-button').addEventListener('click', () => startSoloStage(clubroom));
document.querySelector('#facility-stage-button').addEventListener('click', () => startSoloStage(facility));
document.querySelector('#online-connect-button').addEventListener('click', connectOnline);
document.querySelector('#online-create-button').addEventListener('click', () => onlineMatch?.createRoom());
document.querySelector('#online-join-button').addEventListener('click', () => onlineMatch?.joinRoom(joinCodeInput.value.trim().toUpperCase()));
restartButton.addEventListener('click', () => {
  if (currentStageData?.id === battleArena.id && onlineMatch) {
    if (mode === 'online-ended') {
      messageEl.classList.add('hidden');
      mode = 'online-rematch-wait';
      countdownText.textContent = '相手を待っています…';
      countdownOverlay.classList.remove('hidden');
      onlineMatch.requestRematch();
      return;
    }
    return;
  }
  reloadTo(currentStageData?.id ?? 'title');
});
document.querySelector('#stage-select-button').addEventListener('click', () => reloadTo('stages'));
document.querySelector('#title-button').addEventListener('click', () => reloadTo('title'));
mobileRestartButton.addEventListener('click', () => {
  if (mode === 'playing-solo' && currentStageData) reloadTo(currentStageData.id);
});

fitCamera();
const bootScreen = new URLSearchParams(window.location.search).get('_screen');
if (SOLO_STAGES.has(bootScreen)) startSoloStage(SOLO_STAGES.get(bootScreen));
else if (bootScreen === 'stages') showStageSelect();
else if (bootScreen === 'online') showOnlineSetup();
else showTitle();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const touch = touchControls.getInput();
  const keysInput = collectKeyboardInput();
  const input = { x: touch.x + keysInput.x, z: touch.z + keysInput.z };

  if (mode === 'playing-solo' && soloGame) {
    soloGame.setTouchInput(input.x, input.z);
    soloGame.update(dt);
  } else if (mode === 'playing-online' && onlineMatch) {
    onlineMatch.setInput(input.x, input.z);
    onlineMatch.update(dt);
    if (onlineMatch.latestSnapshot) {
      const snap = onlineMatch.latestSnapshot;
      scoreEl.textContent = `BLUE ${snap.players.p1.score}  •  HIT ${snap.players.p1.hits ?? 0}/3`;
      scoreSecondaryEl.textContent = `RED ${snap.players.p2.score}  •  HIT ${snap.players.p2.hits ?? 0}/3`;
      timerEl.textContent = `TIME ${Math.ceil(snap.timeLeft)}`;
    }
  } else if (onlineMatch && (mode === 'online-loading' || mode === 'online-setup' || mode === 'online-countdown' || mode === 'online-rematch-wait' || mode === 'online-ended')) {
    onlineMatch.setInput(0, 0);
    onlineMatch.update(dt);
  } else {
    touchControls.reset();
  }

  renderer.render(scene, camera);
}
animate();
