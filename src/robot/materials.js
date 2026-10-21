import * as THREE from 'three';

export const LED_COLOR = new THREE.Color(0.3, 0.9, 1.0);

export function createMaterials() {
  const shell = new THREE.MeshPhysicalMaterial({
    name: 'shell',
    color: 0xe9edf2,
    roughness: 0.35,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
  });

  const joint = new THREE.MeshPhysicalMaterial({
    name: 'joint',
    color: 0x2a2f37,
    roughness: 0.32,
    metalness: 0.7,
    clearcoat: 0.6,
    clearcoatRoughness: 0.15,
  });

  const sole = new THREE.MeshStandardMaterial({
    name: 'sole',
    color: 0x1a1d22,
    roughness: 0.6,
    metalness: 0.2,
  });

  const visor = new THREE.MeshPhysicalMaterial({
    name: 'visor',
    color: 0x000000,
    roughness: 0.25,
    metalness: 0.0,
    clearcoat: 0.35,
    clearcoatRoughness: 0.15,
    specularIntensity: 0.3,
    envMapIntensity: 0.1,
  });

  const led = new THREE.MeshBasicMaterial({ name: 'led', color: LED_COLOR.clone().multiplyScalar(4) });

  return { shell, joint, sole, visor, led };
}
