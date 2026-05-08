import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const BALL_RADIUS = 0.42;
const BALL_DIAMETER = BALL_RADIUS * 2;
const FIXED_TIME_STEP = 1 / 120;
const MAX_STEPS_PER_FRAME = 8;
const GRAVITY = 9.82;
const DRAG_ANGLE_LIMIT = 0.95;
const MAX_SWING_ANGLE = 1.18;
const ANGULAR_DAMPING = 0.018;
const COLLISION_RESTITUTION = 0.985;
const CONTACT_SLOP = 0.012;
const MIN_IMPACT_SPEED = 0.035;
const SELECTED_EMISSIVE = 0x064a57;
const DRAGGING_EMISSIVE = 0x0a5060;

const pointer = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const dragPoint = new THREE.Vector3();
const upAxis = new THREE.Vector3(0, 1, 0);

const weightMassMap = {
  Light: 0.65,
  Medium: 1.15,
  Heavy: 1.85,
};

export function updateMaterial(materialType) {
  const materialName = materialType.toLowerCase();

  if (materialName === 'wood') {
    return new THREE.MeshStandardMaterial({
      color: 0x8a552f,
      roughness: 0.78,
      metalness: 0,
      emissive: 0x160a03,
      emissiveIntensity: 0.08,
    });
  }

  if (materialName === 'metal') {
    return new THREE.MeshPhysicalMaterial({
      color: 0xd8dde2,
      roughness: 0.16,
      metalness: 1,
      clearcoat: 0.32,
      clearcoatRoughness: 0.1,
    });
  }

  return new THREE.MeshStandardMaterial({
    color: 0x18b8d8,
    roughness: 0.25,
    metalness: 0,
    emissive: 0x031a20,
    emissiveIntensity: 0.08,
  });
}

export function createBall(materialType, weight) {
  const geometry = new THREE.SphereGeometry(BALL_RADIUS, 48, 32);
  const material = updateMaterial(materialType);
  const ball = new THREE.Mesh(geometry, material);

  ball.castShadow = true;
  ball.receiveShadow = true;
  ball.userData = {
    materialType,
    weight,
    isCradleBall: true,
  };

  return ball;
}

export function createString(startPoint, endPoint) {
  const geometry = new THREE.CylinderGeometry(0.012, 0.012, 1, 12);
  const material = new THREE.MeshStandardMaterial({
    color: 0xb7f8ff,
    roughness: 0.3,
    metalness: 0.55,
  });
  const stringMesh = new THREE.Mesh(geometry, material);

  updateStringBetweenPoints(stringMesh, startPoint, endPoint);

  return stringMesh;
}

export function createFrame(dimensions) {
  const frame = new THREE.Group();
  const metalMaterial = new THREE.MeshStandardMaterial({
    color: 0x2f4350,
    roughness: 0.32,
    metalness: 0.65,
  });
  const accentMaterial = new THREE.MeshStandardMaterial({
    color: 0x65d9ee,
    roughness: 0.24,
    metalness: 0.25,
    emissive: 0x092b34,
    emissiveIntensity: 0.16,
  });

  const { width, depth, topY, baseY } = dimensions;
  const centerY = (topY + baseY) / 2;
  const supportHeight = topY - baseY;

  function addRodX(y, z, radius, material = metalMaterial) {
    const rod = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, width, 24),
      material,
    );
    rod.rotation.z = Math.PI / 2;
    rod.position.set(0, y, z);
    rod.castShadow = true;
    frame.add(rod);
  }

  function addRodZ(x, y, radius, material = metalMaterial) {
    const rod = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, depth, 24),
      material,
    );
    rod.rotation.x = Math.PI / 2;
    rod.position.set(x, y, 0);
    rod.castShadow = true;
    frame.add(rod);
  }

  for (const x of [-width / 2, width / 2]) {
    for (const z of [-depth / 2, depth / 2]) {
      const support = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055, 0.07, supportHeight, 24),
        metalMaterial,
      );
      support.position.set(x, centerY, z);
      support.castShadow = true;
      frame.add(support);
    }

    addRodZ(x, baseY, 0.045);
    addRodZ(x, topY, 0.05);
  }

  addRodX(topY, -depth / 2, 0.055);
  addRodX(topY, depth / 2, 0.055);
  addRodX(topY, 0, 0.04, accentMaterial);
  addRodX(baseY, -depth / 2, 0.045);
  addRodX(baseY, depth / 2, 0.045);

  return frame;
}

export function onBallDragStart(ball) {
  ball.isDragging = true;
  ball.lastDragAngle = ball.angle;
  ball.lastDragTime = performance.now();
  ball.angularVelocity = 0;

  applyBallVisualState(ball);
}

export function onBallDragMove(ball, mousePosition) {
  applyDraggedAngle(ball, getDragAngleForBall(ball, mousePosition.worldPoint));
}

export function onBallDragEnd(ball) {
  ball.isDragging = false;
  ball.angularVelocity *= 0.28;

  applyBallVisualState(ball);
}

function getDragAngleForBall(ball, worldPoint) {
  const anchorToPointerX = worldPoint.x - ball.centerAnchor.x;
  const anchorToPointerY = ball.centerAnchor.y - worldPoint.y;

  return THREE.MathUtils.clamp(
    Math.atan2(anchorToPointerX, anchorToPointerY),
    -DRAG_ANGLE_LIMIT,
    DRAG_ANGLE_LIMIT,
  );
}

function applyDraggedAngle(ball, nextAngle) {
  const now = performance.now();
  const deltaSeconds = Math.max((now - ball.lastDragTime) / 1000, FIXED_TIME_STEP);

  ball.angularVelocity = THREE.MathUtils.clamp(
    (nextAngle - ball.lastDragAngle) / deltaSeconds,
    -4.8,
    4.8,
  );
  ball.angle = nextAngle;
  ball.lastDragAngle = nextAngle;
  ball.lastDragTime = now;
}

function applyBallVisualState(ball) {
  const material = ball.mesh.material;

  if (!material?.emissive) {
    return;
  }

  if (ball.isDragging) {
    material.emissive.set(DRAGGING_EMISSIVE);
    material.emissiveIntensity = 0.35;
    return;
  }

  if (ball.isSelected) {
    material.emissive.set(SELECTED_EMISSIVE);
    material.emissiveIntensity = 0.28;
    return;
  }

  if (ball.baseEmissive) {
    material.emissive.copy(ball.baseEmissive);
  } else {
    material.emissive.set(0x000000);
  }

  material.emissiveIntensity = ball.baseEmissiveIntensity ?? 0;
}

export function createLabScene({ canvas, onStatusChange }) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    preserveDrawingBuffer: true,
  });
  const controls = new OrbitControls(camera, renderer.domElement);

  let cradleGroup = null;
  let animationFrameId = null;
  let primaryDragBall = null;
  let lastFrameTime = 0;
  let accumulatedTime = 0;
  const ballRecords = [];
  const draggableMeshes = [];
  const selectedBalls = new Set();
  let activeDragBalls = [];

  scene.background = new THREE.Color(0x020813);
  scene.fog = new THREE.Fog(0x020813, 9, 24);

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  camera.position.set(0, 3.2, 8.2);

  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.target.set(0, 1.35, 0);
  controls.update();

  createLights(scene);
  createLaboratoryBase(scene);

  function createCradle(config) {
    clearCradle();

    const dimensions = getCradleDimensions(config.ballCount);
    cradleGroup = new THREE.Group();
    cradleGroup.add(createFrame(dimensions));

    const firstBallX = -((config.ballCount - 1) * dimensions.ballSpacing) / 2;

    for (let index = 0; index < config.ballCount; index += 1) {
      const baseX = firstBallX + index * dimensions.ballSpacing;
      const ballRecord = createBallAssembly(config, dimensions, baseX, index);

      cradleGroup.add(ballRecord.leftString, ballRecord.rightString, ballRecord.mesh);
      ballRecords.push(ballRecord);
      draggableMeshes.push(ballRecord.mesh);
    }

    scene.add(cradleGroup);
    focusCameraOnCradle(dimensions);
    syncVisuals();
    exposeDebugState();
    onStatusChange?.('ready');
  }

  function createBallAssembly(config, dimensions, baseX, index) {
    const mass = weightMassMap[config.weight] ?? weightMassMap.Medium;
    const centerAnchor = new THREE.Vector3(baseX, dimensions.topY, 0);
    const leftAnchor = new THREE.Vector3(baseX - dimensions.stringSpread, dimensions.topY, 0);
    const rightAnchor = new THREE.Vector3(baseX + dimensions.stringSpread, dimensions.topY, 0);
    const ballStart = getPendulumPosition(centerAnchor, dimensions.stringLength, 0);
    const mesh = createBall(config.materialType, config.weight);
    const leftString = createString(leftAnchor, ballStart);
    const rightString = createString(rightAnchor, ballStart);
    const ballRecord = {
      index,
      mass,
      mesh,
      leftString,
      rightString,
      leftAnchor,
      rightAnchor,
      centerAnchor,
      stringLength: dimensions.stringLength,
      angle: 0,
      angularVelocity: 0,
      isDragging: false,
      isSelected: false,
      baseEmissive: mesh.material?.emissive?.clone() ?? null,
      baseEmissiveIntensity: mesh.material?.emissiveIntensity ?? 0,
    };

    mesh.userData.ballRecord = ballRecord;

    return ballRecord;
  }

  function resetExperiment() {
    clearCradle();
    primaryDragBall = null;
    activeDragBalls = [];
    controls.enabled = true;
    accumulatedTime = 0;
    onStatusChange?.('ready');
  }

  function clearCradle() {
    if (activeDragBalls.length > 0) {
      endDragGroup();
    }

    clearSelection();
    ballRecords.length = 0;
    draggableMeshes.length = 0;
    exposeDebugState();

    if (!cradleGroup) {
      return;
    }

    scene.remove(cradleGroup);
    disposeObject(cradleGroup);
    cradleGroup = null;
  }

  function focusCameraOnCradle(dimensions) {
    const distance = Math.max(8.2, dimensions.width * 1.12);
    camera.position.set(0, 3.2, distance);
    controls.target.set(0, 1.35, 0);
    controls.update();
  }

  function animate() {
    if (animationFrameId !== null) {
      return;
    }

    function renderLoop(time) {
      animationFrameId = window.requestAnimationFrame(renderLoop);

      if (lastFrameTime > 0) {
        const deltaSeconds = Math.min((time - lastFrameTime) / 1000, 0.08);
        accumulatedTime += deltaSeconds;

        let stepCount = 0;
        while (accumulatedTime >= FIXED_TIME_STEP && stepCount < MAX_STEPS_PER_FRAME) {
          stepCradlePhysics(FIXED_TIME_STEP);
          accumulatedTime -= FIXED_TIME_STEP;
          stepCount += 1;
        }

        if (stepCount === MAX_STEPS_PER_FRAME) {
          accumulatedTime = 0;
        }
      }

      lastFrameTime = time;
      syncVisuals();
      controls.update();
      renderer.render(scene, camera);
    }

    renderLoop(0);
  }

  function stepCradlePhysics(deltaSeconds) {
    integratePendulums(deltaSeconds);
    resolveCradleCollisions();
  }

  function integratePendulums(deltaSeconds) {
    for (const ball of ballRecords) {
      if (ball.isDragging) {
        continue;
      }

      const angularAcceleration =
        -(GRAVITY / ball.stringLength) * Math.sin(ball.angle) -
        ANGULAR_DAMPING * ball.angularVelocity;

      ball.angularVelocity += angularAcceleration * deltaSeconds;
      ball.angle += ball.angularVelocity * deltaSeconds;
      ball.angle = THREE.MathUtils.clamp(ball.angle, -MAX_SWING_ANGLE, MAX_SWING_ANGLE);

      if (Math.abs(ball.angle) < 0.0008 && Math.abs(ball.angularVelocity) < 0.0015) {
        ball.angle = 0;
        ball.angularVelocity = 0;
      }
    }
  }

  function resolveCradleCollisions() {
    const passes = Math.max(2, ballRecords.length * 2);

    for (let pass = 0; pass < passes; pass += 1) {
      for (let index = 0; index < ballRecords.length - 1; index += 1) {
        resolveBallPair(ballRecords[index], ballRecords[index + 1]);
      }

      for (let index = ballRecords.length - 2; index >= 0; index -= 1) {
        resolveBallPair(ballRecords[index], ballRecords[index + 1]);
      }
    }
  }

  function resolveBallPair(leftBall, rightBall) {
    if (leftBall.isDragging || rightBall.isDragging) {
      return;
    }

    const leftPosition = getCurrentPosition(leftBall);
    const rightPosition = getCurrentPosition(rightBall);
    const dx = rightPosition.x - leftPosition.x;
    const dy = rightPosition.y - leftPosition.y;
    const distance = Math.hypot(dx, dy);

    if (distance <= 0 || distance > BALL_DIAMETER + CONTACT_SLOP) {
      return;
    }

    const normal = {
      x: dx / distance,
      y: dy / distance,
    };
    const leftVelocity = getVelocityVector(leftBall);
    const rightVelocity = getVelocityVector(rightBall);
    const relativeNormalVelocity =
      (leftVelocity.x - rightVelocity.x) * normal.x +
      (leftVelocity.y - rightVelocity.y) * normal.y;

    separateOverlappingPair(leftBall, rightBall, distance, leftPosition, rightPosition);

    if (relativeNormalVelocity <= MIN_IMPACT_SPEED) {
      return;
    }

    const leftNormalVelocity = leftVelocity.x * normal.x + leftVelocity.y * normal.y;
    const rightNormalVelocity = rightVelocity.x * normal.x + rightVelocity.y * normal.y;
    const massTotal = leftBall.mass + rightBall.mass;
    const nextLeftNormalVelocity =
      ((leftBall.mass - COLLISION_RESTITUTION * rightBall.mass) * leftNormalVelocity +
        (1 + COLLISION_RESTITUTION) * rightBall.mass * rightNormalVelocity) /
      massTotal;
    const nextRightNormalVelocity =
      ((rightBall.mass - COLLISION_RESTITUTION * leftBall.mass) * rightNormalVelocity +
        (1 + COLLISION_RESTITUTION) * leftBall.mass * leftNormalVelocity) /
      massTotal;

    setNormalVelocity(leftBall, normal, nextLeftNormalVelocity);
    setNormalVelocity(rightBall, normal, nextRightNormalVelocity);
  }

  function separateOverlappingPair(leftBall, rightBall, distance, leftPosition, rightPosition) {
    const overlap = BALL_DIAMETER - distance;

    if (overlap <= 0.0005) {
      return;
    }

    const totalMass = leftBall.mass + rightBall.mass;
    const leftShare = rightBall.mass / totalMass;
    const rightShare = leftBall.mass / totalMass;
    const correction = Math.min(overlap + 0.0008, 0.035);

    setBallX(leftBall, leftPosition.x - correction * leftShare);
    setBallX(rightBall, rightPosition.x + correction * rightShare);
  }

  function syncVisuals() {
    for (const ballRecord of ballRecords) {
      const position = getCurrentPosition(ballRecord);

      ballRecord.mesh.position.copy(position);
      ballRecord.mesh.rotation.z = -ballRecord.angle * 0.72;
      ballRecord.mesh.rotation.y += ballRecord.angularVelocity * 0.015;

      updateStringBetweenPoints(
        ballRecord.leftString,
        ballRecord.leftAnchor,
        getBallStringPoint(position, ballRecord.leftAnchor),
      );
      updateStringBetweenPoints(
        ballRecord.rightString,
        ballRecord.rightAnchor,
        getBallStringPoint(position, ballRecord.rightAnchor),
      );
    }
  }

  function startDragGroup(primaryBall) {
    primaryDragBall = primaryBall;
    activeDragBalls = [];

    for (const ball of ballRecords) {
      ball.groupDragStartAngle = ball.angle;
    }

    updateActiveDragBalls(0);
    controls.enabled = false;
    onStatusChange?.('dragging');
  }

  function moveDragGroup(worldPoint) {
    if (!primaryDragBall) {
      return;
    }

    const primaryNextAngle = getDragAngleForBall(primaryDragBall, worldPoint);
    const primaryDelta = primaryNextAngle - primaryDragBall.groupDragStartAngle;

    updateActiveDragBalls(primaryDelta);

    for (const ball of activeDragBalls) {
      const baseAngle = selectedBalls.has(ball)
        ? ball.groupDragStartAngle
        : primaryDragBall.groupDragStartAngle;
      const nextAngle = THREE.MathUtils.clamp(
        baseAngle + primaryDelta,
        -DRAG_ANGLE_LIMIT,
        DRAG_ANGLE_LIMIT,
      );

      applyDraggedAngle(ball, nextAngle);
    }
  }

  function updateActiveDragBalls(primaryDelta) {
    const desiredBalls = getContactAwareDragSet(primaryDelta);

    for (const ball of activeDragBalls) {
      if (!desiredBalls.has(ball)) {
        ball.isDragging = false;
        ball.angularVelocity = 0;
        applyBallVisualState(ball);
      }
    }

    for (const ball of desiredBalls) {
      if (!activeDragBalls.includes(ball)) {
        onBallDragStart(ball);
      }
    }

    activeDragBalls = Array.from(desiredBalls).sort((a, b) => a.index - b.index);
  }

  function getContactAwareDragSet(primaryDelta) {
    const selectedGroup = selectedBalls.size > 0
      ? Array.from(selectedBalls)
      : [primaryDragBall];
    const selectedIndices = selectedGroup.map((ball) => ball.index);
    const minSelectedIndex = Math.min(...selectedIndices);
    const maxSelectedIndex = Math.max(...selectedIndices);
    const desiredBalls = new Set(selectedGroup);

    if (primaryDelta < -0.012) {
      for (let index = 0; index <= maxSelectedIndex; index += 1) {
        desiredBalls.add(ballRecords[index]);
      }
    }

    if (primaryDelta > 0.012) {
      for (let index = minSelectedIndex; index < ballRecords.length; index += 1) {
        desiredBalls.add(ballRecords[index]);
      }
    }

    return desiredBalls;
  }

  function endDragGroup() {
    for (const ball of activeDragBalls) {
      onBallDragEnd(ball);
      ball.groupDragStartAngle = undefined;
    }

    primaryDragBall = null;
    activeDragBalls = [];
    controls.enabled = true;
    onStatusChange?.('released');
  }

  function selectOnlyBall(ball) {
    clearSelection();
    addBallToSelection(ball);
  }

  function toggleBallSelection(ball) {
    if (selectedBalls.has(ball)) {
      removeBallFromSelection(ball);
      return;
    }

    addBallToSelection(ball);
  }

  function addBallToSelection(ball) {
    selectedBalls.add(ball);
    ball.isSelected = true;
    applyBallVisualState(ball);
  }

  function removeBallFromSelection(ball) {
    selectedBalls.delete(ball);
    ball.isSelected = false;
    applyBallVisualState(ball);
  }

  function clearSelection() {
    for (const ball of selectedBalls) {
      ball.isSelected = false;
      applyBallVisualState(ball);
    }

    selectedBalls.clear();
  }

  function handlePointerDown(event) {
    updatePointerFromEvent(event);
    raycaster.setFromCamera(pointer, camera);

    const intersections = raycaster.intersectObjects(draggableMeshes, false);

    if (intersections.length === 0) {
      if (!event.shiftKey && !event.ctrlKey && !event.metaKey) {
        clearSelection();
      }

      return;
    }

    const clickedBall = intersections[0].object.userData.ballRecord;

    if (event.shiftKey || event.ctrlKey || event.metaKey) {
      toggleBallSelection(clickedBall);
      syncVisuals();
      return;
    }

    if (!selectedBalls.has(clickedBall)) {
      selectOnlyBall(clickedBall);
    }

    renderer.domElement.setPointerCapture(event.pointerId);
    startDragGroup(clickedBall);
  }

  function handlePointerMove(event) {
    if (!primaryDragBall) {
      return;
    }

    updatePointerFromEvent(event);
    raycaster.setFromCamera(pointer, camera);

    if (!raycaster.ray.intersectPlane(dragPlane, dragPoint)) {
      return;
    }

    moveDragGroup(dragPoint);
    syncVisuals();
    onStatusChange?.('dragging');
  }

  function handlePointerUp(event) {
    if (!primaryDragBall) {
      return;
    }

    endDragGroup();

    if (renderer.domElement.hasPointerCapture(event.pointerId)) {
      renderer.domElement.releasePointerCapture(event.pointerId);
    }
  }

  function updatePointerFromEvent(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
  }

  function resizeRenderer() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function exposeDebugState() {
    if (!import.meta.env.DEV) {
      return;
    }

    window.__newtonsCradleDebug = {
      getBalls: () =>
        ballRecords.map((ball) => {
          const position = getCurrentPosition(ball);

          return {
            index: ball.index,
            angle: ball.angle,
            angularVelocity: ball.angularVelocity,
            isSelected: ball.isSelected,
            x: position.x,
            y: position.y,
          };
        }),
      getScreenBalls: () =>
        ballRecords.map((ball) => {
          const position = getCurrentPosition(ball).project(camera);

          return {
            index: ball.index,
            isSelected: ball.isSelected,
            x: (position.x * 0.5 + 0.5) * renderer.domElement.clientWidth,
            y: (-position.y * 0.5 + 0.5) * renderer.domElement.clientHeight,
          };
        }),
      setBall: (index, angle, angularVelocity = 0) => {
        const ball = ballRecords[index];

        if (!ball) {
          return;
        }

        ball.angle = THREE.MathUtils.clamp(angle, -MAX_SWING_ANGLE, MAX_SWING_ANGLE);
        ball.angularVelocity = angularVelocity;
        syncVisuals();
      },
      step: (seconds = 1) => {
        const steps = Math.ceil(seconds / FIXED_TIME_STEP);

        for (let index = 0; index < steps; index += 1) {
          stepCradlePhysics(FIXED_TIME_STEP);
        }

        syncVisuals();
      },
    };
  }

  renderer.domElement.addEventListener('pointerdown', handlePointerDown);
  window.addEventListener('pointermove', handlePointerMove);
  window.addEventListener('pointerup', handlePointerUp);
  window.addEventListener('pointercancel', handlePointerUp);
  window.addEventListener('resize', resizeRenderer);
  resizeRenderer();

  return {
    animate,
    createCradle,
    resetExperiment,
    updateMaterial,
  };
}

function createLights(scene) {
  const ambientLight = new THREE.AmbientLight(0x7aa9c7, 0.38);
  const keyLight = new THREE.DirectionalLight(0xd8f8ff, 2.1);
  const rimLight = new THREE.PointLight(0x20d7ee, 35, 18);
  const fillLight = new THREE.PointLight(0x6c8dff, 12, 12);

  keyLight.position.set(-3.5, 7, 4.5);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.width = 2048;
  keyLight.shadow.mapSize.height = 2048;

  rimLight.position.set(4.5, 3.2, -3.6);
  fillLight.position.set(-4, 2.4, 5);

  scene.add(ambientLight, keyLight, rimLight, fillLight);
}

function createLaboratoryBase(scene) {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(18, 12),
    new THREE.MeshStandardMaterial({
      color: 0x07111a,
      roughness: 0.82,
      metalness: 0.14,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const grid = new THREE.GridHelper(16, 32, 0x2fe4ff, 0x183545);
  grid.position.y = 0.012;

  for (const material of normalizeMaterials(grid.material)) {
    material.transparent = true;
    material.opacity = 0.22;
  }

  scene.add(grid);
}

function getCradleDimensions(ballCount) {
  return {
    width: Math.max(5, ballCount * BALL_DIAMETER + 1.7),
    depth: 1.25,
    topY: 3.05,
    baseY: 0.08,
    stringLength: 2.12,
    stringSpread: 0.18,
    ballSpacing: BALL_DIAMETER,
  };
}

function getCurrentPosition(ball) {
  return getPendulumPosition(ball.centerAnchor, ball.stringLength, ball.angle);
}

function getPendulumPosition(anchor, length, angle) {
  return new THREE.Vector3(
    anchor.x + Math.sin(angle) * length,
    anchor.y - Math.cos(angle) * length,
    0,
  );
}

function getVelocityVector(ball) {
  const tangentialSpeed = ball.stringLength * ball.angularVelocity;

  return {
    x: Math.cos(ball.angle) * tangentialSpeed,
    y: Math.sin(ball.angle) * tangentialSpeed,
  };
}

function setNormalVelocity(ball, normal, normalVelocity) {
  const tangent = {
    x: Math.cos(ball.angle),
    y: Math.sin(ball.angle),
  };
  const alignment = tangent.x * normal.x + tangent.y * normal.y;

  if (Math.abs(alignment) < 0.18) {
    return;
  }

  const tangentialSpeed = normalVelocity / alignment;
  ball.angularVelocity = THREE.MathUtils.clamp(
    tangentialSpeed / ball.stringLength,
    -7.5,
    7.5,
  );
}

function setBallX(ball, nextX) {
  const normalizedX = THREE.MathUtils.clamp(
    (nextX - ball.centerAnchor.x) / ball.stringLength,
    -Math.sin(MAX_SWING_ANGLE),
    Math.sin(MAX_SWING_ANGLE),
  );

  ball.angle = Math.asin(normalizedX);
}

function getBallStringPoint(ballPosition, anchorPoint) {
  const directionToAnchor = anchorPoint.clone().sub(ballPosition).normalize();
  return ballPosition.clone().add(directionToAnchor.multiplyScalar(BALL_RADIUS * 0.92));
}

function updateStringBetweenPoints(stringMesh, startPoint, endPoint) {
  const direction = endPoint.clone().sub(startPoint);
  const length = direction.length();

  stringMesh.position.copy(startPoint).add(endPoint).multiplyScalar(0.5);
  stringMesh.scale.set(1, length, 1);
  stringMesh.quaternion.setFromUnitVectors(upAxis, direction.normalize());
}

function disposeObject(object) {
  object.traverse((child) => {
    if (child.geometry) {
      child.geometry.dispose();
    }

    for (const material of normalizeMaterials(child.material)) {
      material.dispose();
    }
  });
}

function normalizeMaterials(material) {
  if (!material) {
    return [];
  }

  return Array.isArray(material) ? material : [material];
}
