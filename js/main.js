import * as THREE from 'three';
import { CELL_SIZE } from './config.js?v=9.3';
import { Game } from './game.js?v=9.3';
import { loadGLB } from './modelLoader.js?v=9.3';
import { basement } from './stages/basement.js?v=9.3';
import { clubroom } from './stages/clubroom.js?v=9.3';
import { TouchControls } from './touchControls.js?v=9.3';

console.log('=== RAT ESCAPE VERSION 9.3 ===');
const STAGES = new Map([
  [basement.id, basement],
  [clubroom.id, clubroom]
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
const gameUIs = [...document.querySelectorAll('.game-ui')];
const messageEl = document.querySelector('#message');
const joystickZone = document.querySelector('#joystick-zone');
const joystickBase = document.querySelector('#joystick-base');
const joystickThumb = document.querySelector('#joystick-thumb');
const mobileRestartButton = document.querySelector('#mobile-restart-button');
const touchControls = new TouchControls(joystickZone, joystickBase, joystickThumb);

let game = null;
let mode = 'menu';
let currentStageData = null;
const assetPromises = new Map();
const clock = new THREE.Clock();

function loadPlayerAsset(stageData) {
  const url = stageData.character?.url;
  if (!url) return Promise.resolve(null);

  if (!assetPromises.has(url)) {
    const promise = loadGLB(url)
      .then((gltf) => {
        console.log(`${stageData.name} character loaded.`, gltf.animations?.map((a) => a.name) ?? []);
        return gltf;
      })
      .catch((error) => {
        console.error(
          `${stageData.name}用キャラクターを読み込めませんでした: ${url}。仮キャラクターで続行します。`,
          error
        );
        return null;
      });
    assetPromises.set(url, promise);
  }

  return assetPromises.get(url);
}

function cleanAddressBar() {
  history.replaceState(null, '', window.location.pathname);
}

function hideAllMenuScreens() {
  titleScreen.classList.add('hidden');
  stageScreen.classList.add('hidden');
  howtoScreen.classList.add('hidden');
}

function showTitle() {
  mode = 'menu';
  currentStageData = null;
  hideAllMenuScreens();
  titleScreen.classList.remove('hidden');
  gameUIs.forEach((el) => el.classList.add('hidden'));
  messageEl.classList.add('hidden');
  touchControls.reset();
  applyMenuAtmosphere();
  fitCamera();
  cleanAddressBar();
}

function showHowTo() {
  mode = 'menu';
  currentStageData = null;
  hideAllMenuScreens();
  howtoScreen.classList.remove('hidden');
  gameUIs.forEach((el) => el.classList.add('hidden'));
  messageEl.classList.add('hidden');
  touchControls.reset();
  applyMenuAtmosphere();
  fitCamera();
  cleanAddressBar();
}

function showStageSelect() {
  mode = 'menu';
  currentStageData = null;
  hideAllMenuScreens();
  stageScreen.classList.remove('hidden');
  gameUIs.forEach((el) => el.classList.add('hidden'));
  messageEl.classList.add('hidden');
  touchControls.reset();
  applyMenuAtmosphere();
  fitCamera();
  cleanAddressBar();
}

async function startStage(stageData) {
  mode = 'loading';
  currentStageData = stageData;
  hideAllMenuScreens();
  messageEl.classList.add('hidden');

  applyStageAtmosphere(stageData);
  fitCamera();

  const playerGLTF = await loadPlayerAsset(stageData);
  game = new Game(scene, stageData, playerGLTF);
  gameUIs.forEach((el) => el.classList.remove('hidden'));
  mode = 'playing';
  history.replaceState(null, '', `#${stageData.id}`);
  clock.getDelta();
}

function reloadTo(screen = 'title') {
  // Reload to clear the current Three.js stage completely.
  const url = new URL(window.location.href);
  url.hash = '';
  url.search = '';
  url.searchParams.set('_reload', Date.now().toString());
  if (screen !== 'title') url.searchParams.set('_screen', screen);
  window.location.replace(url.toString());
}

function fitCamera() {
  const aspect = window.innerWidth / window.innerHeight;

  // v8: camera size follows the selected stage. Stage 1 is 7x12 and Stage 2
  // is 9x12, while keeping the same close framing used in v7.
  const data = currentStageData ?? basement;
  applyCameraPose(currentStageData);
  const requiredHalfW = (data.cols * CELL_SIZE) / 2 + 0.55;
  const requiredHalfH = (data.rows * CELL_SIZE) / 2 + 0.55;
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
    // Slightly warmer/brighter room so Stage 2 immediately feels different.
    scene.background = new THREE.Color(0x242622);
    scene.fog = new THREE.Fog(0x242622, 29, 50);
    hemi.color.setHex(0xd4d1bd);
    hemi.groundColor.setHex(0x40382d);
    keyLight.color.setHex(0xffefd0);
    sideLight.color.setHex(0xb7c7b0);
    renderer.toneMappingExposure = 1.02;
  } else {
    scene.background = new THREE.Color(0x171c1d);
    scene.fog = new THREE.Fog(0x171c1d, 26, 45);
    hemi.color.setHex(0xb8c3bd);
    hemi.groundColor.setHex(0x25221e);
    keyLight.color.setHex(0xffe6ba);
    sideLight.color.setHex(0x9ac0c0);
    renderer.toneMappingExposure = 0.92;
  }
}

window.addEventListener('resize', fitCamera);
window.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'r' && mode === 'playing' && currentStageData) {
    reloadTo(currentStageData.id);
  }
});

document.querySelector('#title-start-button').addEventListener('click', showStageSelect);
document.querySelector('#title-howto-button').addEventListener('click', showHowTo);
document.querySelector('#howto-back-button').addEventListener('click', showTitle);
document.querySelector('#howto-start-button').addEventListener('click', showStageSelect);
document.querySelector('#stage-back-button').addEventListener('click', showTitle);
document.querySelector('#basement-stage-button').addEventListener('click', () => startStage(basement));
document.querySelector('#clubroom-stage-button').addEventListener('click', () => startStage(clubroom));
document.querySelector('#restart-button').addEventListener('click', () => {
  reloadTo(currentStageData?.id ?? 'basement');
});
document.querySelector('#stage-select-button').addEventListener('click', () => reloadTo('stages'));
document.querySelector('#title-button').addEventListener('click', () => reloadTo('title'));
mobileRestartButton.addEventListener('click', () => {
  if (mode === 'playing' && currentStageData) reloadTo(currentStageData.id);
});

fitCamera();

// A normal visit ALWAYS starts at the title. Only our one-shot _screen query
// created by restart/result buttons can directly boot a stage or stage select.
const bootScreen = new URLSearchParams(window.location.search).get('_screen');
if (STAGES.has(bootScreen)) {
  startStage(STAGES.get(bootScreen));
} else if (bootScreen === 'stages') {
  showStageSelect();
} else {
  showTitle();
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (mode === 'playing' && game) {
    const touch = touchControls.getInput();
    game.setTouchInput(touch.x, touch.z);
    game.update(dt);
  } else {
    touchControls.reset();
  }
  renderer.render(scene, camera);
}
animate();
