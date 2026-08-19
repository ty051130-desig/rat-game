import * as THREE from 'three';
import { Game } from './game.js';
import { loadGLB } from './modelLoader.js';
import { basement } from './stages/basement.js';
import { TouchControls } from './touchControls.js';

const MAIN_CHARACTER_URL = './assets/models/main_character.glb';

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
camera.position.set(0, 20, 18);
camera.lookAt(0, 0, 0);

const hemi = new THREE.HemisphereLight(0xb8c3bd, 0x25221e, 1.35);
scene.add(hemi);

const keyLight = new THREE.DirectionalLight(0xffe6ba, 2.15);
keyLight.position.set(-8, 18, 9);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.left = -16;
keyLight.shadow.camera.right = 16;
keyLight.shadow.camera.top = 12;
keyLight.shadow.camera.bottom = -12;
scene.add(keyLight);

const sideLight = new THREE.PointLight(0x9ac0c0, 12, 26, 2);
sideLight.position.set(9, 5, -5);
scene.add(sideLight);

const titleScreen = document.querySelector('#title-screen');
const stageScreen = document.querySelector('#stage-screen');
const gameUIs = [...document.querySelectorAll('.game-ui')];
const messageEl = document.querySelector('#message');
const joystickZone = document.querySelector('#joystick-zone');
const joystickBase = document.querySelector('#joystick-base');
const joystickThumb = document.querySelector('#joystick-thumb');
const mobileRestartButton = document.querySelector('#mobile-restart-button');
const touchControls = new TouchControls(joystickZone, joystickBase, joystickThumb);

let playerGLTF = null;
let game = null;
let mode = 'menu';
let gameAssetPromise = null;
const clock = new THREE.Clock();

function loadPlayerAsset() {
  if (!gameAssetPromise) {
    gameAssetPromise = loadGLB(MAIN_CHARACTER_URL)
      .then((gltf) => {
        console.log('main_character.glb loaded.', gltf.animations.map((a) => a.name));
        return gltf;
      })
      .catch((error) => {
        console.error(
          'main_character.glb を読み込めませんでした。assets/models/main_character.glb を確認してください。仮キャラクターで続行します。',
          error
        );
        return null;
      });
  }
  return gameAssetPromise;
}

function showTitle() {
  mode = 'menu';
  titleScreen.classList.remove('hidden');
  stageScreen.classList.add('hidden');
  gameUIs.forEach((el) => el.classList.add('hidden'));
  messageEl.classList.add('hidden');
  history.replaceState(null, '', window.location.pathname);
}

function showStageSelect() {
  mode = 'menu';
  titleScreen.classList.add('hidden');
  stageScreen.classList.remove('hidden');
  gameUIs.forEach((el) => el.classList.add('hidden'));
  messageEl.classList.add('hidden');
  history.replaceState(null, '', '#stages');
}

async function startBasement() {
  mode = 'loading';
  titleScreen.classList.add('hidden');
  stageScreen.classList.add('hidden');
  messageEl.classList.add('hidden');

  playerGLTF = await loadPlayerAsset();
  game = new Game(scene, basement, playerGLTF);
  gameUIs.forEach((el) => el.classList.remove('hidden'));
  mode = 'playing';
  history.replaceState(null, '', '#basement');
  clock.getDelta();
}

function reloadTo(hash = '') {
  // Force a real page navigation instead of changing only the hash.
  // The temporary query parameter prevents the browser from reloading the old
  // #basement URL before the hash change has been committed. showTitle(),
  // showStageSelect() and startBasement() clean the URL again after boot.
  const url = new URL(window.location.href);
  url.searchParams.set('_reload', Date.now().toString());
  url.hash = hash ? hash.replace(/^#/, '') : '';
  window.location.replace(url.toString());
}

function fitCamera() {
  const aspect = window.innerWidth / window.innerHeight;
  const requiredHalfW = 13.2;
  const requiredHalfH = 8.5;
  const baseAspect = requiredHalfW / requiredHalfH;

  let halfW, halfH;
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

window.addEventListener('resize', fitCamera);
window.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'r' && mode === 'playing') reloadTo('#basement');
});

document.querySelector('#title-start-button').addEventListener('click', showStageSelect);
document.querySelector('#stage-back-button').addEventListener('click', showTitle);
document.querySelector('#basement-stage-button').addEventListener('click', startBasement);
document.querySelector('#restart-button').addEventListener('click', () => reloadTo('#basement'));
document.querySelector('#stage-select-button').addEventListener('click', () => reloadTo('#stages'));
document.querySelector('#title-button').addEventListener('click', () => reloadTo(''));
mobileRestartButton.addEventListener('click', () => {
  if (mode === 'playing') reloadTo('#basement');
});

fitCamera();

const initialHash = window.location.hash;
if (initialHash === '#basement') {
  startBasement();
} else if (initialHash === '#stages') {
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
