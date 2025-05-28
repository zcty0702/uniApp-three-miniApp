<template>
    <view class="container">
        <canvas type="webgl" id="webgl" class="canvas"
            @touchstart="handleTouchStart"
            @touchmove="handleTouchMove"
            @touchend="handleTouchEnd">
        </canvas>
        <!-- 添加加载状态显示 -->
        <cover-view v-if="loading" class="loading-container">
            <cover-view class="loading-text">加载中... {{ progress }}%</cover-view>
        </cover-view>
        <cover-view v-if="error" class="error-container">
            <cover-view class="error-text">{{ error }}</cover-view>
        </cover-view>
        <cover-view class="controls-container">
            <cover-view class="controls">
                <cover-view class="control-btn" @click="toggleRotation" 
                    :style="{backgroundColor: autoRotate ? '#4CAF50' : '#f0f0f0'}">
                    ↻
                </cover-view>
                <cover-view class="control-btn" @click="zoomIn">
                    +
                </cover-view>
                <cover-view class="control-btn" @click="zoomOut">
                    -
                </cover-view>
                <cover-view class="control-btn" @click="resetCamera">
                    ⌂
                </cover-view>
            </cover-view>
        </cover-view>
        
        <!-- 添加楼层切换按钮 -->
        <cover-view class="floor-controls">
            <cover-view 
                v-for="floor in floors" 
                :key="floor.id"
                class="floor-btn"
                @click="switchFloor(floor.id)"
                :style="{ backgroundColor: currentFloor === floor.id ? '#4CAF50' : '#f0f0f0' }"
            >
                {{ floor.name }}
            </cover-view>
        </cover-view>
   
    </view>
</template>

<script setup>
   
    import { ref } from 'vue';  // 导入Vue的响应式API
    import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
    import threeLoader from '@/utils/threeLoader.js';
    import TouchControls from '@/utils/touchControls.js';

    // 初始化Three.js相关变量
    let THREE = null;  // Three.js主对象
    let GLTFLoader = null;  // GLTFLoader对象
    let canvas = null;  // WebGL画布
    let renderer = null;  // 渲染器
    let scene = null;  // 场景
    let camera = null;  // 相机
    let controls = null;  // 控制器
    let model = null;  // 3D模型对象
    let touchControls = null;  // 触摸控制器

    // 响应式状态变量
    let autoRotate = ref(false);  // 是否自动旋转
    let loading = ref(true);  // 加载状态
    let progress = ref(0);  // 加载进度
    let error = ref('');  // 错误状态

    // 触摸控制相关变量
    let lastTouchX = 0;  // 上次触摸X坐标
    let lastTouchY = 0;  // 上次触摸Y坐标
    let isDragging = false;  // 是否正在拖拽
    let lastTouchDistance = 0;  // 上次触摸距离（用于缩放）

    // http://118.190.16.36:9031/attach/1F.glb
    // 楼层配置
    const floors = ref([
        { id: 3, name: '3F', modelPath: 'https://dtmall-tel.alicdn.com/edgeComputingConfig/upload_models/1591673169101/RobotExpressive.glb' },
        // { id: 2, name: '2F', modelPath: 'https://threejs.org/examples/models/gltf/DamagedHelmet/glTF/DamagedHelmet.gltf' },
        // { id: 1, name: '1F', modelPath: 'https://threejs.org/examples/models/gltf/DamagedHelmet/glTF/DamagedHelmet.gltf' }
    ]);

    // 当前楼层，默认为第二层
    const currentFloor = ref(3);

    // 存储所有楼层模型
    const floorModels = ref({});

    // 页面加载完成后初始化
    onReady(() => {
        init();
    });

    // 初始化函数
    const init = async () => {
        try {
            console.log('开始初始化Three.js环境');
            const threeInstance = await threeLoader.init('webgl');
            
            // 获取Three.js实例
            THREE = threeInstance.THREE;
            GLTFLoader = threeInstance.GLTFLoader;
            renderer = threeInstance.renderer;
            scene = threeInstance.scene;
            camera = threeInstance.camera;
            controls = threeInstance.controls;
            
            // 初始化触摸控制器
            touchControls = new TouchControls(controls, camera, THREE);
            
            console.log('开始加载模型');
            await loadAllFloors();
            console.log('模型加载完成');
            
            showCurrentFloor();
            loading.value = false;
            animate();
        } catch (err) {
            console.error('初始化失败:', err);
            error.value = `初始化失败: ${err.message}`;
            loading.value = false;
        }
    };

    // 加载所有楼层模型
    const loadAllFloors = async () => {
        for (const floor of floors.value) {
            try {
                const loadedModel = await threeLoader.loadGLTF(floor.modelPath, (percent) => {
                    progress.value = percent;
                });

                if (loadedModel) {
                    // 设置模型位置，根据楼层调整Y轴高度，增加间距
                    const yOffset = (floor.id - 2) * 8;
                    loadedModel.position.y = yOffset;
                    
                    // 标准化模型大小
                    threeLoader.normalizeModelSize(loadedModel);
                    loadedModel.scale.multiplyScalar(4);
                    
                    // 为每个楼层添加不同的颜色标识，便于区分
                    loadedModel.traverse((child) => {
                        if (child.isMesh && child.material) {
                            // 克隆材质以避免共享材质问题
                            if (Array.isArray(child.material)) {
                                child.material = child.material.map(mat => mat.clone());
                            } else {
                                child.material = child.material.clone();
                            }
                            
                            // 设置材质为透明
                            child.material.transparent = true;
                            child.material.opacity = 1.0;
                        }
                    });
                    
                    // 存储模型引用
                    floorModels.value[floor.id] = loadedModel;
                    
                    // 添加到场景
                    scene.add(loadedModel);
                }
            } catch (error) {
                console.error('加载楼层模型失败:', error);
            }
        }
        
        // 调整相机位置以查看所有楼层
        adjustCameraToViewAllFloors();
    };

    // 标准化模型大小
    const normalizeModelSize = (object) => {
        const box = new THREE.Box3().setFromObject(object);
        const size = box.getSize(new THREE.Vector3()).length();
        const scale = 8 / size;

        object.scale.set(scale, scale, scale);
        
        // 重置位置，保留Y轴位置
        const y = object.position.y;
        object.position.set(0, y, 0);
    }

    // 调整相机位置以查看所有楼层
    const adjustCameraToViewAllFloors = () => {
        if (Object.keys(floorModels.value).length === 0) return;
        
        // 创建一个包含所有楼层的边界盒
        const allFloorsBox = new THREE.Box3();
        
        Object.values(floorModels.value).forEach(model => {
            const modelBox = new THREE.Box3().setFromObject(model);
            allFloorsBox.union(modelBox);
        });
        
        // 获取边界盒的中心和大小
        const center = allFloorsBox.getCenter(new THREE.Vector3());
        const size = allFloorsBox.getSize(new THREE.Vector3());
        
        // 计算合适的相机位置
        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = camera.fov * (Math.PI / 180);
        let cameraZ = Math.abs(maxDim / Math.sin(fov / 2));
        
        // 添加一些额外距离
        cameraZ *= 1.8;
        
        // 设置相机位置
        camera.position.set(center.x, center.y, center.z + cameraZ);
        camera.lookAt(center);
        
        // 更新控制器目标
        controls.target.copy(center);
        controls.update();
    };

    // 切换楼层
    const switchFloor = (floorId) => {
        if (currentFloor.value === floorId) return;
        
        currentFloor.value = floorId;
        
        // 获取当前楼层模型
        const currentModel = floorModels.value[floorId];
        if (!currentModel) {
            return;
        }
        
        // 计算楼层中心
        const box = new THREE.Box3().setFromObject(currentModel);
        const center = box.getCenter(new THREE.Vector3());
        
        // 平滑过渡到新位置
        const duration = 1000;
        const startPosition = camera.position.clone();
        const startTarget = controls.target.clone();
        
        // 设置新的目标点为楼层中心
        const newTarget = center.clone();
        
        // 计算新的相机位置，保持与目标的相对方向但调整距离
        const direction = new THREE.Vector3().subVectors(camera.position, controls.target).normalize();
        const distance = box.getSize(new THREE.Vector3()).length() * 1.5;
        const newPosition = new THREE.Vector3().copy(newTarget).add(direction.multiplyScalar(distance));
        
        // 创建动画
        const startTime = Date.now();
        let animationTimer = null;
        
        function animateCamera() {
            if (animationTimer) {
                clearTimeout(animationTimer);
            }
            
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // 使用缓动函数使动画更平滑
            const easeProgress = easeInOutQuad(progress);
            
            // 插值计算当前位置
            camera.position.lerpVectors(startPosition, newPosition, easeProgress);
            controls.target.lerpVectors(startTarget, newTarget, easeProgress);
            
            // 更新控制器
            controls.update();
            
            // 如果动画未完成，继续
            if (progress < 1) {
                animationTimer = setTimeout(animateCamera, 1000 / 60);
            } else {
                // 动画完成后更新楼层透明度
                showCurrentFloor();
            }
        }
        
        // 启动动画
        animateCamera();
    };

    // 缓动函数
    const easeInOutQuad = (t) => {
        return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    };

     

    // 动画循环
    const animate = () => {
        if (!renderer || !scene || !camera) {
            return;
        }

        // 使用requestAnimationFrame
        if (canvas && canvas.requestAnimationFrame) {
            canvas.requestAnimationFrame(animate);
        } else {
            setTimeout(animate, 1000 / 60);
        }
        
        // 如果启用了自动旋转
        if (autoRotate.value && controls) {
            const rotationSpeed = 0.005;
            controls.rotateLeft(rotationSpeed);
        }
        
        // 更新控制器
        if (controls) {
            controls.update();
        }
        
        // 渲染场景
        renderer.render(scene, camera);
    };

    // 处理触摸开始事件
    const handleTouchStart = (event) => {
        touchControls.handleTouchStart(event);
    };

    // 处理触摸移动事件
    const handleTouchMove = (event) => {
        touchControls.handleTouchMove(event);
    };

    // 处理触摸结束事件
    const handleTouchEnd = () => {
        touchControls.handleTouchEnd();
    };

    // 显示当前楼层，其他楼层半透明
    const showCurrentFloor = () => {
        Object.entries(floorModels.value).forEach(([floorId, floorModel]) => {
            const isCurrentFloor = parseInt(floorId) === currentFloor.value;
            
            floorModel.traverse((child) => {
                if (child.isMesh && child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(mat => {
                            mat.opacity = isCurrentFloor ? 1.0 : 0.5;  // 非当前楼层更不透明
                            mat.transparent = true;
                            mat.depthWrite = false;  // 防止透明物体渲染问题
                        });
                    } else {
                        child.material.opacity = isCurrentFloor ? 1.0 : 0.1;  // 非当前楼层更不透明
                        child.material.transparent = true;
                        child.material.depthWrite = false;  // 防止透明物体渲染问题
                    }
                }
            });
        });
        
        // 更新当前模型引用
        model = floorModels.value[currentFloor.value];
    };

    // 切换自动旋转
    const toggleRotation = () => {
        autoRotate.value = !autoRotate.value;
    };

    // 放大
    const zoomIn = () => {
        touchControls.zoomIn();
    };

    // 缩小
    const zoomOut = () => {
        touchControls.zoomOut();
    };

    // 重置相机位置
    const resetCamera = () => {
        touchControls.resetCamera(model);
    };

    // 清理函数
    
</script>

<style>
    page {
        width: 100%;
        height: 100%;
        position: fixed;
        left: 0;
        top: 0;
    }

    .container {
        position: fixed;
        width: 100%;
        height: 100%;
        left: 0;
        top: 0;
        overflow: hidden;
    }

    .canvas {
        width: 100%;
        height: 100%;
        display: block;
        position: absolute;
        left: 0;
        top: 0;
        z-index: 1;
        touch-action: none;
        -webkit-touch-callout: none;
        -webkit-user-select: none;
        user-select: none;
    }

    .cover-view {
      position: absolute;
      top: calc(50% - 150rpx);
      left: calc(50% - 300rpx);
    }
    
    .loading-container {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background-color: rgba(0, 0, 0, 0.7);
        padding: 20rpx 40rpx;
        border-radius: 10rpx;
        z-index: 1000;
    }

    .loading-text {
        color: #ffffff;
        font-size: 28rpx;
    }

    .error-container {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background-color: rgba(255, 0, 0, 0.7);
        padding: 20rpx 40rpx;
        border-radius: 10rpx;
        z-index: 1000;
    }

    .error-text {
        color: #ffffff;
        font-size: 28rpx;
    }

    .controls-container {
        position: fixed;
        right: 20rpx;
        bottom: 20rpx;
        z-index: 999;
    }

    .controls {
        display: flex;
        flex-direction: column;
        gap: 20rpx;
    }

    .control-btn {
        width: 80rpx;
        height: 80rpx;
        border-radius: 50%;
        background-color: rgba(255, 255, 255, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 32rpx;
        color: #333;
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
    }

    .control-btn:active {
        background-color: rgba(255, 255, 255, 0.6);
    }

    .floor-controls {
        position: absolute;
        left: 20rpx;
        bottom: 250px;
        z-index: 999;
        border-radius: 12px 12px 12px 12px;
        background-color: #fff;
    }

    .floor-btn {
        padding: 10px;
    }
</style>
