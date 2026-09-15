// src/components/three/WaferScene.tsx
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export type ColorMode = 'heatmap' | 'process';

export type DieStatus = 'good' | 'defect' | 'untested';

export interface DieRecord {
  id: string;
  waferId: string;
  col: number;
  row: number;
  status: DieStatus;
  defectCode?: string;
  category?: string;
  confidence?: number;
  processDeviation: number;
}

interface WaferSceneProps {
  dies: DieRecord[];
  gridSize: number;
  colorMode: ColorMode;
  selectedDieId: string | null;
  onSelectDie: (die: DieRecord) => void;
}

const DIE_SIZE = 1;
const DIE_GAP = 0.15;
const SPACING = DIE_SIZE + DIE_GAP;
const DIE_HEIGHT = 0.3;
const WAFER_THICKNESS = 0.3;
const SELECTED_LIFT = 0.35;

const HEATMAP_COLORS: Record<DieRecord['status'], THREE.Color> = {
  good: new THREE.Color('#10b981'),
  defect: new THREE.Color('#ef4444'),
  untested: new THREE.Color('#64748b'),
};
const PROCESS_LIGHT = new THREE.Color('#bfdbfe');
const PROCESS_DARK = new THREE.Color('#1e3a8a');

function baseColorForDie(die: DieRecord, mode: ColorMode): THREE.Color {
  if (mode === 'heatmap') return HEATMAP_COLORS[die.status];
  return PROCESS_LIGHT.clone().lerp(PROCESS_DARK, die.processDeviation);
}

interface ThreeState {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  raycaster: THREE.Raycaster;
  instancedMesh: THREE.InstancedMesh | null;
  dieOrder: DieRecord[];
  selectionRing: THREE.Mesh;
  resizeObserver: ResizeObserver | null;
  animationId: number;
  pointerDownPos: { x: number; y: number } | null;
}

export default function WaferScene({ dies, gridSize, colorMode, selectedDieId, onSelectDie }: WaferSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Persistent (across renders) three.js state — created once on mount.
  const threeRef = useRef<ThreeState | null>(null);

  // --- Mount: create renderer/scene/camera/controls once ---
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0f172a');

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    const directional = new THREE.DirectionalLight(0xffffff, 0.9);
    directional.position.set(5, 10, 7);
    scene.add(ambient, directional);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minPolarAngle = 0.1;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;

    const raycaster = new THREE.Raycaster();

    // Selection indicator: a flat ring that sits under the selected die.
    // Deliberately NOT tinting the die's own color — status/process color
    // must stay legible (green/red/gray, or the process ramp) regardless of
    // selection, so this uses a neutral accent color no data mode ever uses.
    const ringGeometry = new THREE.RingGeometry(DIE_SIZE * 0.58, DIE_SIZE * 0.78, 32);
    const ringMaterial = new THREE.MeshBasicMaterial({ color: '#fbbf24', side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
    const selectionRing = new THREE.Mesh(ringGeometry, ringMaterial);
    selectionRing.rotation.x = -Math.PI / 2;
    selectionRing.visible = false;
    scene.add(selectionRing);

    const state: ThreeState = {
      renderer,
      scene,
      camera,
      controls,
      raycaster,
      instancedMesh: null,
      dieOrder: [],
      selectionRing,
      resizeObserver: null,
      animationId: 0,
      pointerDownPos: null,
    };
    threeRef.current = state;

    const resize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    state.resizeObserver = resizeObserver;

    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      state.animationId = requestAnimationFrame(animate);
    };
    animate();

    const handlePointerDown = (e: PointerEvent) => {
      state.pointerDownPos = { x: e.clientX, y: e.clientY };
    };
    const handlePointerUp = (e: PointerEvent) => {
      const down = state.pointerDownPos;
      state.pointerDownPos = null;
      if (!down) return;
      const dist = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      if (dist > 5) return; // was a drag/rotate, not a click

      const mesh = state.instancedMesh;
      if (!mesh) return;
      const rect = renderer.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObject(mesh);
      if (hits.length > 0 && hits[0].instanceId !== undefined) {
        const die = state.dieOrder[hits[0].instanceId];
        if (die) onSelectDie(die);
      }
    };
    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointerup', handlePointerUp);

    return () => {
      cancelAnimationFrame(state.animationId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointerup', handlePointerUp);
      controls.dispose();
      state.instancedMesh?.geometry.dispose();
      (state.instancedMesh?.material as THREE.Material | undefined)?.dispose();
      selectionRing.geometry.dispose();
      (selectionRing.material as THREE.Material).dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
      threeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Rebuild the wafer + die instanced mesh whenever the die set changes ---
  useEffect(() => {
    const state = threeRef.current;
    if (!state) return;

    // clear previous wafer group (base disc + instanced dies)
    const previous = state.scene.getObjectByName('wafer-group');
    if (previous) {
      state.scene.remove(previous);
      previous.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          (obj.material as THREE.Material).dispose();
        }
      });
    }

    const center = (gridSize - 1) / 2;
    const gridRadius = gridSize / 2;
    const waferRadius = gridRadius * SPACING + DIE_SIZE;

    const group = new THREE.Group();
    group.name = 'wafer-group';

    const waferGeometry = new THREE.CylinderGeometry(waferRadius, waferRadius, WAFER_THICKNESS, 64);
    const waferMaterial = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.8 });
    const waferMesh = new THREE.Mesh(waferGeometry, waferMaterial);
    waferMesh.position.y = -WAFER_THICKNESS / 2;
    group.add(waferMesh);

    // Skip the instanced mesh entirely while there's nothing to draw (e.g. the
    // brief window before the async die fetch resolves) — an InstancedMesh
    // with 0 real instances but a non-zero draw count is a GL buffer mismatch.
    if (dies.length > 0) {
      const dieGeometry = new THREE.BoxGeometry(DIE_SIZE, DIE_HEIGHT, DIE_SIZE, 1, 1, 1);
      const dieMaterial = new THREE.MeshStandardMaterial({ roughness: 0.5 });
      const instancedMesh = new THREE.InstancedMesh(dieGeometry, dieMaterial, dies.length);
      instancedMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(dies.length * 3), 3);

      const matrix = new THREE.Matrix4();
      const dieOrder: DieRecord[] = [];

      dies.forEach((die, i) => {
        const x = (die.col - center) * SPACING;
        const z = (die.row - center) * SPACING;
        const isSelected = die.id === selectedDieId;
        const y = DIE_HEIGHT / 2 + (isSelected ? SELECTED_LIFT : 0);
        matrix.makeTranslation(x, y, z);
        instancedMesh.setMatrixAt(i, matrix);

        // Fill color always stays true to status/process value — selection
        // is indicated separately (elevation + ring), never by tinting this.
        instancedMesh.setColorAt(i, baseColorForDie(die, colorMode));

        if (isSelected) {
          state.selectionRing.position.set(x, 0.02, z);
          state.selectionRing.visible = true;
        }

        dieOrder.push(die);
      });
      instancedMesh.instanceMatrix.needsUpdate = true;
      if (instancedMesh.instanceColor) instancedMesh.instanceColor.needsUpdate = true;

      group.add(instancedMesh);
      state.instancedMesh = instancedMesh;
      state.dieOrder = dieOrder;
    } else {
      state.instancedMesh = null;
      state.dieOrder = [];
    }

    if (!dies.some((d) => d.id === selectedDieId)) {
      state.selectionRing.visible = false;
    }

    state.scene.add(group);

    // frame the camera to the new wafer size
    const dist = waferRadius * 2.4;
    state.camera.position.set(0, dist * 0.75, dist * 0.75);
    state.controls.target.set(0, 0, 0);
    state.controls.minDistance = waferRadius * 0.8;
    state.controls.maxDistance = waferRadius * 5;
    state.controls.update();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dies, gridSize]);

  // --- Re-color instances in place when mode/selection changes (no rebuild) ---
  useEffect(() => {
    const state = threeRef.current;
    const mesh = state?.instancedMesh;
    if (!state || !mesh) return;

    const matrix = new THREE.Matrix4();
    const center = (gridSize - 1) / 2;
    let foundSelected = false;

    state.dieOrder.forEach((die, i) => {
      const isSelected = die.id === selectedDieId;
      const x = (die.col - center) * SPACING;
      const z = (die.row - center) * SPACING;
      const y = DIE_HEIGHT / 2 + (isSelected ? SELECTED_LIFT : 0);
      matrix.makeTranslation(x, y, z);
      mesh.setMatrixAt(i, matrix);

      // Fill color always stays true to status/process value — selection
      // is indicated separately (elevation + ring), never by tinting this.
      mesh.setColorAt(i, baseColorForDie(die, colorMode));

      if (isSelected) {
        state.selectionRing.position.set(x, 0.02, z);
        state.selectionRing.visible = true;
        foundSelected = true;
      }
    });
    if (!foundSelected) state.selectionRing.visible = false;

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [colorMode, selectedDieId, gridSize]);

  return <div ref={containerRef} className="w-full h-full" />;
}
