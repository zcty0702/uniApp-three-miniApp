// #ifdef MP-WEIXIN
import { createScopedThreejs } from 'threejs-miniprogram';
import { registerGLTFLoader } from '@/jsm/loaders/newGLTFloader.js';
// #endif

// #ifdef H5
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
// #endif

import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

class ThreeLoader {
    constructor() {
        this.THREE = null;
        this.GLTFLoader = null;
        this.canvas = null;
        this.renderer = null;
        this.scene = null;
        this.camera = null;
        this.controls = null;
    }

    // 初始化Three.js环境
    async init(canvasId) {
        try {
            await this.createThree(canvasId);
            this.createRenderer();
            this.createScene();
            this.createCamera();
            this.createLight();
            
            // #ifdef MP-WEIXIN
            registerGLTFLoader(this.THREE);
            this.GLTFLoader = this.THREE.GLTFLoader;
            // #endif
            
            // #ifdef H5
            this.GLTFLoader = GLTFLoader;
            // #endif
            
            this.createControls();
            
            return {
                THREE: this.THREE,
                GLTFLoader: this.GLTFLoader,
                renderer: this.renderer,
                scene: this.scene,
                camera: this.camera,
                controls: this.controls
            };
        } catch (error) {
            console.error('Three.js初始化失败:', error);
            throw error;
        }
    }

    // 创建Three.js环境
    async createThree(canvasId) {
        return new Promise((resolve) => {
            // #ifdef MP-WEIXIN
            uni.createSelectorQuery()
                .select(`#${canvasId}`)
                .node()
                .exec((res) => {
                    this.canvas = res[0].node;
                    this.THREE = createScopedThreejs(this.canvas);
                    resolve();
                });
            // #endif

            // #ifdef H5
            const canvasElement = document.getElementById(canvasId);
            this.canvas = canvasElement;
            this.THREE = THREE;
            const dpr = window.devicePixelRatio || 1;
            this.canvas.width = window.innerWidth * dpr;
            this.canvas.height = window.innerHeight * dpr;
            this.canvas.style.width = window.innerWidth + 'px';
            this.canvas.style.height = window.innerHeight + 'px';
            resolve();
            // #endif
        });
    }

    // 创建渲染器
    createRenderer() {
        this.renderer = new this.THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: true
        });
        const info = uni.getSystemInfoSync();
        this.renderer.setSize(info.windowWidth, info.windowHeight);
        this.renderer.setPixelRatio(info.pixelRatio);
        this.renderer.outputColorSpace = this.THREE.SRGBColorSpace;
        this.renderer.shadowMap.enabled = true;
    }

    // 创建场景
    createScene() {
        this.scene = new this.THREE.Scene();
        this.scene.background = new this.THREE.Color(0xeeeeee);
        this.scene.fog = new this.THREE.Fog(0xeeeeee, 10, 100);
    }

    // 创建相机
    createCamera() {
        const aspect = this.canvas.width / this.canvas.height;
        this.camera = new this.THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
        this.camera.position.set(0, 5, 10);
        this.camera.lookAt(0, 0, 0);
    }

    // 创建光源
    createLight() {
        // 环境光
        const ambientLight = new this.THREE.AmbientLight(0xffffff, 1.0);
        this.scene.add(ambientLight);

        // 平行光
        const directionalLight = new this.THREE.DirectionalLight(0xffffff, 1.5);
        directionalLight.position.set(5, 5, 5);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 1024;
        directionalLight.shadow.mapSize.height = 1024;
        this.scene.add(directionalLight);

        // 点光源
        const pointLight = new this.THREE.PointLight(0xffffff, 1.5);
        pointLight.position.set(-5, 5, 5);
        pointLight.castShadow = true;
        pointLight.shadow.mapSize.width = 1024;
        pointLight.shadow.mapSize.height = 1024;
        this.scene.add(pointLight);
    }

    // 创建控制器
    createControls() {
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.1;
        this.controls.rotateSpeed = 0.5;
        this.controls.panSpeed = 0.5;
        this.controls.enableZoom = false;
        this.controls.enablePan = false;
        this.controls.enableRotate = true;
        this.controls.screenSpacePanning = true;
        this.controls.maxPolarAngle = Math.PI;
        this.controls.minPolarAngle = 0;
        this.controls.maxDistance = 50;
        this.controls.minDistance = 1;
    }

    // 加载GLTF模型
    loadGLTF(url, onProgress) {
        return new Promise((resolve, reject) => {
            if (!this.GLTFLoader) {
                reject(new Error('GLTFLoader not initialized'));
                return;
            }

            const loader = new this.GLTFLoader();
            loader.load(
                url,
                (gltf) => {
                    if (!gltf || !gltf.scene) {
                        reject(new Error('模型加载失败：gltf 或 gltf.scene 为空'));
                        return;
                    }

                    gltf.scene.traverse((child) => {
                        if (child.isMesh) {
                            child.material.needsUpdate = true;
                            child.visible = true;
                            if (child.material) {
                                child.material.transparent = true;
                                child.material.opacity = 1.0;
                                child.material.depthWrite = true;
                                child.castShadow = true;
                                child.receiveShadow = true;
                            }
                        }
                    });

                    resolve(gltf.scene);
                },
                (xhr) => {
                    if (xhr.lengthComputable && onProgress) {
                        const percent = (xhr.loaded / xhr.total * 100);
                        onProgress(Math.floor(percent));
                    }
                },
                (error) => {
                    reject(error);
                }
            );
        });
    }

    // 标准化模型大小
    normalizeModelSize(object, targetSize = 8) {
        if (!this.THREE || !object) {
            console.error('THREE未初始化或对象为空');
            return;
        }

        const box = new this.THREE.Box3().setFromObject(object);
        const size = box.getSize(new this.THREE.Vector3()).length();
        const scale = targetSize / size;

        object.scale.set(scale, scale, scale);
        
        // 重置位置，保留Y轴位置
        const y = object.position.y;
        object.position.set(0, y, 0);

        return object;
    }
}

export default new ThreeLoader(); 