import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();

export async function loadGLB(url) {
  return await loader.loadAsync(url);
}
