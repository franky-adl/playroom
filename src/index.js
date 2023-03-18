// ThreeJS and Third-party deps
import * as THREE from "three"
import * as dat from 'dat.gui'
import Stats from "three/examples/jsm/libs/stats.module"
import { GPUStatsPanel } from "three/examples/jsm/utils/GPUStatsPanel"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls"
import { Reflector } from "three/examples/jsm/objects/Reflector"
import * as CANNON from 'cannon-es'
import CannonDebugger from 'cannon-es-debugger'

// Core boilerplate code deps
import { createCamera, createRenderer, runApp, getDefaultUniforms } from "./core-utils"

// Other deps

global.THREE = THREE
THREE.ColorManagement.enabled = true;

/**************************************************
 * 0. Tweakable parameters for the scene
 *************************************************/
const params = {
  // general scene params
}
const amount = parseInt( window.location.search.slice( 1 ) ) || 10;
const count = Math.pow( amount, 3 );

const raycaster = new THREE.Raycaster();

const color = new THREE.Color();
const white = new THREE.Color().setHex( 0xffffff );

/**************************************************
 * 1. Initialize core threejs components
 *************************************************/
// Create the scene
let scene = new THREE.Scene()

// Create the renderer via 'createRenderer',
// 1st param receives additional WebGLRenderer properties
// 2nd param receives a custom callback to further configure the renderer
let renderer = createRenderer({ antialias: true }, (_renderer) => {
  // _renderer.toneMapping = THREE.ACESFilmicToneMapping
  // e.g. uncomment below if you want the output to be in sRGB color space
  // _renderer.outputEncoding = THREE.sRGBEncoding
})

// Create the camera
// Pass in fov, near, far and camera position respectively
let camera = createCamera(45, 1, 500, { x: 0, y: 75, z: 160 })

/**************************************************
 * 2. Build your scene in this threejs app
 * This app object needs to consist of at least the async initScene() function (it is async so the animate function can wait for initScene() to finish before being called)
 * initScene() is called after a basic threejs environment has been set up, you can add objects/lighting to you scene in initScene()
 * if your app needs to animate things(i.e. not static), include a updateScene(interval, elapsed) function in the app as well
 *************************************************/
let app = {
  async loadTexture(url) {
    this.textureLoader = this.textureLoader || new THREE.TextureLoader()
    return new Promise(resolve => {
      this.textureLoader.load(url, texture => {
        resolve(texture)
      })
    })
  },
  async initScene() {
    // OrbitControls
    this.controls = new OrbitControls(camera, renderer.domElement)
    this.controls.enableDamping = true
    this.controls.target.set( 0, 40, 0 );
    this.controls.maxDistance = 400;
    this.controls.minDistance = 10;
    this.controls.update();

    scene.background = new THREE.Color(0x222222);

    this.world = new CANNON.World({
      gravity: new CANNON.Vec3(0, -60, 0), // m/s²
    })

    // Turn this on if you want to see physical objects in wireframe
    // this.cannonDebugger = new CannonDebugger(scene, this.world, {})
    
    let geometry, material, groundMirror, verticalMirror;
    
    // objects
    const planeGeo = new THREE.PlaneGeometry( 100.1, 100.1 );
    
    // Create a sphere
    const radius = 15 // m
    const spherePhysMat = new CANNON.Material()
    this.spherePhys = new CANNON.Body({
      mass: 5, // kg
      shape: new CANNON.Sphere(radius),
      material: spherePhysMat
    })
    this.spherePhys.position.set(0, 30, 0) // m
    this.world.addBody(this.spherePhys)

    geometry = new THREE.SphereGeometry( 15, 24, 24 )
    material = new THREE.MeshPhongMaterial( { color: 0xffffff, emissive: 0x7b7b7b } );
    this.sphere = new THREE.Mesh( geometry, material );
    this.sphere.position.set(0, 30, 0)
    this.sphere.name = 'sphere'
    scene.add( this.sphere );

    // Create a icosahedron body
    const icosahedronPhysMat = new CANNON.Material()
    this.icosahedronPhys = new CANNON.Body({
      mass: 3, // kg
      shape: new CANNON.Sphere(10),
      material: icosahedronPhysMat
    })
    this.icosahedronPhys.position.set(20, 10, -20) // m
    this.world.addBody(this.icosahedronPhys)

    geometry = new THREE.IcosahedronGeometry( 10, 1 )
    material = new THREE.MeshPhongMaterial( { color: 0x1199ff, emissive: 0x888888, flatShading: true } );
    this.icosahedron = new THREE.Mesh( geometry, material );
    this.icosahedron.position.set(20, 10, -20)
    this.icosahedron.name = 'icosahedron'
    scene.add( this.icosahedron );
    
    // create a list of threejs objects and mats
    this.objList = [this.sphere, this.icosahedron]
    const objMats = [spherePhysMat, icosahedronPhysMat]
    // map threejs objects to physical objects
    this.objMap = {
      'sphere': this.spherePhys,
      'icosahedron': this.icosahedronPhys
    }

    // physical walls, note that you cannot create intercepting static planes
    const planeTopPhysMat = new CANNON.Material()
    const planeTopPhys = new CANNON.Body({
      type: CANNON.Body.STATIC, // can also be achieved by setting the mass to 0
      shape: new CANNON.Plane(),
      material: planeTopPhysMat
    })
    planeTopPhys.position.set(0, 100, 0)
    planeTopPhys.quaternion.setFromEuler(Math.PI / 2, 0, 0) // make it face down
    this.world.addBody(planeTopPhys)

    const planeBottomPhysMat = new CANNON.Material()
    const planeBottomPhys = new CANNON.Body({
      type: CANNON.Body.STATIC, // can also be achieved by setting the mass to 0
      shape: new CANNON.Plane(),
      material: planeBottomPhysMat
    })
    planeBottomPhys.quaternion.setFromEuler(-Math.PI / 2, 0, 0) // make it face up
    this.world.addBody(planeBottomPhys)

    const planeFrontPhysMat = new CANNON.Material()
    const planeFrontPhys = new CANNON.Body({
      type: CANNON.Body.STATIC, // can also be achieved by setting the mass to 0
      shape: new CANNON.Box(new CANNON.Vec3(50, 50, 50)),
      material: planeFrontPhysMat
    })
    planeFrontPhys.position.set(0, 50, 100)
    this.world.addBody(planeFrontPhys)

    const planeBackPhysMat = new CANNON.Material()
    const planeBackPhys = new CANNON.Body({
      type: CANNON.Body.STATIC, // can also be achieved by setting the mass to 0
      shape: new CANNON.Box(new CANNON.Vec3(50, 50, 50)),
      material: planeBackPhysMat
    })
    planeBackPhys.position.set(0, 50, -100)
    this.world.addBody(planeBackPhys)

    const planeRightPhysMat = new CANNON.Material()
    const planeRightPhys = new CANNON.Body({
      type: CANNON.Body.STATIC, // can also be achieved by setting the mass to 0
      shape: new CANNON.Box(new CANNON.Vec3(50, 50, 50)),
      material: planeRightPhysMat
    })
    planeRightPhys.position.set(100, 50, 0)
    this.world.addBody(planeRightPhys)

    const planeLeftPhysMat = new CANNON.Material()
    const planeLeftPhys = new CANNON.Body({
      type: CANNON.Body.STATIC, // can also be achieved by setting the mass to 0
      shape: new CANNON.Box(new CANNON.Vec3(50, 50, 50)),
      material: planeLeftPhysMat
    })
    planeLeftPhys.position.set(-100, 50, 0)
    this.world.addBody(planeLeftPhys)

    const planeMats = [planeTopPhysMat, planeBottomPhysMat, planeFrontPhysMat, planeBackPhysMat, planeRightPhysMat, planeLeftPhysMat]

    // walls

    const planeTop = new THREE.Mesh( planeGeo, new THREE.MeshPhongMaterial( { color: 0xffffff } ) );
    planeTop.position.y = 100;
    planeTop.rotateX( Math.PI / 2 );
    scene.add( planeTop );

    const planeBottom = new THREE.Mesh( planeGeo, new THREE.MeshPhongMaterial( { color: 0xffffff } ) );
    planeBottom.rotateX( - Math.PI / 2 );
    scene.add( planeBottom );

    const planeFront = new THREE.Mesh( planeGeo, new THREE.MeshPhongMaterial( { color: 0xbbbbfe } ) );
    planeFront.position.z = 50;
    planeFront.position.y = 50;
    planeFront.rotateY( Math.PI );
    scene.add( planeFront );

    const planeRight = new THREE.Mesh( planeGeo, new THREE.MeshPhongMaterial( { color: 0x00ff00 } ) );
    planeRight.position.x = 50;
    planeRight.position.y = 50;
    planeRight.rotateY( - Math.PI / 2 );
    scene.add( planeRight );

    const planeLeft = new THREE.Mesh( planeGeo, new THREE.MeshPhongMaterial( { color: 0xff0000 } ) );
    planeLeft.position.x = - 50;
    planeLeft.position.y = 50;
    planeLeft.rotateY( Math.PI / 2 );
    scene.add( planeLeft );

    // Interact by raycasting

    window.addEventListener("mousedown", (e) => {
      let mouse = new THREE.Vector2()
      mouse.x = ( e.clientX / window.innerWidth ) * 2 - 1;
      mouse.y = - ( e.clientY / window.innerHeight ) * 2 + 1;
      raycaster.setFromCamera( mouse, camera );
      const intersections = raycaster.intersectObjects( this.objList );
      for (let i = 0; i < intersections.length; i++) {
        let physObj = this.objMap[intersections[i].object.name]

        const impulse = new CANNON.Vec3(500 * (Math.random() * 2 - 1), 500 * (Math.random() * 2 - 1), 500 * (Math.random() * 2 - 1))
        physObj.applyImpulse(impulse)
      }
    })

    // Bounce behaviors
    for (const planeMat of planeMats) {
      for (const objMat of objMats) {
        this.world.addContactMaterial(new CANNON.ContactMaterial(planeMat, objMat, { friction: 0.1, restitution: 0.6 }))
      }
    }

    // Reflectors

    geometry = new THREE.CircleGeometry( 40, 64 );
    groundMirror = new Reflector( geometry, {
      clipBias: 0.003,
      textureWidth: window.innerWidth * window.devicePixelRatio,
      textureHeight: window.innerHeight * window.devicePixelRatio,
      color: 0xb5b5b5
    } );
    groundMirror.position.y = 0.5;
    groundMirror.rotateX( - Math.PI / 2 );
    scene.add( groundMirror );

    geometry = new THREE.PlaneGeometry( 100, 100 );
    verticalMirror = new Reflector( geometry, {
      clipBias: 0.003,
      textureWidth: window.innerWidth * window.devicePixelRatio,
      textureHeight: window.innerHeight * window.devicePixelRatio,
      color: 0xc1cbcb
    } );
    verticalMirror.position.y = 50;
    verticalMirror.position.z = - 50;
    scene.add( verticalMirror );

    // lights
    const mainLight = new THREE.PointLight( 0xe7e7e7, 1.5, 250 );
    mainLight.position.y = 60;
    scene.add( mainLight );

    const greenLight = new THREE.PointLight( 0x00ff00, 0.25, 250 );
    greenLight.position.set( 550, 50, 0 );
    scene.add( greenLight );

    const redLight = new THREE.PointLight( 0xff0000, 0.25, 250 );
    redLight.position.set( - 550, 50, 0 );
    scene.add( redLight );

    const blueLight = new THREE.PointLight( 0xbbbbfe, 0.25, 250 );
    blueLight.position.set( 0, 50, 550 );
    scene.add( blueLight );

    // GUI controls
    const gui = new dat.GUI()

    // Stats - click to show different panels
    this.stats1 = new Stats()
    this.gpuPanel = new GPUStatsPanel( renderer.getContext() );
    this.stats1.addPanel( this.gpuPanel );
    this.stats1.showPanel(0) // Panel 0 = fps
    this.stats1.domElement.style.cssText = "position:absolute;top:0px;left:0px;"
    // this.container is the parent DOM element of the threejs canvas element
    this.container.appendChild(this.stats1.domElement)
  },
  // @param {number} interval - time elapsed between 2 frames
  // @param {number} elapsed - total time elapsed since app start
  updateScene(interval, elapsed) {
    this.controls.update()
    this.stats1.update()

    // this.cannonDebugger.update()

    this.world.fixedStep()

    // update objects positions from physical calculations
    for (const obj of this.objList) {
      obj.position.copy(this.objMap[obj.name].position)
      obj.quaternion.copy(this.objMap[obj.name].quaternion)
    }
  }
}

/**************************************************
 * 3. Run the app
 * 'runApp' will do most of the boilerplate setup code for you:
 * e.g. HTML container, window resize listener, mouse move/touch listener for shader uniforms, THREE.Clock() for animation
 * Executing this line puts everything together and runs the app
 * ps. if you don't use custom shaders, pass undefined to the 'uniforms'(2nd-last) param
 * ps. if you don't use post-processing, pass undefined to the 'composer'(last) param
 *************************************************/
runApp(app, scene, renderer, camera, true, undefined, undefined)
