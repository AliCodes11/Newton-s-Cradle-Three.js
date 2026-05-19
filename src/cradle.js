import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { normalizeExperimentConfig } from './config.js';

const FIXED_TIME_STEP = 1 / 120;
const MAX_STEPS_PER_FRAME = 8;
const DRAG_ANGLE_LIMIT = 0.95;
const MAX_SWING_ANGLE = 1.18;
const ANGULAR_DAMPING = 0.018;
const COLLISION_RESTITUTION = 0.985;
const CONTACT_SLOP = 0.012;
const MIN_IMPACT_SPEED = 0.035;
const SELECTED_EMISSIVE = 0x064a57;
const DRAGGING_EMISSIVE = 0x0a5060;
const RESTING_BALL_GAP = 0.015;
const FRAME_MARGIN = 0.8;

const pointer = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const dragPoint = new THREE.Vector3();
const upAxis = new THREE.Vector3(0, 1, 0);

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

export function createBall(materialType, radius, mass) {
  const geometry = new THREE.SphereGeometry(radius, 56, 36);
  const material = updateMaterial(materialType);
  const ball = new THREE.Mesh(geometry, material);

  ball.castShadow = true;
  ball.receiveShadow = true;
  ball.userData = {
    materialType,
    radius,
    mass,
    isCradleBall: true,
  };

  return ball;
}

export function createString(startPoint, endPoint, ballRadius) {
  const stringRadius = THREE.MathUtils.clamp(ballRadius * 0.035, 0.012, 0.028);
  const geometry = new THREE.CylinderGeometry(stringRadius, stringRadius, 1, 12);
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
  let cradleDimensions = null;
  let animationFrameId = null;
  let primaryDragBall = null;
  let lastFrameTime = 0;
  let accumulatedTime = 0;
  let gravityAcceleration = 9.82;
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
    const normalizedConfig = normalizeExperimentConfig(config);

    clearCradle();
    gravityAcceleration = normalizedConfig.gravityAcceleration;

    const dimensions = getCradleDimensions(normalizedConfig);
    cradleDimensions = dimensions;
    cradleGroup = new THREE.Group();
    cradleGroup.add(createFrame(dimensions));

    for (let index = 0; index < normalizedConfig.ballCount; index += 1) {
      const baseX = dimensions.ballCenters[index];
      const ballRecord = createBallAssembly(normalizedConfig, dimensions, baseX, index);

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
    const ballConfig = config.balls[index];
    const mass = ballConfig.mass;
    const radius = ballConfig.radius;
    const stringLength = ballConfig.stringLength;
    const stringSpread = getStringSpread(radius);
    const centerAnchor = new THREE.Vector3(baseX, dimensions.topY, 0);
    const leftAnchor = new THREE.Vector3(baseX - stringSpread, dimensions.topY, 0);
    const rightAnchor = new THREE.Vector3(baseX + stringSpread, dimensions.topY, 0);
    const ballStart = getPendulumPosition(centerAnchor, stringLength, 0);
    const mesh = createBall(config.materialType, radius, mass);
    const leftString = createString(leftAnchor, ballStart, radius);
    const rightString = createString(rightAnchor, ballStart, radius);
    const ballRecord = {
      index,
      mass,
      radius,
      mesh,
      leftString,
      rightString,
      leftAnchor,
      rightAnchor,
      centerAnchor,
      stringLength,
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
      cradleDimensions = null;
      return;
    }

    scene.remove(cradleGroup);
    disposeObject(cradleGroup);
    cradleGroup = null;
    cradleDimensions = null;
  }

  function focusCameraOnCradle(dimensions) {
    const targetY = dimensions.topY * 0.46;
    const distance = Math.max(8.2, dimensions.width * 0.72, dimensions.topY * 2.05);

    camera.position.set(0, targetY + 1.45, distance);
    controls.target.set(0, targetY, 0);
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
        -(gravityAcceleration / ball.stringLength) * Math.sin(ball.angle) -
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
    const contactDistance = leftBall.radius + rightBall.radius;

    if (distance <= 0 || distance > contactDistance + CONTACT_SLOP) {
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

    separateOverlappingPair(
      leftBall,
      rightBall,
      distance,
      contactDistance,
      leftPosition,
      rightPosition,
    );

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

  function separateOverlappingPair(
    leftBall,
    rightBall,
    distance,
    contactDistance,
    leftPosition,
    rightPosition,
  ) {
    const overlap = contactDistance - distance;

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
        getBallStringPoint(position, ballRecord.leftAnchor, ballRecord.radius),
      );
      updateStringBetweenPoints(
        ballRecord.rightString,
        ballRecord.rightAnchor,
        getBallStringPoint(position, ballRecord.rightAnchor, ballRecord.radius),
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
      getGravity: () => gravityAcceleration,
      getBalls: () =>
        ballRecords.map((ball) => {
          const position = getCurrentPosition(ball);

          return {
            index: ball.index,
            angle: ball.angle,
            angularVelocity: ball.angularVelocity,
            isSelected: ball.isSelected,
            mass: ball.mass,
            radius: ball.radius,
            stringLength: ball.stringLength,
            x: position.x,
            y: position.y,
          };
        }),
      getCarrier: () => ({ ...cradleDimensions }),
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
    updateCradleConfig: createCradle,
    updateMaterial,
  };
}

function createLights(scene) {
  const ambientLight = new THREE.AmbientLight(0x7aa9c7, 0.38);
  const keyLight = new THREE.DirectionalLight(0xd8f8ff, 2.1);
  const rimLight = new THREE.PointLight(0x20d7ee, 35, 18);
  const fillLight = new THREE.PointLight(0x6c8dff, 12, 12);
  const warmBenchLight = new THREE.PointLight(0xffb45f, 18, 18);

  keyLight.position.set(-3.5, 7, 4.5);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.width = 2048;
  keyLight.shadow.mapSize.height = 2048;

  rimLight.position.set(4.5, 3.2, -3.6);
  fillLight.position.set(-4, 2.4, 5);
  warmBenchLight.position.set(-5.5, 1.2, -4.2);

  scene.add(ambientLight, keyLight, rimLight, fillLight, warmBenchLight);
}

function createLaboratoryBase(scene) {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(48, 24),
    new THREE.MeshStandardMaterial({
      color: 0x07111a,
      roughness: 0.82,
      metalness: 0.14,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const grid = new THREE.GridHelper(46, 46, 0x2fe4ff, 0x183545);
  grid.position.y = 0.012;

  for (const material of normalizeMaterials(grid.material)) {
    material.transparent = true;
    material.opacity = 0.22;
  }

  scene.add(grid);
  createLaboratoryBackdrop(scene);
  createFloorInlays(scene);
}

function createLaboratoryBackdrop(scene) {
  const backdrop = new THREE.Group();
  const wallMaterial = new THREE.MeshStandardMaterial({
    color: 0x071421,
    roughness: 0.9,
    metalness: 0.06,
  });
  const panelMaterial = new THREE.MeshStandardMaterial({
    color: 0x0b2432,
    roughness: 0.78,
    metalness: 0.12,
    transparent: true,
    opacity: 0.72,
  });
  const lineMaterial = new THREE.LineBasicMaterial({
    color: 0x2fe4ff,
    transparent: true,
    opacity: 0.24,
  });
  const warmLineMaterial = new THREE.MeshStandardMaterial({
    color: 0xffad55,
    roughness: 0.42,
    metalness: 0.25,
    emissive: 0x5c2604,
    emissiveIntensity: 0.35,
    transparent: true,
    opacity: 0.68,
  });

  const wall = new THREE.Mesh(new THREE.PlaneGeometry(52, 15), wallMaterial);
  wall.position.set(0, 6.2, -6.3);
  wall.receiveShadow = true;
  backdrop.add(wall);

  for (const x of [-18, -9, 0, 9, 18]) {
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(7.4, 7.8), panelMaterial);
    panel.position.set(x, 5.4, -6.24);
    backdrop.add(panel);
    backdrop.add(createPanelOutline(x, 5.4, -6.2, 7.4, 7.8, lineMaterial));
  }

  for (const y of [1.45, 3.4, 5.35, 7.3, 9.25]) {
    const guide = createLine(
      [
        new THREE.Vector3(-24, y, -6.18),
        new THREE.Vector3(24, y, -6.18),
      ],
      lineMaterial,
    );
    backdrop.add(guide);
  }

  const benchLight = new THREE.Mesh(new THREE.PlaneGeometry(44, 0.08), warmLineMaterial);
  benchLight.position.set(0, 0.72, -6.12);
  backdrop.add(benchLight);

  const topRail = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, 44, 18),
    warmLineMaterial,
  );
  topRail.rotation.z = Math.PI / 2;
  topRail.position.set(0, 9.7, -6.05);
  backdrop.add(topRail);

  addMeasurementScale(backdrop);
  scene.add(backdrop);
}

function createPanelOutline(x, y, z, width, height, material) {
  const halfWidth = width / 2;
  const halfHeight = height / 2;

  return createLine(
    [
      new THREE.Vector3(x - halfWidth, y - halfHeight, z),
      new THREE.Vector3(x + halfWidth, y - halfHeight, z),
      new THREE.Vector3(x + halfWidth, y + halfHeight, z),
      new THREE.Vector3(x - halfWidth, y + halfHeight, z),
      new THREE.Vector3(x - halfWidth, y - halfHeight, z),
    ],
    material,
  );
}

function addMeasurementScale(group) {
  const scaleMaterial = new THREE.MeshStandardMaterial({
    color: 0xb7f8ff,
    roughness: 0.28,
    metalness: 0.48,
    emissive: 0x082c34,
    emissiveIntensity: 0.22,
  });
  const majorTickMaterial = new THREE.MeshStandardMaterial({
    color: 0xffc072,
    roughness: 0.36,
    metalness: 0.24,
    emissive: 0x4a2203,
    emissiveIntensity: 0.28,
  });

  const x = -10.8;
  const z = -6.02;
  const scaleBar = new THREE.Mesh(new THREE.BoxGeometry(0.035, 8.2, 0.035), scaleMaterial);
  scaleBar.position.set(x, 4.7, z);
  group.add(scaleBar);

  for (let index = 0; index <= 16; index += 1) {
    const isMajor = index % 2 === 0;
    const tick = new THREE.Mesh(
      new THREE.BoxGeometry(isMajor ? 0.58 : 0.32, 0.025, 0.03),
      isMajor ? majorTickMaterial : scaleMaterial,
    );
    tick.position.set(x + (isMajor ? 0.29 : 0.16), 0.6 + index * 0.5, z);
    group.add(tick);
  }
}

function createFloorInlays(scene) {
  const railMaterial = new THREE.MeshStandardMaterial({
    color: 0xffb45f,
    roughness: 0.38,
    metalness: 0.35,
    emissive: 0x462003,
    emissiveIntensity: 0.25,
    transparent: true,
    opacity: 0.74,
  });
  const blueRailMaterial = new THREE.MeshStandardMaterial({
    color: 0x2fe4ff,
    roughness: 0.34,
    metalness: 0.32,
    emissive: 0x042b33,
    emissiveIntensity: 0.2,
    transparent: true,
    opacity: 0.5,
  });

  for (const x of [-6.2, 6.2]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.015, 18), railMaterial);
    rail.position.set(x, 0.026, -0.6);
    scene.add(rail);
  }

  for (const z of [-4.5, -1.5, 1.5, 4.5]) {
    const crossRail = new THREE.Mesh(new THREE.BoxGeometry(16, 0.012, 0.035), blueRailMaterial);
    crossRail.position.set(0, 0.028, z);
    scene.add(crossRail);
  }
}

function createLine(points, material) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points);

  return new THREE.Line(geometry, material);
}

function getCradleDimensions(config) {
  const layout = getRestingBallLayout(config.balls);
  const maxRadius = Math.max(...config.balls.map((ball) => ball.radius));
  const maxSwingReach = Math.max(
    ...config.balls.map((ball) => ball.stringLength * Math.sin(MAX_SWING_ANGLE) + ball.radius),
  );
  const deepestRestDrop = Math.max(
    ...config.balls.map((ball) => ball.stringLength + ball.radius),
  );
  const envelopeWidth =
    layout.maxCenterX - layout.minCenterX + maxSwingReach * 2 + FRAME_MARGIN;
  const depth = Math.max(1.25, maxRadius * 3.25 + 0.55);
  const baseY = 0.08;

  return {
    width: Math.max(5, envelopeWidth),
    depth,
    topY: Math.max(3.05, baseY + deepestRestDrop + 0.36),
    baseY,
    ballCenters: layout.centers,
  };
}

function getRestingBallLayout(balls) {
  const totalSpan =
    balls.reduce((sum, ball) => sum + ball.radius * 2, 0) +
    Math.max(0, balls.length - 1) * RESTING_BALL_GAP;
  const centers = [];
  let cursor = -totalSpan / 2;

  for (const ball of balls) {
    cursor += ball.radius;
    centers.push(cursor);
    cursor += ball.radius + RESTING_BALL_GAP;
  }

  return {
    centers,
    minCenterX: centers[0] ?? 0,
    maxCenterX: centers[centers.length - 1] ?? 0,
    totalSpan,
  };
}

function getStringSpread(radius) {
  return THREE.MathUtils.clamp(radius * 0.48, 0.16, 0.68);
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

function getBallStringPoint(ballPosition, anchorPoint, radius) {
  const directionToAnchor = anchorPoint.clone().sub(ballPosition).normalize();
  return ballPosition.clone().add(directionToAnchor.multiplyScalar(radius * 0.92));
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
