import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { AsciiEffect } from 'three/examples/jsm/effects/AsciiEffect.js';
import * as satellite from 'satellite.js';
import Stats from 'stats.js'


//

// 'W' key toggles wireframe
// 'R' key toggles rotation

export function orbitalView(containerId) {
    let scene, camera, renderer, controls, pivot;
    let animationFrameId;

    // toggle defaults
    let isRotationEnabled = true;
    let wireframe = false;

    // responsive stuff
    const baseZ = 66; // default z-position value for desktop
    const mobileScaleFactor = 2; // responsive camera
    
    let directionalLight;
    let sphere; // Global reference to the sphere
    const earthRadiusKm = 6371; // Earth's radius in kilometers
    const sphereRadius = 1; // Earth’s radius as 1 unit in Three.js
    const scaleFactor = sphereRadius / earthRadiusKm; // Base scaling factor for consistency
    // const altitudeScaleFactor = sphereRadius / earthRadiusKm; // Scale real-world distances to scene units
    const earthRotationSpeed = (2 * Math.PI) / 86400; // Earth rotation speed in radians per second
    const earthTilt = 23.4 * (Math.PI / 180); // Convert 23.4 degrees to radians

    const moonOrbitalPeriodInSeconds = 27.32 * 24 * 3600; // 27.32 days in seconds
    const moonAngularSpeed = (2 * Math.PI) / moonOrbitalPeriodInSeconds; // Moon orbit speed in radians per second
    

    const planets = [];
    let distanceCompressionFactor = 1; // Initial v exaggeration factor

    let moonMesh;

    // stats
    const stats = new Stats()
    stats.showPanel(0) // 0: fps, 1: ms, 2: mb, 3+: custom
    // document.body.appendChild(stats.dom)


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


    function init() {

        scene = new THREE.Scene();
    
        camera = new THREE.PerspectiveCamera(5, window.innerWidth / window.innerHeight, 0.1, 1000);


        camera.position.set(0, 0, 800); // Start slightly above and in front of the Earth
        camera.rotation.x = -earthTilt; // Tilt the camera to simulate the Earth's tilt
        camera.position.z = 66; // Adjust based on scene needs
    
        renderer = new THREE.WebGLRenderer({ alpha: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setClearColor(0xC0C0C0, 0);
    
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Higher quality shadows
    
        document.getElementById(containerId).appendChild(renderer.domElement);
    
        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.enableZoom = true;
        controls.enablePan = false;
        controls.dampingFactor = 0.25;
    
        controls.zoomSpeed = 0.666;
        controls.rotateSpeed = 0.25;
    
        controls.minDistance = 10;
        controls.maxDistance = 100;

        // Responsive z-position initialization
        setResponsiveCameraPosition();
    
        addSun();
    
        // Initialize pivot group before adding the moon or other elements
        pivot = new THREE.Group();
        pivot.rotation.z = earthTilt; // Tilt the entire Earth system by 23.4 degrees on the Z-axis
        scene.add(pivot);
    
        addMoon(); // Now add the moon after pivot is defined
    
        // Add planets to the scene
        addPlanet("Mercury", 0xbebebe, 2439.7); // Mercury radius in km
        addPlanet("Venus", 0xffdd44, 6051.8);   // Venus radius in km
        addPlanet("Earth", 0x2266ff, 6371);     // Earth radius in km
        addPlanet("Mars", 0xff4422, 3389.5);    // Mars radius in km
        addPlanet("Jupiter", 0xddddaa, 69911);  // Jupiter radius in km
        addPlanet("Saturn", 0xeeddbb, 58232);   // Saturn radius in km
        addPlanet("Uranus", 0xaaffff, 25362);   // Uranus radius in km
        addPlanet("Neptune", 0x4466ff, 24622);  // Neptune radius in km
    
        addEarthSphere();
        loadTLEData(); // Fetch and visualize the TLE data from node server
    
        // Load and visualize the graticules
        loadAllData();

        initializeSlider();

    
        window.addEventListener('resize', onWindowResize, false);
        onWindowResize(); // run once

        animate();
    }
    
    function addSun() {
        // Ambient light for general low-level lighting
        const ambientLight = new THREE.AmbientLight(0x404040, 1);
        scene.add(ambientLight);
    
        // Directional light acting as the Sun (Fixed, static position)
        directionalLight = new THREE.DirectionalLight(0x8a8a8a, 100); // Intensity for sunlight effect
        const sunDistance = 10; // Scaled down for diorama effect
        directionalLight.position.set(sunDistance, 0, 0); // Sun position along x-axis
        directionalLight.castShadow = true;
        scene.add(directionalLight);
    
        const hemiLight = new THREE.HemisphereLight(0xffffbb, 0x080820, 0.5);
        scene.add(hemiLight);
    
        // Scaled Sun object
        const sunRadius = sphereRadius * 109 / 1000; // Approximate Sun diameter
        const sunGeometry = new THREE.SphereGeometry(sunRadius, 64, 64);
        const sunMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffbb,    // Yellowish color for the sun
            emissive: 0xffa500, // Orange-ish emissive color for glow
            opacity: 0.8,
            alphaHash: true,

        });
        const sunMesh = new THREE.Mesh(sunGeometry, sunMaterial);
        sunMesh.position.copy(directionalLight.position);
        // scene.add(sunMesh);
    }
    
    function addMoon() {
        const moonRadius = sphereRadius * 0.273; // Moon radius is about 27.3% of Earth's radius
        const moonMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff, 
            roughness: 1,
            metalness: 0,
            opacity: 0.5,
            alphaHash: true,
        });
    
        const moonGeometry = new THREE.SphereGeometry(moonRadius, 32, 32);
        moonMesh = new THREE.Mesh(moonGeometry, moonMaterial);
        pivot.add(moonMesh); // Add moon mesh to the pivot so it orbits with Earth
    }
    
    function updateMoonPosition() {
        if (!moonMesh) return; // Ensure moonMesh exists before updating
    
        const moonAverageAltitudeKm = 384400; // Average distance to Moon in kilometers
        const moonDistanceFromEarth = moonAverageAltitudeKm * scaleFactor; // Scaled distance in scene units
    
        // Calculate the moon's angle based on angular speed and centralized simulation time
        const angle = moonAngularSpeed * (simulationTime.getTime() / 1000); // Convert simulation time to seconds
        const eccentricity = 0.0549; // Moon's orbital eccentricity
        const x = moonDistanceFromEarth * (Math.cos(angle) - eccentricity);
        const z = moonDistanceFromEarth * Math.sin(angle) * Math.sqrt(1 - eccentricity ** 2);
    
        moonMesh.position.set(x, 0, z); // Set the moon's position based on the scaled altitude
    }
    
    
    // model planets

    const orbitScaleFactor = 20; // Adjust for more proportionate orbits

    const distanceScaleFactor = 0.05;

    function calculatePlanetPosition(planet, time) {
        const orbitalParams = {
            Mercury: { a: 57.91e6 * distanceScaleFactor, e: 0.205, i: 7.0, T: 0.24 },
            Venus: { a: 108.2e6 * distanceScaleFactor, e: 0.007, i: 3.4, T: 0.62 },
            Earth: { a: 149.6e6 * distanceScaleFactor, e: 0.017, i: 0.0, T: 1.0 },
            Mars: { a: 227.9e6 * distanceScaleFactor, e: 0.093, i: 1.85, T: 1.88 },
            Jupiter: { a: 778.5e6 * distanceScaleFactor, e: 0.049, i: 1.3, T: 11.86 },
            Saturn: { a: 1.429e9 * distanceScaleFactor, e: 0.056, i: 2.49, T: 29.46 },
            Uranus: { a: 2.871e9 * distanceScaleFactor, e: 0.046, i: 0.77, T: 84.01 },
            Neptune: { a: 4.495e9 * distanceScaleFactor, e: 0.009, i: 1.77, T: 164.8 }
        };
    
        const { a, e, i, T } = orbitalParams[planet];
    
        const angle = (2 * Math.PI * time) / T;
        const x = a * (Math.cos(angle) - e) * scaleFactor * distanceCompressionFactor;
        const z = a * Math.sin(angle) * Math.sqrt(1 - e ** 2) * scaleFactor * distanceCompressionFactor;
            
        const cosInclination = Math.cos(i * (Math.PI / 180));
        const sinInclination = Math.sin(i * (Math.PI / 180));
        const adjustedY = 0 * cosInclination - z * sinInclination;
        const adjustedZ = 0 * sinInclination + z * cosInclination;
    
        const sunPosition = directionalLight.position;
        return new THREE.Vector3(x + sunPosition.x, adjustedY + sunPosition.y, adjustedZ + sunPosition.z);
    }
            

    const sizeScaleFactor = 0.5;

    function addPlanet(planetName, color, relativeRadius) {
        const planetRadius = sphereRadius * (relativeRadius / earthRadiusKm) * scaleFactor;
        const geometry = new THREE.SphereGeometry(planetRadius, 32, 32);
        const material = new THREE.MeshStandardMaterial({ color });
        const planetMesh = new THREE.Mesh(geometry, material);
        scene.add(planetMesh);
        planets.push({ name: planetName, mesh: planetMesh });
    }
    
    
    // irl satellite stuff

// Load TLE data from cached JSON file
function loadTLEData() {
    fetch('data/cachedSatellites.json')
        .then(response => {
            if (!response.ok) throw new Error('Failed to load cached TLE data');
            return response.json();
        })
        .then(tleArray => {
            visualizeSatellites(tleArray);
        })
        .catch(error => {
            console.error('Error loading TLE data:', error);
        });
}


let satelliteMeshes = []; // Store satellite mesh references


// Visualize satellites with TLE data from cache
function visualizeSatellites(tleArray) {
    const now = new Date();
    const gmst = satellite.gstime(now);

    tleArray.forEach((sat, index) => {
        const satrec = satellite.twoline2satrec(sat.tleLine1, sat.tleLine2);

        // Calculate orbital parameters from TLE
        const orbitalParams = {
            period: satrec.no ? (2 * Math.PI / satrec.no) * 60 : 1440, // Period in minutes
            inclination: satrec.inclo * (180 / Math.PI), // Inclination in degrees
            eccentricity: satrec.ecco,
            apogee: satrec.apogee,
            perigee: satrec.perigee,
        };

        const satelliteGeometry = new THREE.SphereGeometry(0.004, 1, 1);
        const satelliteMaterial = new THREE.MeshStandardMaterial({
            color: 0xff0000,
            wireframe: true,
            opacity: 0.75,
            alphaHash: true,
            depthTest: true,
            metalness: 1.0,
        });

        const satelliteMesh = new THREE.Mesh(satelliteGeometry, satelliteMaterial);
        satelliteMesh.userData = { satrec, orbitalParams, index }; // Store parameters for updates

        pivot.add(satelliteMesh);
        satelliteMeshes.push(satelliteMesh); // Add mesh to array for easy updates
    });
}

// vars for LOD levels
const MIN_DISTANCE = 8; // Minimum distance to start high LOD visibility
const MAX_DISTANCE = 40; // Maximum distance for low LOD visibility
let MIN_VISIBLE_PERCENTAGE = 0.3; // N% of satellites visible at low detail
let MAX_VISIBLE_PERCENTAGE = 1.0; // 100% of satellites visible at high detail

// vars for satellite size scaling
let MIN_SCALE = 0.75; // Minimum size when zoomed in
let MAX_SCALE = 1.25; // Maximum size when zoomed out

// Adjust visibility percentages and scaling based on device type
function setResponsiveCameraPosition() {
    const isMobile = window.innerWidth <= 768;
    camera.position.z = isMobile ? baseZ * mobileScaleFactor : baseZ;

    // Set zoom limits based on device type
    if (isMobile) {
        controls.minDistance = 10; // Set closer min zoom for mobile
        controls.maxDistance = 500; // Set restricted max zoom for mobile

        // Adjust visibility percentage and scaling for mobile
        MIN_VISIBLE_PERCENTAGE = 0.15; // Show 15% of satellites at max zoom out
        MAX_VISIBLE_PERCENTAGE = 0.75; // Show 75% of satellites at max zoom in on mobile
        MIN_SCALE = 0.75; 
        MAX_SCALE = 1.3; 
    } else {
        controls.minDistance = 10; // Original min zoom for desktop
        controls.maxDistance = 100; // Original max zoom for desktop

        // Adjust visibility percentage and scaling for desktop
        MIN_VISIBLE_PERCENTAGE = 0.3; // Show 30% of satellites at max zoom out
        MAX_VISIBLE_PERCENTAGE = 1.0; // Show 100% of satellites at max zoom in on desktop
        MIN_SCALE = 0.75; 
        MAX_SCALE = 1.25; 
    }
}

// Function to adjust satellite visibility and scale based on camera distance
function adjustSatelliteVisibilityAndScale() {
    const distanceToEarth = camera.position.length();

    // Calculate visible percentage based on distance
    const visiblePercentage = THREE.MathUtils.clamp(
        ((MAX_DISTANCE - distanceToEarth) / (MAX_DISTANCE - MIN_DISTANCE)) * (MAX_VISIBLE_PERCENTAGE - MIN_VISIBLE_PERCENTAGE) + MIN_VISIBLE_PERCENTAGE,
        MIN_VISIBLE_PERCENTAGE,
        MAX_VISIBLE_PERCENTAGE
    );

    const visibleCount = Math.floor(satelliteMeshes.length * visiblePercentage);

    satelliteMeshes.forEach((mesh, index) => {
        if (!mesh) {
            console.warn(`Skipping undefined satellite mesh at index ${index}`);
            return;
        }
        mesh.visible = index < visibleCount;

        // Calculate scale factor based on distance
        const satelliteScaleFactor = THREE.MathUtils.lerp(MIN_SCALE, MAX_SCALE, (distanceToEarth - MIN_DISTANCE) / (MAX_DISTANCE - MIN_DISTANCE));
        mesh.scale.set(satelliteScaleFactor, satelliteScaleFactor, satelliteScaleFactor); // Apply scale factor
    });

    console.log(`Visible satellites: ${visibleCount} of ${satelliteMeshes.length}`);
}

let simulationTime = new Date(); // Starting time for the simulation
const timeDelta = 1000 / 60; // 1-second increment per frame, adjustable
const timeMultiplier = 1000; // Overall simulation speed multiplier

// Update simulation time centrally
function updateSimulationTime() {
    simulationTime = new Date(simulationTime.getTime() + timeDelta * timeMultiplier);
}

// Adjust Earth rotation based on centralized simulation time
function updateEarthRotation() {
    if (isRotationEnabled) {
        pivot.rotation.y += earthRotationSpeed * (timeDelta / 1000) * timeMultiplier; // Convert timeDelta to seconds
    }
}

// Function to update satellite positions with the current distanceCompressionFactor
function updateSatellitePositions() {
    updateSimulationTime(); // Update the simulation time at the start of each frame

    const gmst = satellite.gstime(simulationTime);
    const distanceToEarth = camera.position.length();

    // Determine LOD visibility percentage based on camera distance
    const visiblePercentage = THREE.MathUtils.clamp(
        ((MAX_DISTANCE - distanceToEarth) / (MAX_DISTANCE - MIN_DISTANCE)) * (MAX_VISIBLE_PERCENTAGE - MIN_VISIBLE_PERCENTAGE) + MIN_VISIBLE_PERCENTAGE,
        MIN_VISIBLE_PERCENTAGE,
        MAX_VISIBLE_PERCENTAGE
    );

    const visibleCount = Math.floor(satelliteMeshes.length * visiblePercentage);

    satelliteMeshes.forEach((mesh, index) => {
        if (index >= visibleCount) {
            mesh.visible = false;
            return;
        }
        mesh.visible = true;

        const { satrec } = mesh.userData;
        const positionAndVelocity = satellite.propagate(satrec, simulationTime);
        if (!positionAndVelocity.position) return;

        const positionGd = satellite.eciToGeodetic(positionAndVelocity.position, gmst);

        // Altitude with compression factor
        const compressedAltitude = positionGd.height * scaleFactor * distanceCompressionFactor;
        const position = latLonToVector3(
            satellite.degreesLat(positionGd.latitude),
            satellite.degreesLong(positionGd.longitude),
            sphereRadius + compressedAltitude
        );

        mesh.position.copy(position);

        // Adjust size based on camera distance
        const satelliteScaleFactor = THREE.MathUtils.lerp(MIN_SCALE, MAX_SCALE, (distanceToEarth - MIN_DISTANCE) / (MAX_DISTANCE - MIN_DISTANCE));
        mesh.scale.set(satelliteScaleFactor, satelliteScaleFactor, satelliteScaleFactor);
    });
}

    function onWindowResize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);

        // Update camera position for responsiveness
        setResponsiveCameraPosition();
    }


function animate(time) {
    stats.begin()
    animationFrameId = requestAnimationFrame(animate);

    // Update all elements using centralized simulation time
    adjustSatelliteVisibilityAndScale();
    updateSatellitePositions();
    updateEarthRotation();
    updateMoonPosition();


    // planets moving
    planets.forEach(({ name, mesh }) => {
        const position = calculatePlanetPosition(name, time / 1000); // Scale time if needed
        mesh.position.copy(position);
    });


    controls.update();

    renderer.render(scene, camera);

    // Render the scene based on whether ASCII effect is enabled or not
    stats.end()
}

    // Convert geographic coordinates (lat, lon) to 3D cartesian coordinates
    function latLonToVector3(lat, lon, radius) {
        const phi = (90 - lat) * (Math.PI / 180); // Convert latitude to radians
        const theta = (lon + 180) * (Math.PI / 180); // Convert longitude to radians

        const x = -radius * Math.sin(phi) * Math.cos(theta);
        const z = radius * Math.sin(phi) * Math.sin(theta);
        const y = radius * Math.cos(phi);

        return new THREE.Vector3(x, y, z);
    }

    // Function to add the Earth sphere to match the graticule radius
    function addEarthSphere() {
        const geometry = new THREE.SphereGeometry(sphereRadius, 64, 64); 
        const material = new THREE.MeshStandardMaterial({
            color: 0x000000, //  Earth
            opacity: .95,
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
            'data/ne_110m_land.geojson',
            'data/ne_110m_ocean.geojson',

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

            case 'data/ne_110m_graticules_10.geojson':
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
                console.log("loaded land:", data);
                // addLandToScene(data);
                break;

            case 'data/ne_110m_ocean.geojson':
                // Example: Handle contour line GeoJSON
                console.log("loaded land:", data);
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
                color: 0xaaaaaa, 
                opacity: 0.35,
                alphaHash: true,
                linewidth: 1 
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
    

    function initializeSlider() {
        const slider = document.getElementById("exaggeration-slider");
        const output = document.getElementById("exaggeration-value");
    
        // Function to map slider's linear 0-100 value to an exponential scale between 0.1 and 20
        function mapSliderToExponential(value) {
            const minExp = Math.log10(0.1); // Equivalent to -1
            const maxExp = Math.log10(25);  // Equivalent to about 1.3
            const scale = minExp + (value / 100) * (maxExp - minExp); // Scale to logarithmic range
            return Math.pow(10, scale); // Convert from log scale back to normal scale
        }
    
        // Function to map an exponential target value back to the slider's 0-100 range
        function mapExponentialToSlider(value) {
            const minExp = Math.log10(0.1);
            const maxExp = Math.log10(25);
            const logValue = Math.log10(value);
            return ((logValue - minExp) / (maxExp - minExp)) * 100;
        }
    
        // Initialize the slider position to 1.0x on load
        const initialCompressionFactor = 1.0; // Default 1.0x exaggeration
        const initialSliderValue = mapExponentialToSlider(initialCompressionFactor);
        slider.value = initialSliderValue;
        distanceCompressionFactor = initialCompressionFactor;
        output.textContent = distanceCompressionFactor.toFixed(1) + "x";
    
        // Debounce the update function to prevent excessive calls
        const debouncedUpdateSatellitePositions = debounce(updateSatellitePositions, 1);
    
        // Update the compression factor dynamically on slider input
        slider.addEventListener("input", (event) => {
            const rawValue = parseFloat(event.target.value); // Value between 0 and 100 from slider
            distanceCompressionFactor = mapSliderToExponential(rawValue); // Apply exponential mapping
            output.textContent = distanceCompressionFactor.toFixed(1) + "x";
            debouncedUpdateSatellitePositions(); // Call the debounced function
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