let scene, camera, renderer, world;
let dice1, dice2, diceBody1, diceBody2;
const boxSize = 10;
let isSimulating = false;
let rollCount = 0;
let lastMovementTime = 0;
let diceResults = Array(6).fill().map(() => Array(6).fill(0));

function init() {
    createResultMatrix();
    initThreeJS();
    initCannon();
    createDice();
    createBoundingBox();
    createGroundPlane();

    document.addEventListener('click', rollDice);
    document.addEventListener('touchstart', rollDice);
    document.getElementById('simulateButton').addEventListener('click', startSimulation);

    let tapCount = 0;
    let lastTapTime = 0;
    let clickCount = 0;
    let lastClickTime = 0;

    document.addEventListener('touchend', (e) => {
        const currentTime = new Date().getTime();
        const tapLength = currentTime - lastTapTime;
        if (tapLength < 500 && tapLength > 0) {
            tapCount++;
            if (tapCount == 3) {
                document.getElementById('simulateButton').style.display = 'block';
                tapCount = 0;
            }
        } else {
            tapCount = 1;
        }
        lastTapTime = currentTime;
    });

    document.addEventListener('click', (e) => {
        const currentTime = new Date().getTime();
        const clickLength = currentTime - lastClickTime;
        if (clickLength < 500 && clickLength > 0) {
            clickCount++;
            if (clickCount == 3) {
                document.getElementById('simulateButton').style.display = 'block';
                clickCount = 0;
            }
        } else {
            clickCount = 1;
        }
        lastClickTime = currentTime;
    });

    animate();
}

function initThreeJS() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById('container').appendChild(renderer.domElement);

    camera.position.set(0, 20, 0);
    camera.lookAt(0, 0, 0);

    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(0, 20, 0);
    light.castShadow = true;
    light.shadow.mapSize.width = 2048;
    light.shadow.mapSize.height = 2048;
    light.shadow.camera.near = 1;
    light.shadow.camera.far = 50;
    light.shadow.camera.left = -15;
    light.shadow.camera.right = 15;
    light.shadow.camera.top = 15;
    light.shadow.camera.bottom = -15;
    scene.add(light);

    // Helper to visualize light position and shadow camera (uncomment for debugging)
    // const helper = new THREE.CameraHelper(light.shadow.camera);
    // scene.add(helper);

    const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
    scene.add(ambientLight);
}

function initCannon() {
    world = new CANNON.World();
    world.gravity.set(0, -9.82, 0);
}

function createDiceTexture(number, color) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const context = canvas.getContext('2d');

    context.fillStyle = color;
    context.fillRect(0, 0, 128, 128);

    context.font = 'bold 64px Arial';
    context.fillStyle = 'black';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(number.toString(), 64, 64);

    return new THREE.CanvasTexture(canvas);
}

function createDice() {
    const diceGeometry = new THREE.BoxGeometry(2, 2, 2);
    const redDiceMaterials = [1, 6, 2, 5, 3, 4].map(num => 
        new THREE.MeshPhongMaterial({ map: createDiceTexture(num, 'rgba(255, 200, 200, 0.8)') })
    );
    const yellowDiceMaterials = [1, 6, 2, 5, 3, 4].map(num => 
        new THREE.MeshPhongMaterial({ map: createDiceTexture(num, 'rgba(255, 255, 200, 0.8)') })
    );

    dice1 = new THREE.Mesh(diceGeometry, redDiceMaterials);
    dice2 = new THREE.Mesh(diceGeometry, yellowDiceMaterials);
    dice1.castShadow = true;
    dice2.castShadow = true;
    dice1.receiveShadow = true;
    dice2.receiveShadow = true;
    scene.add(dice1);
    scene.add(dice2);

    const diceShape = new CANNON.Box(new CANNON.Vec3(1, 1, 1));
    const diceOptions = {
        mass: 0.3,
        shape: diceShape,
        material: new CANNON.Material({ restitution: 0.8 })
    };
    diceBody1 = new CANNON.Body(diceOptions);
    diceBody2 = new CANNON.Body(diceOptions);
    world.addBody(diceBody1);
    world.addBody(diceBody2);
}


function createBoundingBox() {
    // Visual bounding box (commented out to hide)
    // const boxGeometry = new THREE.BoxGeometry(boxSize, boxSize, boxSize);
    // const boxMaterial = new THREE.MeshBasicMaterial({ color: 0x888888, wireframe: true });
    // const boxMesh = new THREE.Mesh(boxGeometry, boxMaterial);
    // scene.add(boxMesh);

    // Floor
    const floorShape = new CANNON.Plane();
    const floorBody = new CANNON.Body({ mass: 0 });
    floorBody.addShape(floorShape);
    floorBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    world.addBody(floorBody);

    // Walls
    const wallShape = new CANNON.Plane();
    const wallPositions = [
        { pos: [0, boxSize/2, -boxSize/2], rot: [0, 0, 0] },
        { pos: [0, boxSize/2, boxSize/2], rot: [0, Math.PI, 0] },
        { pos: [-boxSize/2, boxSize/2, 0], rot: [0, Math.PI/2, 0] },
        { pos: [boxSize/2, boxSize/2, 0], rot: [0, -Math.PI/2, 0] },
        { pos: [0, boxSize, 0], rot: [Math.PI/2, 0, 0] }
    ];

    wallPositions.forEach(wall => {
        const wallBody = new CANNON.Body({ mass: 0 });
        wallBody.addShape(wallShape);
        wallBody.position.set(...wall.pos);
        wallBody.quaternion.setFromEuler(...wall.rot);
        world.addBody(wallBody);
    });
}

async function getSecureRandomNumbers(count) {
    const array = new Uint32Array(count);
    crypto.getRandomValues(array);
    return Array.from(array).map(val => val / (0xffffffff + 1));
}

async function rollDice(isSimulation = false) {
    if (!isSimulation && isSimulating) return;
    const keys = await getSecureRandomNumbers(10);

    diceBody1.position.set(-2, boxSize/2, 0);
    diceBody2.position.set(2, boxSize/2, 0);

    diceBody1.velocity.set((keys[0] - 0.5) * 15, 8, (keys[1] - 0.5) * 15);
    diceBody2.velocity.set((keys[2] - 0.5) * 15, 8, (keys[3] - 0.5) * 15);

    diceBody1.angularVelocity.set((keys[4] - 0.5) * 30, (keys[5] - 0.5) * 30, (keys[6] - 0.5) * 30);
    diceBody2.angularVelocity.set((keys[7] - 0.5) * 30, (keys[8] - 0.5) * 30, (keys[9] - 0.5) * 30);
}

function animate() {
    requestAnimationFrame(animate);

    world.step(1 / 60);

    dice1.position.copy(diceBody1.position);
    dice1.quaternion.copy(diceBody1.quaternion);

    dice2.position.copy(diceBody2.position);
    dice2.quaternion.copy(diceBody2.quaternion);

    renderer.render(scene, camera);

    if (isSimulating) {
        checkDiceMovement();
    }
}

function createGroundPlane() {
    const planeGeometry = new THREE.PlaneGeometry(100, 100);
    const planeMaterial = new THREE.MeshPhongMaterial({ color: 0x888888, side: THREE.DoubleSide });
    const planeMesh = new THREE.Mesh(planeGeometry, planeMaterial);
    planeMesh.rotation.x = -Math.PI / 2;
    planeMesh.position.y = -boxSize / 2 + 0.01; // Slightly above the floor to prevent z-fighting
    planeMesh.receiveShadow = true;
    scene.add(planeMesh);
}

function checkDiceMovement() {
    const currentTime = Date.now();
    const velocity1 = diceBody1.velocity.length();
    const velocity2 = diceBody2.velocity.length();
    const angularVelocity1 = diceBody1.angularVelocity.length();
    const angularVelocity2 = diceBody2.angularVelocity.length();

    if (velocity1 < 0.1 && velocity2 < 0.1 && angularVelocity1 < 0.1 && angularVelocity2 < 0.1) {
        if (currentTime - lastMovementTime > 1000) {
            const result1 = getDiceResult(dice1);
            const result2 = getDiceResult(dice2);
            diceResults[result1 - 1][result2 - 1]++;
            updateResultMatrix();
            
            rollCount++;
            if (rollCount < 10000) {
                rollDice(true);
            } else {
                isSimulating = false;
                rollCount = 0;
                document.getElementById('simulateButton').disabled = false;
                document.getElementById('simulateButton').textContent = 'Simulate 10000 Rolls';
                console.log("Simulation complete. Final results:", diceResults);
            }
        }
    } else {
        lastMovementTime = currentTime;
    }
}

function getDiceResult(dice) {
    const up = new THREE.Vector3(0, 1, 0);  // This is correct, as Y is up in our scene
    const faceNormals = [
        new THREE.Vector3(1, 0, 0),   // right face (1)
        new THREE.Vector3(-1, 0, 0),  // left face (6)
        new THREE.Vector3(0, 1, 0),   // top face (2)
        new THREE.Vector3(0, -1, 0),  // bottom face (5)
        new THREE.Vector3(0, 0, 1),   // front face (3)
        new THREE.Vector3(0, 0, -1)   // back face (4)
    ];

    const rotationMatrix = new THREE.Matrix4().makeRotationFromQuaternion(dice.quaternion);
    let maxDot = -Infinity;
    let result = 0;

    faceNormals.forEach((normal, index) => {
        normal.applyMatrix4(rotationMatrix);
        const dot = normal.dot(up);
        if (dot > maxDot) {
            maxDot = dot;
            result = [1, 6, 2, 5, 3, 4][index];
        }
    });

    console.log(`Dice result: ${result}, Max dot product: ${maxDot.toFixed(4)}`);
    return result;
}

async function startSimulation() {
    if (isSimulating) return;
    isSimulating = true;
    rollCount = 0;
    diceResults = Array(6).fill().map(() => Array(6).fill(0));
    document.getElementById('simulateButton').disabled = true;
    document.getElementById('resultMatrix').style.display = 'block';
    document.getElementById('fairnessMetric').style.display = 'block';
    document.getElementById('simulateButton').textContent = 'Simulating 10000 Rolls...';
    await rollDice(true);
}

function createResultMatrix() {
    const matrix = document.getElementById('resultMatrix');
    const table = document.createElement('table');
    
    for (let i = 0; i <= 6; i++) {
        const row = document.createElement('tr');
        for (let j = 0; j <= 6; j++) {
            const cell = document.createElement('td');
            if (i === 0 && j === 0) {
                cell.textContent = 'R\\Y';
            } else if (i === 0) {
                cell.textContent = j;
            } else if (j === 0) {
                cell.textContent = i;
            } else {
                cell.id = `cell-${i}-${j}`;
            }
            cell.style.backgroundColor = 'gray';
            row.appendChild(cell);
        }
        table.appendChild(row);
    }
    
    matrix.appendChild(table);
}

function updateResultMatrix() {
    for (let i = 1; i <= 6; i++) {
        for (let j = 1; j <= 6; j++) {
            const cell = document.getElementById(`cell-${i}-${j}`);
            cell.textContent = diceResults[i-1][j-1];
        }
    }
    updateChiSquaredStatistic();
}

function calculateChiSquared() {
    const totalRolls = diceResults.flat().reduce((a, b) => a + b, 0);
    const expectedFrequency = totalRolls / 36;
    let chiSquared = 0;

    for (let i = 0; i < 6; i++) {
        for (let j = 0; j < 6; j++) {
            const observed = diceResults[i][j];
            chiSquared += Math.pow(observed - expectedFrequency, 2) / expectedFrequency;
        }
    }

    return chiSquared;
}

function updateChiSquaredStatistic() {
    const chiSquared = calculateChiSquared();
    const fairnessMetric = document.getElementById('fairnessMetric');
    fairnessMetric.textContent = `Chi-squared statistic: ${chiSquared.toFixed(2)}`;

    // Interpret the result
    const degreesOfFreedom = 35; // (6 * 6) - 1
    const criticalValue = 49.80; // 95% confidence level for 35 degrees of freedom
    
    if (chiSquared < criticalValue) {
        fairnessMetric.style.color = 'green';
        fairnessMetric.textContent += ' (Dice appear fair)';
    } else {
        fairnessMetric.style.color = 'red';
        fairnessMetric.textContent += ' (Dice may not be fair)';
    }
}

init();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
