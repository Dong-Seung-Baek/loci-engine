import type * as THREE from 'three';
import type { Helpers, Vec3 } from './helpers';
import type { PalaceData, Storage } from './storage';

// A place as the palace author writes it.
export interface LocusDef {
  o: string;            // group
  f: string;            // face / surface
  n: string;            // name
  F: Vec3;              // surface point
  N: Vec3;              // outward normal; picks the scaffolding kind
  cam: Vec3;            // drone position when viewing this place
  via?: Vec3[];         // waypoints when arriving from the previous place
  w?: number;           // side deck width
  s?: number;           // top/bottom frame half width
  h?: number;           // hanging frame height
  pin?: boolean;        // lantern arm for tight spots
}

// The same place after the engine has resolved and built it.
export interface Locus {
  i: number; o: string; f: string; n: string;
  F: THREE.Vector3; N: THREE.Vector3; cam: THREE.Vector3; via: THREE.Vector3[];
  w?: number; s?: number; h?: number; pin?: boolean;
  signPos: THREE.Vector3; itemPos: THREE.Vector3;
  station: THREE.Group; sign: THREE.Sprite; item: THREE.Sprite | null;
  ring: THREE.Mesh; ringMat: THREE.MeshBasicMaterial;
}

export interface BuildContext {
  THREE: typeof THREE;
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  h: Helpers;
}

export interface PalaceOptions {
  title: string;
  subtitle: string;
  storageKey: string;
  build(ctx: BuildContext): LocusDef[];
  groups: string[];
  theme: { background: number; fog: [number, number]; wimBackground?: number };
  wim: { position: Vec3; lookAt: Vec3; markerScale?: number };
  hint?: string[];
  hintTitle?: string;
  example?: PalaceData;
  loadingText?: string;
  listNote?: string;
  placeholders?: { item?: string; img?: string };
  seed?: number;
  minCamY?: number;     // drone never dips below this while travelling
  railMinY?: number;    // floor for the brass route rail
  sideSupport?: 'stays' | 'legs';  // side-deck supports: cables to the wall (default) or legs down
  preloadFonts?: string[];
  ready?(ctx: BuildContext): void;   // after fonts load, before places are built (canvas text that needs the web fonts)
  onFrame?(time: number, dt: number): void;
  storage?: Storage;
  container?: HTMLElement;
}
