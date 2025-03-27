// three.js port of https://ebruneton.github.io/precomputed_atmospheric_scattering
// See shaders.js for license
import * as THREE from 'three'
import { vertexShader, fragmentShader } from './shaders'

// Constants
const TRANSMITTANCE_TEXTURE_WIDTH = 256;
const TRANSMITTANCE_TEXTURE_HEIGHT = 64;
const SCATTERING_TEXTURE_WIDTH = 256;
const SCATTERING_TEXTURE_HEIGHT = 128;
const SCATTERING_TEXTURE_DEPTH = 32;
const IRRADIANCE_TEXTURE_WIDTH = 64;
const IRRADIANCE_TEXTURE_HEIGHT = 16;
const kSunAngularRadius = 0.00935 / 2;
const kLengthUnitInMeters = 1000;

export class Demo {
  constructor(container) {
    this.container = container;
    this.renderer = null;
    this.camera = null;
    this.scene = null;
    this.material = null;

    this.sunZenithAngleRadians = 1.3;
    this.sunAzimuthAngleRadians = 2.9;

    this.init();
  }

  async init() {
    this.setupRenderer();
    this.setupCamera();
    this.setupControls();
    await this.loadTextures();
    this.setupScene();
    this.setupEventListeners();
    
    // Set default view (same as key 1)
    this.setView(9000, 1.47, 0, 1.3, 3, 10);
    
    this.startAnimationLoop();
  }

  setupRenderer() {
    // Find the existing canvas element
    const canvas = document.getElementById('glcanvas');
    
    this.renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    // No need to append the canvas as it's already in the DOM
  }

  setupCamera() {
    this.camera = new THREE.PerspectiveCamera(
      50,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    // Position camera to match the original demo's orientation
    this.camera.position.set(0, -9, 0.9);
    this.camera.up.set(0, 0, 1); // Set camera's up vector to match scene
    this.camera.lookAt(0, 0, 0);
  }

  setupControls() {
    // Disable the default OrbitControls
    // this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    
    // Add event listeners for our custom camera control
    this.renderer.domElement.addEventListener('mousedown', this.onMouseDown.bind(this));
    this.renderer.domElement.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.renderer.domElement.addEventListener('mouseup', this.onMouseUp.bind(this));
    this.renderer.domElement.addEventListener('wheel', this.onMouseWheel.bind(this));
    
    // Store initial values
    this.drag = undefined;
    this.previousMouseX = 0;
    this.previousMouseY = 0;
    
    // Initial camera angles (similar to the original implementation)
    this.viewZenithAngleRadians = 1.47;
    this.viewAzimuthAngleRadians = 0;
    this.viewDistanceMeters = 9000;
  }

  async loadTextures() {
    const [transmittanceData, scatteringData, irradianceData] = await Promise.all(
      ['/transmittance.dat', '/scattering.dat', '/irradiance.dat'].map((file) =>
        fetch(file)
          .then((res) => res.arrayBuffer())
          .then((buffer) => new Float32Array(buffer))
      )
    );

    this.transmittanceTexture = new THREE.DataTexture(
      transmittanceData,
      TRANSMITTANCE_TEXTURE_WIDTH,
      TRANSMITTANCE_TEXTURE_HEIGHT
    );
    this.transmittanceTexture.magFilter = this.transmittanceTexture.minFilter =
      THREE.LinearFilter;
    this.transmittanceTexture.internalFormat = this.renderer.extensions.has(
      'OES_texture_float_linear'
    )
      ? 'RGBA32F'
      : 'RGBA16F';
    this.transmittanceTexture.type = THREE.FloatType;
    this.transmittanceTexture.needsUpdate = true; // three.js unsets this for data textures since r136

    this.scatteringTexture = new THREE.Data3DTexture(
      scatteringData,
      SCATTERING_TEXTURE_WIDTH,
      SCATTERING_TEXTURE_HEIGHT,
      SCATTERING_TEXTURE_DEPTH
    );
    this.scatteringTexture.magFilter = this.scatteringTexture.minFilter = THREE.LinearFilter;
    this.scatteringTexture.internalFormat = 'RGBA16F';
    this.scatteringTexture.type = THREE.FloatType;
    this.scatteringTexture.needsUpdate = true;

    this.irradianceTexture = new THREE.DataTexture(
      irradianceData,
      IRRADIANCE_TEXTURE_WIDTH,
      IRRADIANCE_TEXTURE_HEIGHT
    );
    this.irradianceTexture.magFilter = this.irradianceTexture.minFilter = THREE.LinearFilter;
    this.irradianceTexture.internalFormat = 'RGBA16F';
    this.irradianceTexture.type = THREE.FloatType;
    this.irradianceTexture.needsUpdate = true;
  }

  setupScene() {
    // Create a proper full-screen quad for the sky using PlaneGeometry
    const geometry = new THREE.PlaneGeometry(2, 2);

    this.material = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        transmittance_texture: { value: this.transmittanceTexture },
        scattering_texture: { value: this.scatteringTexture },
        single_mie_scattering_texture: { value: new THREE.Data3DTexture() }, // unused
        irradiance_texture: { value: this.irradianceTexture },
        camera: { value: this.camera.position },
        white_point: { value: new THREE.Vector3(1, 1, 1) },
        exposure: { value: 10 },
        earth_center: {
          value: new THREE.Vector3(0, 0, -6360000 / kLengthUnitInMeters)
        },
        sun_direction: {
          value: new THREE.Vector3(
            Math.sin(this.sunZenithAngleRadians) * Math.cos(this.sunAzimuthAngleRadians),
            Math.sin(this.sunZenithAngleRadians) * Math.sin(this.sunAzimuthAngleRadians),
            Math.cos(this.sunZenithAngleRadians)
          )
        },
        sun_size: {
          value: new THREE.Vector2(
            Math.tan(kSunAngularRadius),
            Math.cos(kSunAngularRadius)
          )
        }
      },
      vertexShader,
      fragmentShader
    });

    this.scene = new THREE.Scene();
    
    // Create sky mesh with the proper geometry
    const skyMesh = new THREE.Mesh(geometry, this.material);
    skyMesh.frustumCulled = false;
    this.scene.add(skyMesh);
    
    // Add ambient light
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.3));
    
    // Set up vector for the scene
    this.scene.up = new THREE.Vector3(0, 0, 1);
    
    // Add visual helpers for debugging
    const gridHelper = new THREE.GridHelper(100, 10);
    // Rotate grid to match the up vector
    gridHelper.rotation.x = Math.PI / 2;
    this.scene.add(gridHelper);
    
    // Add axes helper
    const axesHelper = new THREE.AxesHelper(5);
    this.scene.add(axesHelper);
  }

  setupEventListeners() {
    window.addEventListener('resize', this.onWindowResize.bind(this));
    // Add keyboard event listener
    window.addEventListener('keypress', this.onKeyPress.bind(this));
    // No need to add mouse events here as they're now in setupControls
  }

  onMouseDown(event) {
    this.previousMouseX = event.offsetX;
    this.previousMouseY = event.offsetY;
    
    // If ctrl key is pressed, enable sun movement
    if (event.ctrlKey) {
      this.drag = 'sun';
    } else {
      this.drag = 'camera';
    }
  }
  
  onMouseMove(event) {
    if (!this.drag) return;
    
    const kScale = 500;
    const mouseX = event.offsetX;
    const mouseY = event.offsetY;
    
    if (this.drag === 'sun') {
      // Update sun position
      this.sunZenithAngleRadians -= (this.previousMouseY - mouseY) / kScale;
      this.sunZenithAngleRadians = Math.max(0, Math.min(Math.PI, this.sunZenithAngleRadians));
      this.sunAzimuthAngleRadians += (this.previousMouseX - mouseX) / kScale;
      
      // Update sun direction in the shader
      const sunDirection = new THREE.Vector3(
        Math.sin(this.sunZenithAngleRadians) * Math.cos(this.sunAzimuthAngleRadians),
        Math.sin(this.sunZenithAngleRadians) * Math.sin(this.sunAzimuthAngleRadians),
        Math.cos(this.sunZenithAngleRadians)
      );
      this.material.uniforms.sun_direction.value = sunDirection;
    } else if (this.drag === 'camera') {
      // Update camera position
      this.viewZenithAngleRadians += (this.previousMouseY - mouseY) / kScale;
      this.viewZenithAngleRadians = Math.max(0, Math.min(Math.PI / 2, this.viewZenithAngleRadians));
      this.viewAzimuthAngleRadians += (this.previousMouseX - mouseX) / kScale;
      
      // Update camera position based on spherical coordinates
      const distance = this.viewDistanceMeters / kLengthUnitInMeters;
      const x = distance * Math.sin(this.viewZenithAngleRadians) * Math.cos(this.viewAzimuthAngleRadians);
      const y = distance * Math.sin(this.viewZenithAngleRadians) * Math.sin(this.viewAzimuthAngleRadians);
      const z = distance * Math.cos(this.viewZenithAngleRadians);
      
      this.camera.position.set(x, y, z);
      this.camera.lookAt(0, 0, 0);
    }
    
    this.previousMouseX = mouseX;
    this.previousMouseY = mouseY;
  }
  
  onMouseUp(event) {
    this.drag = undefined;
  }
  
  onMouseWheel(event) {
    // Zoom in/out
    this.viewDistanceMeters *= event.deltaY > 0 ? 1.05 : 1 / 1.05;
    
    // Update camera position
    const distance = this.viewDistanceMeters / kLengthUnitInMeters;
    const x = distance * Math.sin(this.viewZenithAngleRadians) * Math.cos(this.viewAzimuthAngleRadians);
    const y = distance * Math.sin(this.viewZenithAngleRadians) * Math.sin(this.viewAzimuthAngleRadians);
    const z = distance * Math.cos(this.viewZenithAngleRadians);
    
    this.camera.position.set(x, y, z);
    this.camera.lookAt(0, 0, 0);
    
    // Prevent default scroll behavior
    event.preventDefault();
  }

  onWindowResize() {
    const canvas = document.getElementById('glcanvas');
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }

  startAnimationLoop() {
    this.renderer.setAnimationLoop(this.render.bind(this));
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  setView(viewDistanceMeters, viewZenithAngleRadians, viewAzimuthAngleRadians,
      sunZenithAngleRadians, sunAzimuthAngleRadians, exposure) {
    this.viewDistanceMeters = viewDistanceMeters;
    this.viewZenithAngleRadians = viewZenithAngleRadians;
    this.viewAzimuthAngleRadians = viewAzimuthAngleRadians;
    this.sunZenithAngleRadians = sunZenithAngleRadians;
    this.sunAzimuthAngleRadians = sunAzimuthAngleRadians;
    
    // Update camera position
    const distance = this.viewDistanceMeters / kLengthUnitInMeters;
    const x = distance * Math.sin(this.viewZenithAngleRadians) * Math.cos(this.viewAzimuthAngleRadians);
    const y = distance * Math.sin(this.viewZenithAngleRadians) * Math.sin(this.viewAzimuthAngleRadians);
    const z = distance * Math.cos(this.viewZenithAngleRadians);
    
    this.camera.position.set(x, y, z);
    this.camera.lookAt(0, 0, 0);
    
    // Update sun direction
    const sunDirection = new THREE.Vector3(
      Math.sin(this.sunZenithAngleRadians) * Math.cos(this.sunAzimuthAngleRadians),
      Math.sin(this.sunZenithAngleRadians) * Math.sin(this.sunAzimuthAngleRadians),
      Math.cos(this.sunZenithAngleRadians)
    );
    this.material.uniforms.sun_direction.value = sunDirection;
    
    // Update exposure
    this.material.uniforms.exposure.value = exposure;
  }

  onKeyPress(event) {
    const key = event.key;
    if (key == 'h') {
      // Toggle help display if implemented
      const helpElement = document.getElementById('help');
      if (helpElement) {
        const hidden = helpElement.style.display == 'none';
        helpElement.style.display = hidden ? 'block' : 'none';
      }
    } else if (key == '+') {
      // Increase exposure
      this.material.uniforms.exposure.value *= 1.1;
    } else if (key == '-') {
      // Decrease exposure
      this.material.uniforms.exposure.value /= 1.1;
    } else if (key == '1') {
      this.setView(9000, 1.47, 0, 1.3, 3, 10);
    } else if (key == '2') {
      this.setView(9000, 1.47, 0, 1.564, -3, 10);
    } else if (key == '3') {
      this.setView(7000, 1.57, 0, 1.54, -2.96, 10);
    } else if (key == '4') {
      this.setView(7000, 1.57, 0, 1.328, -3.044, 10);
    } else if (key == '5') {
      this.setView(9000, 1.39, 0, 1.2, 0.7, 10);
    } else if (key == '6') {
      this.setView(9000, 1.5, 0, 1.628, 1.05, 200);
    } else if (key == '7') {
      this.setView(7000, 1.43, 0, 1.57, 1.34, 40);
    } else if (key == '8') {
      this.setView(2.7e6, 0.81, 0, 1.57, 2, 10);
    } else if (key == '9') {
      this.setView(1.2e7, 0.0, 0, 0.93, -2, 10);
    }
  }
}
