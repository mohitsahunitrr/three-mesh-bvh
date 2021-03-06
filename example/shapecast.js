import * as THREE from 'three/build/three.module';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import * as dat from 'dat.gui';
import Stats from 'stats.js/src/Stats';
import MeshBVHVisualizer from '../src/MeshBVHVisualizer.js';
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from '../src/index.js';

THREE.Mesh.prototype.raycast = acceleratedRaycast;
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;

const params = {

	speed: 1,
	visualizeBounds: false,
	visualBoundsDepth: 10,
	shape: 'sphere',
	position: new THREE.Vector3(),
	rotation: new THREE.Euler(),
	scale: 1,
};

let stats;
let scene, camera, renderer, controls, boundsViz;
let targetMesh;
let shapes = {};

function init() {

	const bgColor = 0x263238 / 2;

	// renderer setup
	renderer = new THREE.WebGLRenderer( { antialias: true } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.setClearColor( bgColor, 1 );
	document.body.appendChild( renderer.domElement );

	// scene setup
	scene = new THREE.Scene();
	scene.fog = new THREE.Fog( 0x263238 / 2, 20, 60 );

	const light = new THREE.DirectionalLight( 0xffffff, 0.5 );
	light.position.set( 1, 1, 1 );
	scene.add( light );
	scene.add( new THREE.AmbientLight( 0xffffff, 0.4 ) );

	// geometry setup
	const radius = 1;
	const tube = 0.4;
	const tubularSegments = 400;
	const radialSegments = 100;

	const knotGeometry = new THREE.TorusKnotBufferGeometry( radius, tube, tubularSegments, radialSegments );
	const material = new THREE.MeshPhongMaterial( { color: 0xffffff, side: THREE.DoubleSide } );
	targetMesh = new THREE.Mesh( knotGeometry, material );
	targetMesh.geometry.computeBoundsTree();
	scene.add( targetMesh );

	// camera setup
	camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 50 );
	camera.position.z = 5;
	camera.far = 100;
	camera.updateProjectionMatrix();

	controls = new OrbitControls( camera, renderer.domElement );

	// stats setup
	stats = new Stats();
	document.body.appendChild( stats.dom );

	const shapeMaterial = new THREE.MeshStandardMaterial( {
		metalness: 0.1,
		transparent: true,
		opacity: 0.75,
		premultipliedAlpha: true
	} );
	shapes.sphere = new THREE.Mesh( new THREE.SphereBufferGeometry( 1, 50, 50 ), shapeMaterial );
	scene.add( shapes.sphere );

	shapes.box = new THREE.Mesh( new THREE.BoxBufferGeometry( 1, 1, 1 ), shapeMaterial );
	scene.add( shapes.box );

	shapes.geometry = new THREE.Mesh( new THREE.TorusKnotBufferGeometry( .5, .2, 200, 50 ), shapeMaterial );
	shapes.geometry.geometry.computeBoundsTree();
	scene.add( shapes.geometry );


	// Code for debugging triangle intersection
	// const t1 = new THREE.Triangle();
	// const t2 = new THREE.Triangle();

	// t1.a.set( - 1, - 1, 0 );
	// t1.b.set( 1, - 1, 0 );
	// t1.c.set( 0, 1, 0 );

	// t2.a.set( - 1, 0, - 0.5 );
	// t2.b.set( 0, 0, 1 );
	// t2.c.set( - 2, 0, 1 );

	// const res = triangleIntersectsTriangle( t1, t2 );
	// console.log( 'intersects ', res );

	// var lineMat = new THREE.LineBasicMaterial({ color: 0x0000ff });

	// var geometry = new THREE.Geometry();
	// geometry.vertices.push( t1.a, t1.b, t1.c, t1.a );
	// var line = new THREE.Line( geometry, lineMat );
	// scene.add( line );

	// var geometry = new THREE.Geometry();
	// geometry.vertices.push( t2.a, t2.b, t2.c, t2.a );
	// var line = new THREE.Line( geometry, lineMat );
	// scene.add( line );

	// 	targetMesh.visible = false;



}

function updateFromOptions() {

	// Update bounds viz
	if ( boundsViz && ! params.visualizeBounds ) {

		scene.remove( boundsViz );
		boundsViz = null;

	}
	if ( ! boundsViz && params.visualizeBounds ) {

		boundsViz = new MeshBVHVisualizer( targetMesh );
		scene.add( boundsViz );

	}

	if ( boundsViz ) {

		boundsViz.depth = params.visualBoundsDepth;

	}

}

let lastTime = window.performance.now();
function render() {

	const delta = window.performance.now() - lastTime;
	lastTime = window.performance.now();

	targetMesh.rotation.y += params.speed * delta * 0.001;
	targetMesh.updateMatrixWorld();

	stats.begin();

	if ( boundsViz ) boundsViz.update();

	renderer.render( scene, camera );
	stats.end();

	// casts
	for ( const shape in shapes ) shapes[ shape ].visible = false;

	const s = params.shape;
	const shape = shapes[ s ];
	shape.visible = true;
	shape.position.copy( params.position );
	shape.rotation.copy( params.rotation );
	shape.scale.set( params.scale, params.scale, params.scale );

	const transformMatrix =
		new THREE.Matrix4()
			.getInverse( targetMesh.matrixWorld )
			.multiply( shape.matrixWorld );

	if ( s === 'sphere' ) {

		const sphere = new THREE.Sphere( undefined, 1 );
		sphere.applyMatrix4( transformMatrix );

		const hit = targetMesh.geometry.boundsTree.intersectsSphere( targetMesh, sphere );
		shape.material.color.set( hit ? 0xE91E63 : 0x666666 );
		shape.material.emissive.set( 0xE91E63 ).multiplyScalar( hit ? 0.25 : 0 );

	} else if ( s === 'box' ) {

		const box = new THREE.Box3();
		box.min.set( - 0.5, - 0.5, - 0.5 );
		box.max.set( 0.5, 0.5, 0.5 );

		const hit = targetMesh.geometry.boundsTree.intersectsBox( targetMesh, box, transformMatrix );
		shape.material.color.set( hit ? 0xE91E63 : 0x666666 );
		shape.material.emissive.set( 0xE91E63 ).multiplyScalar( hit ? 0.25 : 0 );

	} else if ( s === 'geometry' ) {

		const hit = targetMesh.geometry.boundsTree.intersectsGeometry( targetMesh, shape.geometry, transformMatrix );
		shape.material.color.set( hit ? 0xE91E63 : 0x666666 );
		shape.material.emissive.set( 0xE91E63 ).multiplyScalar( hit ? 0.25 : 0 );

	}

	requestAnimationFrame( render );

}

const gui = new dat.GUI();
gui.add( params, 'speed' ).min( 0 ).max( 10 );
gui.add( params, 'visualizeBounds' ).onChange( () => updateFromOptions() );
gui.add( params, 'visualBoundsDepth' ).min( 1 ).max( 40 ).step( 1 ).onChange( () => updateFromOptions() );
gui.add( params, 'shape', [ 'sphere', 'box', 'geometry' ] );

const posFolder = gui.addFolder( 'position' );
posFolder.add( params.position, 'x' ).min( - 5 ).max( 5 ).step( 0.001 );
posFolder.add( params.position, 'y' ).min( - 5 ).max( 5 ).step( 0.001 );
posFolder.add( params.position, 'z' ).min( - 5 ).max( 5 ).step( 0.001 );
posFolder.open();

const rotFolder = gui.addFolder( 'rotation' );
rotFolder.add( params.rotation, 'x' ).min( - Math.PI ).max( Math.PI ).step( 0.001 );
rotFolder.add( params.rotation, 'y' ).min( - Math.PI ).max( Math.PI ).step( 0.001 );
rotFolder.add( params.rotation, 'z' ).min( - Math.PI ).max( Math.PI ).step( 0.001 );
rotFolder.open();

gui.add( params, 'scale' ).min( 0.1 ).max( 2 ).step( 0.001 );

gui.open();

window.addEventListener( 'resize', function () {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize( window.innerWidth, window.innerHeight );

}, false );

init();
updateFromOptions();


// // const sphereMesh = new THREE.Mesh( new THREE.SphereBufferGeometry( 1, 20, 20 ) );
// // scene.add( sphereMesh );

// // const sphere = new THREE.Sphere( undefined, 0.5 );
// // sphere.center.y = -0.9;
// // window.sphere = sphere;

// const boxMesh = new THREE.Mesh( new THREE.BoxBufferGeometry( 1, 1, 1 ) );
// scene.add( boxMesh );
// // boxMesh.rotation.set( Math.PI / 4, Math.PI / 4, 0 );
// // boxMesh.position.y = 1.2;

// const box = new THREE.Box3();
// box.min.set( 1, 1, 1 ).multiplyScalar( - 0.5 );
// box.max.set( 1, 1, 1 ).multiplyScalar( 0.5 );
// window.box = boxMesh;

render();
