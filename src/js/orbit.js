import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
// import { AsciiEffect } from 'three/examples/jsm/effects/AsciiEffect.js';
import * as satellite from 'satellite.js';
import Stats from 'stats.js'
import { createNoise2D } from 'simplex-noise';
// import { Earcut } from 'three/src/extras/Earcut.js';
import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls.js';
import { FirstPersonControls } from 'three/examples/jsm/controls/FirstPersonControls.js';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';
import { FlyControls } from 'three/examples/jsm/controls/FlyControls.js';

//

// 'W' key toggles wireframe
// 'R' key toggles rotation

export function orbitalView(containerId, onSatelliteLoadComplete) {
    let scene, camera, renderer, controls, pivot, moonPivot, sunMesh;
    let animationFrameId;
    let tleArray = [];
    let sunLine;
    let satrec;
    let filterVisible;

    let orbitControls, mapControls, firstPersonControls, trackballControls, flyControls;


    let currentChapter = 'smallScale'; // Default chapter
    let lastLat, lastLon;



    // toggle defaults
    let isRotationEnabled = true;
    let wireframe = false;


    // const raycaster = new THREE.Raycaster();
    // const cameraDirection = new THREE.Vector3();

    let classificationSchemes;
    let activeScheme = 'group_major'; // Default color scheme
    let filteredClass = null; // Holds the currently active filter


    // responsive stuff
    const baseZ = 66; // default z-position value for desktop

    const mobileScaleFactor = 2; // responsive camera
    
    let directionalLight;
    let sphere; // Global reference to the sphere

    const earthRadiusKm = 6371; // Earth's radius in kilometers
    const sphereRadius = 1; // Earth’s radius as 1 unit in Three.js
    const scaleFactor = sphereRadius / earthRadiusKm; // Base scaling factor for consistency
    // const scaleBarLengthKm = sphereRadius * earthRadiusKm;

    
    const earthRotationSpeed = (2 * Math.PI) / 86400; // Earth rotation speed in radians per second
    const earthTilt = 23.44 * (Math.PI / 180); // Convert 23.4 degrees to radians
    // const earthTilt = 0; // troubleshooting

    const moonOrbitalPeriodInSeconds = 27.32 * 24 * 3600; // 27.32 days in seconds
    const moonAngularSpeed = (2 * Math.PI) / moonOrbitalPeriodInSeconds; // Moon orbit speed in radians per second
    

    // const planets = [];
    let distanceCompressionFactor = 1; // Initial v exaggeration factor

    let moonMesh;

    // stats
    const stats = new Stats()
    stats.showPanel(0) // 0: fps, 1: ms, 2: mb, 3+: custom
    // document.body.appendChild(stats.dom)
    stats.dom.id = 'statistics';

    window.addEventListener('keydown', (event) => {
        if (event.key === 'R' || event.key === 'r') {
            isRotationEnabled = !isRotationEnabled;
        }
    });

    window.addEventListener('keydown', (event) => {
        if (event.key === 'W' || event.key === 'w') {
            wireframe = !wireframe;
            pivot.traverse(function (child) {
                if (child.isMesh) {
                    child.material.wireframe = wireframe;
                    child.material.needsUpdate = true;
                }
            });
        }
    });

    function initControls() {
        // Initialize OrbitControls small scale
        orbitControls = new OrbitControls(camera, renderer.domElement);
        orbitControls.enableDamping = true;
        orbitControls.enablePan = false;
        orbitControls.dampingFactor = 0.25;
        // orbitControls.zoomSpeed = 0.5;
        orbitControls.rotateSpeed = 0.25;
        orbitControls.minDistance = 5;
        orbitControls.maxDistance = 100;

        // Trackball option large scale
        trackballControls = new TrackballControls(camera, renderer.domElement);
        trackballControls.rotateSpeed = 1.25;
        trackballControls.panSpeed = 0.2;
        trackballControls.noZoom = false;
        trackballControls.noPan = false;
        // trackballControls.noRotate = true;
        trackballControls.staticMoving = false;
        trackballControls.dynamicDampingFactor = 0.33;    
        

        
    
        // Initialize MapControls 
        mapControls = new MapControls(camera, renderer.domElement);
        // mapControls.enableDamping = true;
        // mapControls.dampingFactor = 0.3;
        // mapControls.zoomSpeed = 0.5;
        // mapControls.enableRotate = true;
        // mapControls.minDistance = 1;
        // mapControls.maxDistance = 50;

    
        // Initialize FirstPersonControls (for fixed)
        firstPersonControls = new FirstPersonControls(camera, renderer.domElement);
        firstPersonControls.lookSpeed = 0.1;
        firstPersonControls.movementSpeed = 5;
        firstPersonControls.noFly = true;
        firstPersonControls.lookVertical = true;

        // flycontrol option
        flyControls = new FlyControls(camera, renderer.domElement);
        // flyControls.movementSpeed = 100; // Adjust for smooth movement
        // flyControls.rollSpeed = Math.PI / 24;
        // flyControls.autoForward = false;
        // flyControls.dragToLook = true;
        
        // Start with OrbitControls enabled
        enableControls(orbitControls);
    }
    
    function enableControls(activeControls) {
        // Disable all controls by default
        orbitControls.enabled = false;
        mapControls.enabled = false;
        firstPersonControls.enabled = false;
        flyControls.enabled = false;
        trackballControls.enabled = false; 
    
        // actively enable the specified controls
        if (activeControls) {
            activeControls.enabled = true;
        }
    }
            

    async function init() {
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(5, window.innerWidth / window.innerHeight, 0.1, 300000);
    
        camera.position.set(0, 0, 800);
        camera.position.z = 66;
    
        renderer = new THREE.WebGLRenderer({ alpha: false });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setClearColor(0xC0C0C0, 0);
    
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
        document.getElementById(containerId).appendChild(renderer.domElement);

        initControls();



        // Responsive z-position initialization
        setResponsiveCameraPosition();

    
        // controls = new OrbitControls(camera, renderer.domElement);
        // controls.enableDamping = true;
        // controls.enableZoom = true;
        // controls.enablePan = false;
        // controls.dampingFactor = 0.25;
    
        // controls.zoomSpeed = 0.666;
        // controls.rotateSpeed = 0.25;
    
        // controls.minDistance = 10;
        // controls.maxDistance = 100;
    
        // Wait for simulation time to be initialized
        await initializeSimulationTime();
    
        addSun();
        updateSunDistance();
        updateSunPosition(simulationTime, scaleFactor); // Update Sun position
    
        pivot = new THREE.Group();
        pivot.rotation.z = earthTilt; // Tilt the entire Earth system by 23.4 degrees on the Z-axis
        scene.add(pivot);
    
        moonPivot = new THREE.Group();
        scene.add(moonPivot);
    
        addEarthSphere();
        // updateSunLine(); // Sync Sun line position
    
        addMoon();
        // setupChapterControls();

        // Load GP data and initialize satellite mesh
        loadSatelliteData();
               
        loadAllData();
        initializeSlider();
    
        window.addEventListener("resize", onWindowResize, false);
        onWindowResize();

        await initClassificationSchemes('config/classification_config.json');
        console.log('Parsed Classification Schemes:', JSON.stringify(classificationSchemes, null, 2));

        updateLegend(activeScheme);
    
        animate();
    }
    
    function addSun() {
        // Ambient and directional lights (your existing code)
        const ambientLight = new THREE.AmbientLight(0x404040, 1);
        scene.add(ambientLight);
    
        directionalLight = new THREE.DirectionalLight(0x5b5b5b, 100);
        directionalLight.castShadow = true;
        scene.add(directionalLight);

    
        const hemiLight = new THREE.HemisphereLight(0xffffbb, 0x080820, 5.5);
        scene.add(hemiLight);
    
        // Sun object setup (your existing code)
        const sunRadius = sphereRadius * 109 * distanceCompressionFactor;
        const sunGeometry = new THREE.SphereGeometry(sunRadius, 24, 24);
        const sunMaterial = new THREE.MeshBasicMaterial({
            color: 0xffff00,
            emissive: 0xffa500,
            opacity: 0.25,
            transparent: true,
            wireframe: true,
            alphaHash: true,
        });

    
        sunMesh = new THREE.Mesh(sunGeometry, sunMaterial);
        scene.add(sunMesh);
    
        // Sun pivot group to hold position
        const sunPivot = new THREE.Group();
        scene.add(sunPivot);
        sunPivot.add(sunMesh);
        sunPivot.add(directionalLight);

    }

        // Calculate Julian Date
    function getJulianDate(date) {
        return date.getTime() / 86400000 + 2440587.5; // Convert milliseconds to days
    }

    // Update the Sun's position based on simulation time
    function updateSunPosition(simulationTime, scaleFactor) {
        const julianDate = getJulianDate(simulationTime);
        const T = (julianDate - 2451545.0) / 36525; // Centuries since J2000

        // Sun's orbital parameters
        const L0 = 280.46646 + T * (36000.76983 + T * 0.0003032); // Mean longitude (degrees)
        const M = 357.52911 + T * (35999.05029 - 0.0001537 * T); // Mean anomaly (degrees)
        const C = (1.914602 - T * (0.004817 + 0.000014 * T)) * Math.sin(M * (Math.PI / 180))
                + (0.019993 - 0.000101 * T) * Math.sin(2 * M * (Math.PI / 180))
                + 0.000289 * Math.sin(3 * M * (Math.PI / 180)); // Sun's equation of center
        const trueLongitude = L0 + C; // True longitude of the Sun (degrees)

        // Sun's position in Earth-centered coordinates
        const eclipticObliquity = 23.44 * (Math.PI / 180); // Axial tilt in radians
        const sunEclipticX = Math.cos(trueLongitude * (Math.PI / 180));
        const sunEclipticY = Math.cos(eclipticObliquity) * Math.sin(trueLongitude * (Math.PI / 180));
        const sunEclipticZ = Math.sin(eclipticObliquity) * Math.sin(trueLongitude * (Math.PI / 180));

        // Scale Sun to a realistic distance
        const sunDistanceAU = 1; // 1 Astronomical Unit
        const sunPosition = new THREE.Vector3(
            sunEclipticX * sunDistanceAU,
            sunEclipticZ * sunDistanceAU, 
            -sunEclipticY * sunDistanceAU 
        ).multiplyScalar(scaleFactor * 149.6e6);
        
        // Update Sun's position and light in the scene
        sunMesh.position.copy(sunPosition);
        directionalLight.position.copy(sunPosition);
        directionalLight.target.position.set(0, 0, 0); // Point light at Earth's center
        directionalLight.target.updateMatrixWorld();
    }

    
        // Function to update sun's distance based on current compression factor
        function updateSunDistance() {
            const sunDistanceFromEarth = 149.6e6 * scaleFactor * distanceCompressionFactor;
            sunMesh.position.set(sunDistanceFromEarth, 0, 0);
            directionalLight.position.copy(sunMesh.position);
        }
    
        // debugging
        function updateSunLine() {
            const positions = sunLine.geometry.attributes.position.array;
            positions[0] = 0; // Earth's center
            positions[1] = 0;
            positions[2] = 0;
        
            positions[3] = sunMesh.position.x;
            positions[4] = sunMesh.position.y;
            positions[5] = sunMesh.position.z;
        
            sunLine.geometry.attributes.position.needsUpdate = true;
        }
        
    
        // Initialize Simplex Noise for subtle rotation
        const simplex = new createNoise2D();
        let time = 0;
        const noiseSpeed = 0.00001;
        const noiseAmplitude = 0.002;
    
        function animateSunRotation() {
            time += noiseSpeed;
            const noiseX = simplex(time, 0) * noiseAmplitude;
            const noiseY = simplex(0, time) * noiseAmplitude;
            const noiseZ = simplex(time, time) * noiseAmplitude;
    
            sunMesh.rotation.x += noiseX;
            sunMesh.rotation.y += noiseY;
            sunMesh.rotation.z += noiseZ;
        }     
    
            
    function addMoon() {
        const moonRadius = sphereRadius * 0.273; // Moon radius is about 27.3% of Earth's radius
        const moonMaterial = new THREE.MeshStandardMaterial({
            color: 0x8a8a8a, 
            roughness: 1,
            metalness: 1.25,
            // opacity: 0.8,
            // transparent: true,
            // alphaHash: true,
            // depthTest: false,
        });
    
        const moonGeometry = new THREE.SphereGeometry(moonRadius, 32, 32);
        moonMesh = new THREE.Mesh(moonGeometry, moonMaterial);
        moonPivot.add(moonMesh); // Add moon mesh to the pivot so it orbits with Earth
    }
    
    function updateMoonPosition() {
        if (!moonMesh) return;
    
        const moonAverageAltitudeKm = 384400; // Average distance to Moon in kilometers
        const moonDistanceFromEarth = moonAverageAltitudeKm * scaleFactor * distanceCompressionFactor;
    
        // Calculate Moon’s orbit position based on the proportional time relationship
        const elapsedSeconds = simulationTime.getTime() / 1000; // Convert simulation time to seconds
        const moonAngle = (elapsedSeconds * moonAngularSpeed) % (2 * Math.PI); // Moon's orbital angle
        const eccentricity = 0.0549; // Moon's orbital eccentricity
    
        const x = moonDistanceFromEarth * (Math.cos(moonAngle) - eccentricity);
        const z = moonDistanceFromEarth * Math.sin(moonAngle) * Math.sqrt(1 - eccentricity ** 2);
    
        let moonPosition = new THREE.Vector3(x, 0, z);
    
        // Rotate the Moon's orbit by its inclination (5.145 degrees) around Earth's x-axis
        const inclination = 5.145 * (Math.PI / 180); // Convert to radians
        moonPosition.applyAxisAngle(new THREE.Vector3(1, 0, 0), inclination);
    
        // Apply Earth's tilt to the Moon's orbit
        moonPosition.applyAxisAngle(new THREE.Vector3(0, 0, 1), earthTilt);
    
        // Set the calculated position
        moonMesh.position.copy(moonPosition);
    }
        

// Load TLE data from cached JSON file
// with loading screen
// todo: separate loading screen to main.js config

let satelliteMesh;
let geostationaryInstancedMesh;

function loadSatelliteData() {

  
    
    const endpoints = [
        "100 Brightest", "Space Stations", "Debris", "Navigation", "Communications", "Scientific"
    ];


    // Fetch data for all group_major endpoints in parallel
    Promise.all(endpoints.map(groupMajor => loadGroupMajorData(groupMajor)))
        .then(groupDataArrays => {
            // Combine all group data into one array
            const allSatellites = groupDataArrays.flat();

            // Process and store data for rendering
            processSatelliteData(allSatellites);

            console.log("Successfully loaded and processed all satellite data.");
            onSatelliteLoadComplete(); // Callback to signal completion

            // Ensure legend initializes with the filtered active scheme
            updateLegend(activeScheme);

        })
        .catch(error => {
            console.error("Failed to load some satellite data:", error);
            console.log("Attempting to load data from local cache...");

            // Fallback to local cache
            fetch('cache/active.json')
                .then(localResponse => {
                    if (!localResponse.ok) throw new Error('Local cache fetch failed');
                    return localResponse.json();
                })
                .then(processSatelliteData)
                .catch(localError => {
                    console.error("Failed to load satellite data from both server and local cache:", localError);
                    onSatelliteLoadComplete(); // Trigger callback even if loading fails
                });
        });
}

async function loadGroupMajorData(groupMajor) {
    const endpoint = `https://orbital-bbfd.onrender.com/satellites/${groupMajor}`;
    try {
        const response = await fetch(endpoint);
        if (!response.ok) throw new Error(`Failed to load data for ${groupMajor}`);
        const data = await response.json();

        const flattenedData = flattenSatelliteData(groupMajor, data);
        console.log(`Loaded and flattened data for ${groupMajor}`);
        return flattenedData;
    } catch (error) {
        console.warn(`Error loading data for ${groupMajor}:`, error);
        return []; // Return an empty array if fetching fails
    }
}

function flattenSatelliteData(groupMajor, groupData) {
    const tleArray = [];

    // Ensure `data` exists and is structured correctly
    if (groupData.data && typeof groupData.data === 'object') {
        Object.entries(groupData.data).forEach(([groupMinor, satellites]) => {
            if (Array.isArray(satellites)) {
                satellites.forEach((sat) => {
                    if (sat.tleLine1 && sat.tleLine2) {
                        tleArray.push({
                            name: sat.name || 'Unknown',
                            tleLine1: sat.tleLine1,
                            tleLine2: sat.tleLine2,
                            country: sat.country || 'Unknown',
                            orbitClass: sat.orbitClass || 'Unknown',
                            // objType: sat.objType || 'Unknown',
                            group_major: groupMajor || 'Unknown',
                            group_minor: groupMinor || 'Unknown', // Preserved for future use
                        });
                    } else {
                        console.warn(`Satellite missing TLE data:`, sat);
                    }
                });
            } else {
                console.warn(`Expected an array of satellites under group_minor: ${groupMinor}, but got:`, satellites);
            }
        });
    } else {
        console.warn(`Expected a 'data' object for group_major: ${groupMajor}, but got:`, groupData.data);
    }

    return tleArray;
}


function processSatelliteData(tleArray) {
    if (!Array.isArray(tleArray) || tleArray.length === 0) {
        console.error("No valid satellite data to process.");
        return;
    }

    const representedClasses = {
        group_major: new Set(),
        group_minor: new Set(),
        orbitClass: new Set(),
        country: new Set(),
    };


    // Add metadata for classification
    tleArray.forEach((sat) => {
        sat.metadata = {
            satrec: createSatrec(sat.tleLine1, sat.tleLine2), // Generate satrec for propagation
            orbitClass: sat.orbitClass.toLowerCase(),
            country: sat.country.toLowerCase(),
            group_major: sat.group_major.toLowerCase(),
            group_minor: sat.group_minor.toLowerCase(),
        };

        
        // Collect represented classes for legend visibility 
        representedClasses.group_major.add(sat.metadata.group_major);
        representedClasses.group_minor.add(sat.metadata.group_minor);
        representedClasses.orbitClass.add(sat.metadata.orbitClass);
        representedClasses.country.add(sat.metadata.country);
    });


    // console.log("Processed Satellite Data with Metadata:", tleArray);

    filterClassificationSchemes(representedClasses);

    // Pass TLE data for mesh creation
    createSatelliteMeshes(tleArray);
}

function createSatrec(tleLine1, tleLine2) {
    try {
        return satellite.twoline2satrec(tleLine1.trim(), tleLine2.trim());
    } catch (error) {
        console.warn("Failed to create Satrec from TLE:", { tleLine1, tleLine2 }, error);
        return null;
    }
}


// const classificationSchemes = {
//     orbitClass: {
//         getClass: (sat) => sat.orbitClass,
//         colors: {
//             geostationary: 0xffffff,
//             sunSynchronous: 0xffff00,
//             nonGeostationary: 0xff0000,
//             unknown: 0xff00ff,
//         },
//     },
//     country: {
//         getClass: (sat) => sat.country || 'Unknown', // Ensure fallback to 'Unknown' if country is not provided
//         colors: {
//             US: 0x0000ff,
//             PRC: 0xff0000,
//             CIS: 0x00ffff,
//             ESA: 0xffff00,
//             JPN: 0xab1212,
//             Unknown: 0x00ff00,
//         },
//     },
//     group_major: {
//         getClass: (sat) => sat.group_major || 'Unknown',
//         colors: {
//             "Active": 0xff00ff,
//             "Last 30 Days": 0xff0000,
//             "Space Stations": 0x00ff00,
//             "100 Brightest": 0x0000ff,
//             "Debris": 0xffff00,
//             "Weather & Earth Resources": 0xff8800,
//             "Communications": 0x0088ff,
//             "Navigation": 0x88ff00,
//             "Scientific": 0xff00ff,
//             "Miscellaneous": 0x888888,
//             "Unknown": 0xff0000
//         },
//     },
// };



// Transform external config into the classificationSchemes format
function populateClassificationSchemes(config) {
    const classificationSchemes = {};

    for (const [key, value] of Object.entries(config)) {
        classificationSchemes[key] = {
            colors: Object.fromEntries(
                Object.entries(value.colors).map(([category, color]) => [
                    category.trim().toLowerCase(), // Normalize category keys
                    parseInt(color, 10) || 0xff0000, // Ensure colors are valid integers
                ])
            ),
        };
        console.log(`sccccc: `, classificationSchemes[key])
    }

    return classificationSchemes;
}

function filterClassificationSchemes(representedClasses) {
    for (const [scheme, { colors }] of Object.entries(classificationSchemes)) {
        const representedSet = representedClasses[scheme];

        if (!representedSet) continue; // Skip schemes not in representedClasses

        // Remove unrepresented classes from the colors object
        for (const category of Object.keys(colors)) {
            if (!representedSet.has(category)) {
                delete colors[category];
            }
        }
    }

    console.log("Filtered Classification Schemes:", classificationSchemes);
}


// Main Function to Load and Initialize Classification Schemes
async function initClassificationSchemes(configPath) {
    try {
        const response = await fetch(configPath);
        if (!response.ok) {
            throw new Error(`Failed to load classification config from ${configPath}: ${response.statusText}`);
        }

        const config = await response.json();
        classificationSchemes = populateClassificationSchemes(config);

        console.log("Classification schemes initialized:", classificationSchemes);
    } catch (error) {
        console.error("Error initializing classification schemes:", error);
        classificationSchemes = {}; // Fallback to empty object
    }
}


// Helper to determine color based on scheme
function getColorByScheme(scheme, sat) {
    const { colors } = classificationSchemes[scheme];
    const category = (sat[scheme] || 'unknown').toString().trim().toLowerCase();
    const colorCode = colors[category];

    if (!colorCode) {
        console.warn(`No color found for category '${category}' in scheme '${scheme}'. Defaulting to red.`);
        return new THREE.Color(0xff0000); // Default to red
    }

    console.log(`Scheme: ${scheme}, Category: ${category}, Color: ${colorCode}`);
    return new THREE.Color(colorCode);
}

function applyClassification(instancedMesh, scheme, satellites) {
    if (!instancedMesh || !instancedMesh.count) {
        console.error("InstancedMesh is not properly initialized.");
        return;
    }

    const dummy = new THREE.Object3D();
    const colors = new Float32Array(instancedMesh.count * 3); // RGB for each instance

    satellites.forEach((sat, i) => {
        if (i >= instancedMesh.count) {
            console.warn(`Instance index ${i} exceeds InstancedMesh count (${instancedMesh.count}).`);
            return;
        }

        if (!sat.metadata) {
            console.warn(`Satellite at index ${i} is missing metadata. Skipping.`);
            return;
        }

        const colorHex = getColorByScheme(activeScheme, sat.metadata);
        const color = new THREE.Color(colorHex);

        try {
            instancedMesh.getMatrixAt(i, dummy.matrix); // Safely get the matrix
        } catch (err) {
            console.error(`Error accessing matrix for instance ${i}:`, err);
            return;
        }

        dummy.updateMatrix();
        sat.originalMatrix = dummy.matrix.clone(); // Save the original matrix
    
        instancedMesh.setMatrixAt(i, dummy.matrix); // Retain position
        colors.set(color.toArray(), i * 3); // Set color
        
    });

    instancedMesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
    instancedMesh.instanceMatrix.needsUpdate = true;
}


document.getElementById('orbit-class').addEventListener('click', () => {
    switchClassification('orbitClass');
});

document.getElementById('group-major').addEventListener('click', () => {
    switchClassification('group_major');
});


document.getElementById('group-minor').addEventListener('click', () => {
    switchClassification('group_minor');
});

document.getElementById('owner-country').addEventListener('click', () => {
    switchClassification('country');
});


function switchClassification(newScheme) {
    if (!satelliteMesh || !satelliteMesh.count) {
        console.error("Satellite mesh is not initialized or empty. Cannot switch classification.");
        return;
    }

    if (activeScheme) {
        resetSatelliteVisibility(satelliteMesh, activeScheme); // Reset visibility for the old scheme
    }

    activeScheme = newScheme;

    // Reapply classification and reset visibility/colors
    applyClassification(satelliteMesh, activeScheme, tleArray);
    resetSatelliteVisibility(satelliteMesh, activeScheme);
    resetSatelliteColors(satelliteMesh); 

    // Update satellite positions
    updateSatellitePositions(satelliteMesh);

    // // Ensure lines inherit the new colors
    // if (currentChapter !== 'smallScale') {
    //     refreshSatelliteLines();
    // }

    // Update legend for the new scheme
    updateLegend(activeScheme);
}

function updateLegend(activeScheme) {
    const legendContainer = document.getElementById('legend-container');
    legendContainer.innerHTML = '';

    const schemeConfig = classificationSchemes[activeScheme];
    if (!schemeConfig) {
        console.warn(`Scheme '${activeScheme}' not found.`);
        legendContainer.innerHTML = '<p>No legend available for the selected scheme.</p>';
        return;
    }

    const { colors } = schemeConfig;
    console.log(`Legend Colors for Scheme '${activeScheme}':`, colors);

    const sortedCategories = Object.keys(colors).sort();

    sortedCategories.forEach((category) => {
        const color = colors[category];
        const legendItem = document.createElement('div');
        legendItem.className = 'legend-item';

        const colorBox = document.createElement('div');
        colorBox.className = 'legend-color';
        colorBox.style.backgroundColor = `#${parseInt(color).toString(16).padStart(6, '0')}`;

        const label = document.createElement('span');
        label.textContent = category;

        legendItem.addEventListener('click', () => {
            console.log(`Clicked on category: ${category}`);
            toggleSatelliteFilter(activeScheme, category);
        });

        legendItem.appendChild(colorBox);
        legendItem.appendChild(label);
        legendContainer.appendChild(legendItem);
    });
}

function handleLegendClick(scheme, category, clickedItem) {
    const legendContainer = document.getElementById('legend-container');
    const activeItem = legendContainer.querySelector('.legend-item.active');

    // If the clicked item is already active, clear the filter
    if (activeItem === clickedItem) {
        clickedItem.classList.remove('active');
        resetLegendTransparency(legendContainer); // Reset all patches to normal
        toggleSatelliteFilter(scheme, null); // Clear the filter
    } else {
        // Remove active state from the previous item
        if (activeItem) {
            activeItem.classList.remove('active');
        }

        // Set the clicked item as active
        clickedItem.classList.add('active');

        // Make non-active patches transparent
        setLegendTransparency(legendContainer, clickedItem);

        toggleSatelliteFilter(scheme, category); // Apply the filter
    }
}

function setLegendTransparency(legendContainer, activeItem) {
    legendContainer.querySelectorAll('.legend-item').forEach((item) => {
        if (item !== activeItem) {
            item.classList.add('inactive'); // Mark non-active items as inactive
        } else {
            item.classList.remove('inactive'); // Keep the active item fully visible
        }
    });
}

function resetLegendTransparency(legendContainer) {
    legendContainer.querySelectorAll('.legend-item').forEach((item) => {
        item.classList.remove('inactive'); // Remove the inactive class from all items
    });
}


function toggleSatelliteFilter(scheme, category) {
    if (filteredClass === category) {
        filteredClass = null;
        resetSatelliteVisibility(scheme); // Reset visibility
    } else {
        filteredClass = category;
        filterSatellitesByClass(scheme, category);
    }

    updateSatelliteVisibility();
    refreshSatelliteLines(); // Refresh lines to match visibility
}

function updateSatelliteVisibility() {
    const dummy = new THREE.Object3D();

    satelliteMesh.userData.forEach((sat, i) => {
        if (!sat || !sat.metadata) return;

        // Toggle matrix and visibility
        if (sat.visible) {
            satelliteMesh.getMatrixAt(i, dummy.matrix);
            satelliteMesh.setMatrixAt(i, dummy.matrix); // Restore matrix
        } else {
            satelliteMesh.setMatrixAt(i, new THREE.Matrix4()); // Hide satellite
        }
    });

    satelliteMesh.instanceMatrix.needsUpdate = true; // Ensure rendering updates
}

function filterSatellitesByClass(scheme, category) {
    const { colors } = classificationSchemes[scheme];
    const normalizedCategory = category.trim().toLowerCase();
    if (!colors[normalizedCategory]) {
        console.warn(`Category '${normalizedCategory}' not found in scheme '${scheme}'.`);
        return;
    }
    satelliteMesh.userData.forEach((sat, i) => {
        const satelliteClass = (sat.metadata[scheme] || 'unknown').toString().trim().toLowerCase();
        console.log(`Satellite ${i}: Class (${scheme}): '${satelliteClass}', Filter Visible: ${satelliteClass === normalizedCategory}`);
        sat.visible = satelliteClass === normalizedCategory;
    });
    updateSatelliteVisibility();
}

function updateMaterialVisibility(mesh, index, filterVisible) {
    const instance = mesh.userData[index];
    if (!instance) return;

    // Debugging
    // console.log(`Satellite ${index} - Updating Material Visibility to: ${filterVisible}`);

    // Update visibility state directly in the material
    const material = mesh.material;
    if (material instanceof THREE.MeshStandardMaterial) {
        material.visible = filterVisible; // Hide or show the satellite
    }

    // Maintain position updates
    const dummy = new THREE.Object3D();
    mesh.getMatrixAt(index, dummy.matrix);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, filterVisible ? dummy.matrix : new THREE.Matrix4()); // Reset matrix for hidden satellites
    mesh.instanceMatrix.needsUpdate = true;
}

function resetSatelliteVisibility(scheme) {
    satelliteMesh.userData.forEach((sat) => {
        if (!sat) return;

        sat.visible = true; // Reset to visible
    });

    updateSatelliteVisibility(); // Apply the reset visibility
}


function resetSatelliteColors(mesh) {
    const colors = mesh.instanceColor.array;

    mesh.userData.forEach((sat, i) => {
        const color = new THREE.Color(getColorByScheme(activeScheme, sat.metadata));
        colors.set(color.toArray(), i * 3); // Update colors
    });

    mesh.instanceColor.needsUpdate = true; // Trigger color updates in the mesh
}


// satellite material
function createSatelliteMeshes(allSatellites) {
    // console.log('All satellites passed to createSatelliteMeshes:', allSatellites);
    console.log('Satellite count:', allSatellites.length);

    const material = new THREE.MeshStandardMaterial({
        metalness: 0.3,
        roughness: 0.2,
        transparent: false,
        wireframe: true,
    });

    satelliteMesh = createSatelliteInstancedMesh(allSatellites, material, currentChapter === 'smallScale');

    if (satelliteMesh && satelliteMesh.count > 0) {
        console.log("Consolidated satellite mesh created and added to the scene.");
        pivot.add(satelliteMesh);
    } else {
        console.error("Failed to create satellite mesh or no instances were added.");
    }
}

// Propagate position helper
function propagateSatellitePosition(satrec, gmst) {
    const positionAndVelocity = satellite.propagate(satrec, simulationTime);
    if (!positionAndVelocity.position) return null;

    const positionGd = satellite.eciToGeodetic(positionAndVelocity.position, gmst);
    const altitude = positionGd.height * scaleFactor * distanceCompressionFactor;
    const latitude = satellite.degreesLat(positionGd.latitude);
    const longitude = satellite.degreesLong(positionGd.longitude);

    let position = latLonToVector3(latitude, longitude, sphereRadius + altitude);

    return position;
}


// custom frustrum culling for satellite lines
const frustum = new THREE.Frustum();
const cameraViewProjectionMatrix = new THREE.Matrix4();

function isSatelliteVisible(position) {
    camera.updateMatrixWorld(); // Ensure the camera matrix is up-to-date

    // Create an expanded frustum matrix
    const bufferFactor = .5; // Add a -N% buffer
    const projectionMatrixWithBuffer = camera.projectionMatrix.clone();
    projectionMatrixWithBuffer.elements[0] *= bufferFactor; // Left/Right
    projectionMatrixWithBuffer.elements[5] *= bufferFactor; // Top/Bottom

    cameraViewProjectionMatrix.multiplyMatrices(projectionMatrixWithBuffer, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(cameraViewProjectionMatrix);

    // Check if the satellite is within the expanded frustum
    if (!frustum.containsPoint(position)) {
        return false;
    }

    // Check if the satellite is occluded by the Earth sphere
    let earthCenter = new THREE.Vector3(0, 0, 0);
    const directionToSatellite = position.clone().sub(earthCenter).normalize();
    const directionToCamera = camera.position.clone().sub(earthCenter).normalize();

    // If the angle between the satellite's direction and the camera's direction is >90 degrees, it's occluded
    const dotProduct = directionToSatellite.dot(directionToCamera);
    if (dotProduct < 0) {
        return false; // Satellite is occluded
    }

    return true;
}

// create satellite instances (scale dependent appearance)
function createSatelliteInstancedMesh(satellites, material, isFixedView = false) {
    console.log('Creating instanced mesh. Satellite count:', satellites.length);

    const instanceCount = satellites.length;
    if (instanceCount === 0) {
        console.error('No satellites to create instanced mesh.');
        return null;
    }

    const satelliteGeometry = isFixedView
        ? new THREE.SphereGeometry(0.0035, 2, 3)
        : new THREE.SphereGeometry(0.004, 2, 3);

    const instancedMesh = new THREE.InstancedMesh(satelliteGeometry, material, instanceCount);
    const colors = new Float32Array(instanceCount * 3); // Color buffer
    const dummy = new THREE.Object3D();

    instancedMesh.userData = []; // Store metadata and visibility state

    satellites.forEach((sat, i) => {
        try {
            dummy.position.set(0, 0, 0); // Default position
            dummy.updateMatrix();
            instancedMesh.setMatrixAt(i, dummy.matrix);

            const color = new THREE.Color(getColorByScheme(activeScheme, sat.metadata));
            colors.set(color.toArray(), i * 3);

            instancedMesh.userData[i] = {
                metadata: sat.metadata,
                visible: true, // Start as visible
    
            };
        } catch (error) {
            console.error(`Error initializing satellite ${sat.name}:`, error);
            instancedMesh.userData[i] = null;
        }
    });

    instancedMesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
    instancedMesh.instanceMatrix.needsUpdate = true;
    instancedMesh.instanceColor.needsUpdate = true;

    return instancedMesh;
}


function updateSatellitePositions(instancedMesh) {
    const gmst = satellite.gstime(simulationTime); // Greenwich Mean Sidereal Time
    const dummy = new THREE.Object3D();
    let earthCenter = new THREE.Vector3(0, 0, 0);

    for (let i = 0; i < instancedMesh.count; i++) {
        const { metadata, visible } = instancedMesh.userData[i];
        if (!metadata) continue;

        const position = propagateSatellitePosition(metadata.satrec, gmst);
        if (!position) continue;

        dummy.position.copy(position);
        dummy.updateMatrix();

        if (visible) {
            instancedMesh.setMatrixAt(i, dummy.matrix); // Update matrix only for visible satellites
        } else {
            instancedMesh.setMatrixAt(i, new THREE.Matrix4()); // Reset matrix for hidden satellites
        }

        // Update lines in fixed view
        if (currentChapter !== 'smallScale') {
            updateSatelliteLine(i, position, earthCenter, visible);
        }
    }

    instancedMesh.instanceMatrix.needsUpdate = true;
}

const satelliteLines = new Map(); // Map satellite index to its line

function updateSatelliteLine(index, satellitePosition, earthCenter, isSatelliteVisibleByFilter) {
    const isVisible = isSatelliteVisibleByFilter && isSatelliteVisible(satellitePosition);

    if (!isVisible) {
        // Remove line if it's no longer visible
        if (satelliteLines.has(index)) {
            const line = satelliteLines.get(index);
            pivot.remove(line);
            line.geometry.dispose();
            line.material.dispose();
            satelliteLines.delete(index);
        }
        return;
    }

    // Create or update the line
    if (!satelliteLines.has(index)) {
        // Retrieve the satellite's color from instanceColor
        const colorArray = satelliteMesh.instanceColor.array;
        const satelliteColor = new THREE.Color(
            colorArray[index * 3],
            colorArray[index * 3 + 1],
            colorArray[index * 3 + 2]
        );

        const lineGeometry = new THREE.BufferGeometry();
        const positions = new Float32Array(6); // Two points (start and end)
        lineGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const lineMaterial = new THREE.LineBasicMaterial({
            color: satelliteColor, // Assign satellite's color to the line
            transparent: false,
            alphaHash: true,
        });

        const line = new THREE.Line(lineGeometry, lineMaterial);
        pivot.add(line);
        satelliteLines.set(index, line);
    }

    // Update line geometry
    const line = satelliteLines.get(index);
    const positions = line.geometry.attributes.position.array;
    positions[0] = earthCenter.x;
    positions[1] = earthCenter.y;
    positions[2] = earthCenter.z;
    positions[3] = satellitePosition.x;
    positions[4] = satellitePosition.y;
    positions[5] = satellitePosition.z;
    line.geometry.attributes.position.needsUpdate = true;
}
            
function refreshSatelliteLines() {
    satelliteLines.forEach((line, index) => {
        const { metadata, visible } = satelliteMesh.userData[index];
        if (!metadata) return;

        // Ensure the satellite is visible and within the frustum
        const isVisible = visible && isSatelliteVisible(satelliteMesh.userData[index].position);
        if (!isVisible) {
            // Hide the line
            if (line.visible) {
                line.visible = false;
            }
            return;
        }

        // Retrieve the updated satellite color from instanceColor
        const colorArray = satelliteMesh.instanceColor.array;
        const satelliteColor = new THREE.Color(
            colorArray[index * 3],
            colorArray[index * 3 + 1],
            colorArray[index * 3 + 2]
        );

        // Update line material and visibility
        line.material.color = satelliteColor;
        line.material.needsUpdate = true; // Ensure material refresh
        line.visible = true; // Show the line
    });
}

function setResponsiveCameraPosition() {
    const isMobile = window.innerWidth <= 768;

    // Adjust camera and active control properties dynamically
    if (orbitControls.enabled) {
        orbitControls.minDistance = isMobile ? 50 : 5;
        orbitControls.maxDistance = isMobile ? 500 : 100;
    } else if (mapControls.enabled) {
        mapControls.minDistance = isMobile ? 20 : 10;
        mapControls.maxDistance = isMobile ? 150 : 50;
    } else if (mapControls.enabled) {
        trackballControls.minDistance = isMobile ? 20 : 5;
        trackballControls.maxDistance = isMobile ? 100 : 50;
    } else if (firstPersonControls.enabled) {
        // FirstPersonControls don't have min/max distance but can have adjusted speed
        firstPersonControls.movementSpeed = isMobile ? 2 : 5;
    }

    // Adjust camera position
    camera.position.z = isMobile ? baseZ * mobileScaleFactor : baseZ;
}


    
    let simulationTime; // Starting time for the simulation
    const timeDelta = 1000 / 20; // 1-second increment per frame @ N fps divisor
    let timeMultiplier = 1000; // Overall simulation speed multiplier

// Function to fetch and set initial simulation time
function initializeSimulationTime() {
    return fetch('https://orbital-bbfd.onrender.com/timestamps') // Fetch all timestamps from the server
        .then(response => {
            if (!response.ok) {
                throw new Error("Failed to fetch timestamps from server");
            }
            return response.json();
        })
        .then(timestamps => {
            // Use the LATEST timestamp if available, or fallback to PAYLOAD
            const latestTimestamp = Math.max(...Object.values(timestamps).filter(ts => ts > 0));
            const payloadTimestamp = timestamps.PAYLOAD || null;

            if (!latestTimestamp && !payloadTimestamp) {
                throw new Error("No valid timestamps found in server response");
            }

            simulationTime = new Date(latestTimestamp || payloadTimestamp);
            document.getElementById("simulation-time").textContent = simulationTime
                .toUTCString()
                .replace("GMT", "UTC");
        })
        .catch(serverError => {
            console.error("Error loading timestamps from server, attempting local cache:", serverError);

            // Fallback to local cache
            return fetch('cache/timestamps.json')
                .then(localResponse => {
                    if (!localResponse.ok) {
                        throw new Error("Failed to fetch timestamps from local cache");
                    }
                    return localResponse.json();
                })
                .then(timestamps => {
                    // Use the LATEST timestamp if available, or fallback to PAYLOAD
                    const latestTimestamp = Math.max(...Object.values(timestamps).filter(ts => ts > 0));
                    const payloadTimestamp = timestamps.PAYLOAD || null;

                    if (!latestTimestamp && !payloadTimestamp) {
                        throw new Error("No valid timestamps found in local cache");
                    }

                    simulationTime = new Date(latestTimestamp || payloadTimestamp);
                    document.getElementById("simulation-time").textContent = simulationTime
                        .toUTCString()
                        .replace("GMT", "UTC");
                })
                .catch(localError => {
                    console.error("Error loading timestamps from local cache, using hardcoded fallback:", localError);

                    // Fallback to hardcoded date
                    simulationTime = new Date('2024-11-01T00:00:00Z');
                    document.getElementById("simulation-time").textContent = simulationTime
                        .toUTCString()
                        .replace("GMT", "UTC");
                });
        });
}

// Function to update simulation time
function updateSimulationTime() {
    simulationTime = new Date(simulationTime.getTime() + timeDelta * timeMultiplier);
    const displayTime = simulationTime.toUTCString().replace("GMT", "UTC");
    document.getElementById("simulation-time").textContent = displayTime;

    // Update Sun's position with new simulation time
    updateSunPosition(simulationTime, scaleFactor);
}

// Adjust Earth rotation based on centralized simulation time
function updateEarthRotation() {
    if (isRotationEnabled) {
        const elapsedSeconds = (simulationTime.getTime() / 1000) % 86400; // Earth day in seconds
        const rotationAngle = (elapsedSeconds * earthRotationSpeed) % (2 * Math.PI);

        // Apply tilt and rotation in the correct order
        pivot.rotation.set(0, 0, 0); // Reset previous rotations
        pivot.rotateZ(earthTilt); // Apply axial tilt first
        pivot.rotateY(rotationAngle); // Apply Earth's rotation
    }
}

    function onWindowResize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);

        // Update camera position for responsiveness
        setResponsiveCameraPosition();
    }


// lock framerate
  let clock = new THREE.Clock();
  let delta = 0;
  // N fps
  const framerate = 20;
  let interval = 1 / framerate;




  function animate() {
    delta += clock.getDelta();

    if (delta > interval) {
        stats.begin();
        animationFrameId = requestAnimationFrame(animate);

        updateSimulationTime();
        updateEarthRotation();

        // Check camera distance for LOD
        checkCameraDistance();

        // Update positions and colors for all satellites
        if (satelliteMesh) {
            updateSatellitePositions(satelliteMesh);
        }

        updateMoonPosition();
        animateSunRotation();
        updateSunDistance();

        // Sync Sun's position dynamically
        updateSunPosition(simulationTime, scaleFactor);


        if (currentChapter === 'fixed') {
            const { lat, lon } = chapterConfig.fixed.coordinates[selectedCity];
            if (lat !== lastLat || lon !== lastLon) {
                switchToFixedView(lat, lon);
                lastLat = lat;
                lastLon = lon;
            }
        }


        if (orbitControls.enabled) orbitControls.update();
        // if (mapControls.enabled) mapControls.update();
        if (firstPersonControls.enabled) firstPersonControls.update(clock.getDelta()); // Requires delta time
        if (trackballControls.enabled) trackballControls.update(); // Explicit update for TrackballControls
        // if (flyControls.enabled) flyControls.update(delta); // Pass delta to FlyControls

        renderer.render(scene, camera);
        stats.end();

        delta = delta % interval;
    }
    requestAnimationFrame(animate);
}

// function resetCameraForFlyControls() {
//     camera.position.set(0, 0, sphereRadius * 2); // Position the camera at a reasonable distance
//     camera.lookAt(new THREE.Vector3(0, 0, 0)); // Point the camera at the Earth's center
//     camera.updateProjectionMatrix(); // Apply changes to the camera
// }



    // Convert geographic coordinates (lat, lon) to 3D cartesian coordinates
    function latLonToVector3(lat, lon, radius) {
        const phi = (90 - lat) * (Math.PI / 180); // Convert latitude to polar angle in radians
        const theta = (lon + 180) * (Math.PI / 180); // Convert longitude to azimuthal angle in radians
    
        const x = -radius * Math.sin(phi) * Math.cos(theta);
        const z = radius * Math.sin(phi) * Math.sin(theta);
        const y = radius * Math.cos(phi);
    
        return new THREE.Vector3(x, y, z);
    }
    
    let selectedCity = 'newYork'; // Default city

    // config params for each bookmark/chapter
    const modeManager = {
        smallScale: {
            activate: () => {

            // Enable OrbitControls
            enableControls(orbitControls);
            // orbitControls.zoomSpeed = 0.5;
            orbitControls.enablePan = false;

            // Adjust camera position for a top-down or equatorial view
            camera.lookAt(new THREE.Vector3(0, 0, 0)); // Ensure camera looks at Earth's center
            camera.updateProjectionMatrix();
            
            // Reset OrbitControls target to the globe's center
            orbitControls.target.set(0, 0, 0);
            orbitControls.update();

            // Apply chapter-specific configurations
            applyChapterConfig('smallScale');
            },
        },
        largeScale: {
            activate: () => {
                enableControls(orbitControls); // Activate OrbitControls
                orbitControls.enablePan = true;
                orbitControls.target.set( 0, 1, 0);
                // Dynamically set minDistance to prevent zooming in further
                const currentDistance = camera.position.distanceTo(orbitControls.target);
                orbitControls.minDistance = currentDistance; // Prevent zooming closer than the current distance
                orbitControls.update();

                applyChapterConfig('largeScale');
            },
        },
        fixed: {
            cities: {
                newYork: { lat: 40.7128, lon: -74.0060 },
                paris: { lat: 48.8566, lon: 2.3522 },
                tokyo: { lat: 35.6895, lon: 139.6917 },
            },
            activate: (city) => {
                const { lat, lon } = modeManager.fixed.cities[city];
                switchToFixedView(lat, lon); // Position camera for fixed mode
                enableControls(firstPersonControls); // Activate FirstPersonControls
                applyChapterConfig('fixed');
            },
        },
    };
        
    // track camera when changing LOD
    let previousCameraState = {
        position: new THREE.Vector3(),
        zoom: 1,
    };

    // cleanup
    function cleanupLargeScaleFeatures() {
        // Remove satellite lines from the scene
        satelliteLines.forEach((line, index) => {
            pivot.remove(line);
            line.geometry.dispose();
            line.material.dispose();
        });
        satelliteLines.clear();
    }
    
    function switchMode(mode, city) {
        if (currentChapter === mode) return; // Avoid redundant switches

        // Save the current camera state
        previousCameraState.position.copy(camera.position);
        previousCameraState.zoom = camera.zoom;        

        if (mode === 'fixed') {
            modeManager.fixed.activate(city); // Activate fixed mode for the chosen city
        } 
        if (mode === 'smallScale') {
            cleanupLargeScaleFeatures(); // Clean up largeScale-specific features
            modeManager[mode].activate(); // Activate the selected mode
        }
        else if (mode === 'largeScale') {
            
            modeManager[mode].activate(); // Activate the selected mode
        
            // modeManager[mode].activate();

            // Restore camera state for a seamless transition
            camera.position.copy(previousCameraState.position);
            camera.zoom = previousCameraState.zoom;
            camera.updateProjectionMatrix(); // Ensure the updated zoom is applied
        }

        currentChapter = mode; // Update the current mode
    }

    // Refined Threshold-based Mode Switching
    function checkCameraDistance() {
        const cameraDistance = camera.position.length(); // Get the current camera distance
        const threshold = sphereRadius * 8; // Threshold for switching modes

        if (cameraDistance < threshold && currentChapter !== 'largeScale') {
            switchMode('largeScale');
        } else if (cameraDistance >= threshold && currentChapter !== 'smallScale') {
            switchMode('smallScale');
        }
    }

    // First-person fixed view implementation
    function switchToFixedView(lat, lon) {
        const radius = sphereRadius; // Earth's radius
        const fixedPoint = latLonToVector3(lat, lon, radius);

        camera.position.copy(fixedPoint); // Place the camera at the fixed point
        camera.lookAt(new THREE.Vector3(0, 0, 0)); // Look towards the center of Earth
        camera.updateProjectionMatrix();
    }



    // Apply chapter-specific control settings
    function applyChapterConfig(chapter) {
        const config = modeManager[chapter]?.controls;
        if (!config) return;
    
    }
        
    // Function to add the Earth sphere to match the graticule radius
    function addEarthSphere() {
        const geometry = new THREE.SphereGeometry(sphereRadius, 64, 64); 
        const material = new THREE.MeshStandardMaterial({
            color: 0x000000, //  Earth
            opacity: 1,
            roughness: 2, // Higher roughness to reduce shininess
            metalness: 0.5, // Low metalness for a more diffuse surface
            emissive: 0x000000, // No self-illumination    
            transparent: true,
            alphaHash: true,
            wireframe: wireframe,
            // depthTest: false,
        });

        sphere = new THREE.Mesh(geometry, material);
        sphere.castShadow = true; // Enable shadows for the sphere
        sphere.receiveShadow = true; // Enable receiving shadows    
        pivot.add(sphere); // Add the sphere to the pivot group, so it rotates with the graticules   
            }


    init();

    return {
        dispose() {
            window.removeEventListener('resize', onWindowResize);
            cancelAnimationFrame(animationFrameId);
            const container = document.getElementById(containerId);
            if (container && renderer.domElement) {
                container.removeChild(renderer.domElement);
            }
        }
    };


    /////////////////////////////////////////////////////
    // FETCH EXTERNAL DATA /////////////////////////////

    async function loadAllData() {
        console.log("Attempting to load data...");

        // List of GeoJSON URLs
        const geoJsonUrls = [
            'data/ne_110m_coastline.geojson',
            'data/ne_110m_graticules_10.geojson',
            'data/ne_110m_graticules_5.geojson',
            'data/ne_110m_land.geojson',
            'data/ne_110m_ocean.geojson',
            'data/ne_50m_ocean.geojson'

        ];

        try {
            // Load all GeoJSON data concurrently
            const geoJsonPromises = geoJsonUrls.map(url =>
                fetch(url)
                    .then(res => {
                        if (!res.ok) throw new Error(`Network response was not ok for ${url}`);
                        return res.json();
                    })
                    .then(data => {
                        handleGeoJSONData(url, data);
                        return 'loaded';
                    })
                    .catch(error => {
                        console.error(`Error loading ${url}:`, error);
                        throw error;
                    })
            );

            // Wait for all GeoJSON data to be loaded
            await Promise.all(geoJsonPromises);
            console.log("All GeoJSON data loaded successfully.");
        } catch (error) {
            console.error("Failed to load some GeoJSON data:", error);
        }
    }

    // Handle loaded GeoJSON data
    function handleGeoJSONData(url, data) {
        switch (url) {

            case 'data/ne_110m_graticules_5.geojson':
                console.log("Loaded graticules:", data);
                addGraticulesToScene(data);
                break;


            case 'data/ne_110m_coastline.geojson':
                // Example: Handle contour line GeoJSON
                console.log("loaded coastlines:", data);
                addCoastlinesToScene(data);
                break;

            case 'data/ne_110m_land.geojson':
                // Example: Handle contour line GeoJSON
                // console.log("loaded land:", data);
                // addLandToScene(data);
                break;

            case 'data/ne_50m_ocean.geojson':
                // Example: Handle contour line GeoJSON
                console.log("loaded ocean:", data);
                // addOceanToScene(data);
                break;
    
    

            // case '/remotesensing/assets/data/CellularTowers_FeaturesToJSON_HIFLD_AOI_20231204.geojson':
            //     // Example: Handle cell tower points GeoJSON
            //     console.log("Loaded cellular towers:", data);
            //     addCellTowersToScene(data);
            //     break;


            default:
                console.warn('Unrecognized GeoJSON URL:', url);
                break;
        }
    }


    // line data rendering ////////

    // add coastlines
    function addCoastlinesToScene(data) {
        const lineMaterial = new THREE.LineBasicMaterial({ 
            color: 0xffffff,
            opacity: 0.75,
            alphaHash: true,
            }); 
        const radius = 1; // Sphere radius, assuming the sphere's radius is 1

        data.features.forEach(feature => {
            const coordinates = feature.geometry.coordinates;

            // GeoJSON geometries might contain different types (MultiLineString or LineString), handle both
            if (feature.geometry.type === "LineString") {
                const lineGeometry = createLineGeometryFromCoordinates(coordinates, radius);
                const line = new THREE.Line(lineGeometry, lineMaterial);
                pivot.add(line); // Add the coastline line to the scene pivot
            } else if (feature.geometry.type === "MultiLineString") {
                coordinates.forEach(lineString => {
                    const lineGeometry = createLineGeometryFromCoordinates(lineString, radius);
                    const line = new THREE.Line(lineGeometry, lineMaterial);
                    pivot.add(line);
                });
            }
        });
    }

    // Add graticules to the scene
    function addGraticulesToScene(data) {
        const lineMaterial = new THREE.LineBasicMaterial({ 
                // color: 0xaaaaaa, 
                color: 0x444444,
                opacity: 0.5,
                alphaHash: true,
                visible: true,
                transparent: false,
            }); 


        const radius = sphereRadius; // Make sure the radius matches the sphere's radius

        data.features.forEach(feature => {
            const coordinates = feature.geometry.coordinates;

            if (feature.geometry.type === "LineString") {
                const lineGeometry = createLineGeometryFromCoordinates(coordinates, radius);
                const line = new THREE.Line(lineGeometry, lineMaterial);
                pivot.add(line);
            } else if (feature.geometry.type === "MultiLineString") {
                coordinates.forEach(lineString => {
                    const lineGeometry = createLineGeometryFromCoordinates(lineString, radius);
                    const line = new THREE.Line(lineGeometry, lineMaterial);
                    pivot.add(line);
                });
            }
        });
    }


    // Helper function to create THREE.BufferGeometry from GeoJSON coordinates
    function createLineGeometryFromCoordinates(coordinates, radius) {
        const geometry = new THREE.BufferGeometry();
        const vertices = [];

        coordinates.forEach(([lon, lat]) => {
            const vertex = latLonToVector3(lat, lon, radius);
            vertices.push(vertex.x, vertex.y, vertex.z);
        });

        const verticesFloat32 = new Float32Array(vertices);
        geometry.setAttribute('position', new THREE.BufferAttribute(verticesFloat32, 3));

        return geometry;
    }


    // polygon data rendering ////////////


    // Function to add ocean polygons to the scene
        
    // Convert geographic coordinates (lat, lon) to 3D cartesian coordinates
    function latLonToVector3(lat, lon, radius) {
        const phi = (90 - lat) * (Math.PI / 180); // Convert latitude to radians
        const theta = (lon + 180) * (Math.PI / 180); // Convert longitude to radians

        const x = -radius * Math.sin(phi) * Math.cos(theta);
        const z = radius * Math.sin(phi) * Math.sin(theta);
        const y = radius * Math.cos(phi);

        return new THREE.Vector3(x, y, z);
    }



    /// misc window stuff

    function debounce(func, delay) {
        let timer;
        return function (...args) {
            clearTimeout(timer);
            timer = setTimeout(() => func.apply(this, args), delay);
        };
    }

    // interactive response curves

    // log for sim speed
    function logslider(position, maxSpeed = 20000) {
        // position will be between 0 and 100
        const minp = 0;
        const maxp = 100;

        const minv = Math.log(1); // Natural log of 1
        const maxv = Math.log(maxSpeed); // Natural log of the maximum speed ceiling

        // Calculate adjustment factor
        const scale = (maxv - minv) / (maxp - minp);

        return Math.exp(minv + scale * (position - minp));
    }
        
    // exp for vertical exaggeration
    // map exponential target value back to the slider's 0-100 range
    function mapExponentialToSlider(value, minExp, maxExp) {
        const logValue = Math.log10(value);
        return ((logValue - minExp) / (maxExp - minExp)) * 100;
    }
    
    function mapSliderToExponential(value, minExp, maxExp) {
        const scale = minExp + (value / 100) * (maxExp - minExp);
        return Math.pow(10, scale);
    }
            
    function initializeSlider() {

        // Distance exaggeration slider
        const exaggerationSlider = document.getElementById("exaggeration-slider");
        const exaggerationOutput = document.getElementById("exaggeration-value");
        const initialCompressionFactor = 1.0;
    
        // Function to get min and max for vertical exaggeration based on the chapter
        function getExaggerationRange() {
            if (currentChapter === 'fixed') {
                return { minExp: Math.log10(0.05), maxExp: Math.log10(1) }; // Fixed chapter range
            } else {
                return { minExp: Math.log10(0.1), maxExp: Math.log10(25) }; // smallScale chapter range
            }
        }
    
        // Set initial values for distance exaggeration
        let { minExp, maxExp } = getExaggerationRange();
        exaggerationSlider.value = mapExponentialToSlider(initialCompressionFactor, minExp, maxExp);
        distanceCompressionFactor = initialCompressionFactor;
        exaggerationOutput.textContent = distanceCompressionFactor.toFixed(2) + "x";
    
        // Update slider behavior dynamically on input
        exaggerationSlider.addEventListener("input", (event) => {
            const rawValue = parseFloat(event.target.value);
            ({ minExp, maxExp } = getExaggerationRange());
            distanceCompressionFactor = mapSliderToExponential(rawValue, minExp, maxExp);
            exaggerationOutput.textContent = distanceCompressionFactor.toFixed(2) + "x";
        
            // console.log("Distance Compression Factor:", distanceCompressionFactor);
        
            // Update positions dynamically
            if (satelliteMesh) debounce(updateSatellitePositions(satelliteMesh, false),10);
            // if (geostationaryInstancedMesh) debounce(updateSatellitePositions(geostationaryInstancedMesh, true),50);
        });
        
        // Simulation speed slider
        const speedSlider = document.getElementById("speed-slider");
        const speedOutput = document.getElementById("speed-value");
        const initialSpeedMultiplier = 1;
    
        // Set initial values for simulation speed
        speedSlider.value = 0; // Default position at 1x speed
        timeMultiplier = initialSpeedMultiplier;
        speedOutput.textContent = timeMultiplier.toFixed(0) + "x";
    
        // Function to get the maximum speed ceiling based on the chapter
        function getMaxSpeedForChapter() {
            return currentChapter === 'smallScale' ? 20000 : 500; // 20,000 for smallScale, 500 for fixed
        }
    
        // Update speed slider dynamically on input
        speedSlider.addEventListener("input", (event) => {
            const sliderPosition = parseFloat(event.target.value);
            const maxSpeed = getMaxSpeedForChapter(); // Get dynamic ceiling
            timeMultiplier = logslider(sliderPosition, maxSpeed);
            speedOutput.textContent = timeMultiplier.toFixed(0) + "x";
            let displayTime = simulationTime.toUTCString().replace("GMT", "UTC");
            document.getElementById("simulation-time").textContent = displayTime;
    
            // Initial display
            document.getElementById("simulation-time").textContent = simulationTime.toUTCString().replace("GMT", "UTC");
        });
    
        // Reset button functionality
        const resetButton = document.getElementById("reset-button");
        resetButton.addEventListener("click", () => {
            // Reset exaggeration slider
            ({ minExp, maxExp } = getExaggerationRange()); // Dynamically get range for reset
            exaggerationSlider.value = mapExponentialToSlider(initialCompressionFactor, minExp, maxExp);
            distanceCompressionFactor = initialCompressionFactor;
            exaggerationOutput.textContent = distanceCompressionFactor.toFixed(2) + "x";
    
            // Reset simulation speed slider
            speedSlider.value = 0; // Position for 1x speed
            timeMultiplier = initialSpeedMultiplier;
            speedOutput.textContent = timeMultiplier.toFixed(0) + "x";
    
            // Update satellite positions only if the satelliteMesh is defined
            if (satelliteMesh) {
                debounce(updateSatellitePositions(satelliteMesh),10);
            
            }
        });
    }
    

    
        function onWindowResize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    
        // Adjust z position based on new window width
        const isMobile = window.innerWidth <= 768;
        camera.position.z = isMobile ? baseZ * mobileScaleFactor : baseZ;
    }
                


    }
