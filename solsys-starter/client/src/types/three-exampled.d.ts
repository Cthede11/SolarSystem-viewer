// Minimal shim in case the editor lags on picking up example types.
// You can delete this once the editor resolves them correctly.
declare module 'three/examples/jsm/controls/OrbitControls' {
  import { Camera, EventDispatcher, MOUSE, TOUCH, Vector3 } from 'three';
  export class OrbitControls extends EventDispatcher {
    constructor(object: Camera, domElement?: HTMLElement);
    object: Camera;
    domElement: HTMLElement;
    enabled: boolean;
    target: Vector3;
    minDistance: number;
    maxDistance: number;
    enableDamping: boolean;
    dampingFactor: number;
    mouseButtons: { LEFT: MOUSE; MIDDLE: MOUSE; RIGHT: MOUSE };
    touches: { ONE: TOUCH; TWO: TOUCH };
    update(): void;
    dispose(): void;
  }
}
