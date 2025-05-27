<template>
    <view class="container">
        <canvas type="webgl" id="webgl" class="canvas"
            @touchstart="handleTouchStart"
            @touchmove="handleTouchMove"
            @touchend="handleTouchEnd">
             
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
        </canvas>
    </view>
</template>

<script setup>
    // 导入必要的库和组件
    import { createScopedThreejs } from 'threejs-miniprogram';  // 导入Three.js小程序适配器
    import { onReady } from '@dcloudio/uni-app';  // 导入uni-app生命周期钩子
    import { registerGLTFLoader } from '@/jsm_weixin/loaders/newGLTFloader.js';  // 导入GLTF加载器
    import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';  // 导入轨道控制器
    import { ref } from 'vue';  // 导入Vue的响应式API

    // 初始化Three.js相关变量
    let THREE = null;  // Three.js主对象
    let canvas = null;  // WebGL画布
    let renderer = null;  // 渲染器
    let scene = null;  // 场景
    let camera = null;  // 相机
    let controls = null;  // 控制器
    let GLTFLoader = null;  // GLTF加载器
    let model = null;  // 3D模型对象

    // 响应式状态变量
    let autoRotate = ref(false);  // 是否自动旋转
    let loading = ref(true);  // 加载状态
    let progress = ref(0);  // 加载进度

    // 触摸控制相关变量
    let lastTouchX = 0;  // 上次触摸X坐标
    let lastTouchY = 0;  // 上次触摸Y坐标
    let isDragging = false;  // 是否正在拖拽
    let lastTouchDistance = 0;  // 上次触摸距离（用于缩放）

    // 标记点和导航线数组
    let markers = ref([]);  // 存储标记点
    let navigationLines = ref([]);  // 存储导航线

    // 楼层配置
    const floors = ref([
        { id: 1, name: '1F', modelPath: 'http://118.190.16.36:9006/attach/g3.glb' },
        { id: 2, name: '2F', modelPath: 'http://118.190.16.36:9006/attach/g3.glb' },
        { id: 3, name: '3F', modelPath: 'http://118.190.16.36:9006/attach/g3.glb' }
    ]);

    // 当前楼层，默认为第二层
    const currentFloor = ref(2);

    // 存储所有楼层模型
    const floorModels = ref({});

    // 页面加载完成后初始化
    onReady(() => {
        init();
    });

    // 初始化函数
    const init = async () => {
        try {
            await createThree();  // 创建Three.js环境
            createRenderer();  // 创建渲染器
            createScene();  // 创建场景
            createCamera();  // 创建相机
            createLight();  // 创建光源
            createControls();  // 创建控制器

            // 注册GLTF加载器
            registerGLTFLoader(THREE);
            GLTFLoader = THREE.GLTFLoader;

            // 加载所有楼层模型
            await loadAllFloors();
            
            // 显示当前楼层
            showCurrentFloor();

            loading.value = false;
            console.log('模型加载完成，开始渲染');

            // 开始渲染
            renderer.render(scene, camera);
            animate();
        } catch (error) {
            console.error('初始化失败:', error);
            loading.value = false;
        }
    };

    // 加载所有楼层模型 - 增加模型大小和楼层间距
    const loadAllFloors = async () => {
        console.log("开始加载所有楼层模型...");
        
        for (const floor of floors.value) {
            console.log(`开始加载楼层 ${floor.id}: ${floor.name}, 路径: ${floor.modelPath}`);
            
            try {
                const loadedModel = await loadGLTF(floor.modelPath);
                
                if (loadedModel) {
                    // 设置模型位置，根据楼层调整Y轴高度，增加间距
                    const yOffset = (floor.id - 2) * 8; // 增加间距到8个单位（原来是5）
                    loadedModel.position.y = yOffset;
                    
                    console.log(`楼层 ${floor.id} 加载完成，设置位置Y: ${yOffset}`);
                    
                    // 标准化模型大小
                    normalizeModelSize(loadedModel);
                    loadedModel.scale.multiplyScalar(4); // 放大模型（原来是3）
                    
                    // 为每个楼层添加不同的颜色标识，便于区分
                    loadedModel.traverse((child) => {
                        if (child.isMesh && child.material) {
                            // 克隆材质以避免共享材质问题
                            if (Array.isArray(child.material)) {
                                child.material = child.material.map(mat => mat.clone());
                            } else {
                                child.material = child.material.clone();
                            }
                            
                            // 根据楼层设置不同的颜色色调
                            if (floor.id === 1) {
                                // 一楼偏红
                                child.material.color = new THREE.Color(1.0, 0.8, 0.8);
                            } else if (floor.id === 3) {
                                // 三楼偏蓝
                                child.material.color = new THREE.Color(0.8, 0.8, 1.0);
                            }
                            // 二楼保持原色
                        
                            // 设置材质为透明
                            child.material.transparent = true;
                            child.material.opacity = 1.0; // 初始完全不透明
                        }
                    });
                    
                    // 存储模型引用
                    floorModels.value[floor.id] = loadedModel;
                    
                    // 添加到场景
                    scene.add(loadedModel);
                    console.log(`楼层 ${floor.id} 已添加到场景`);
                } else {
                    console.error(`楼层 ${floor.id} 加载失败: 返回的模型为空`);
                }
            } catch (error) {
                console.error(`楼层 ${floor.id} 加载出错:`, error);
            }
        }
        
        // 调整相机位置以查看所有楼层
        adjustCameraToViewAllFloors();
    };

    // 添加楼层标签 - 修复小程序兼容性问题
    const addFloorLabel = (floorId, floorModel, yOffset) => {
        if (!scene || !THREE) return;
        
        try {
            // 创建一个简单的精灵材质，不使用Canvas
            const material = new THREE.SpriteMaterial({
                color: 0xffffff,
                transparent: true
            });
            
            // 创建精灵
            const sprite = new THREE.Sprite(material);
            sprite.scale.set(1, 0.5, 1);
            
            // 获取模型边界盒
            const box = new THREE.Box3().setFromObject(floorModel);
            const center = box.getCenter(new THREE.Vector3());
            
            // 设置标签位置在模型中心上方
            sprite.position.set(center.x, yOffset + 1, center.z);
            
            // 添加到场景
            scene.add(sprite);
            console.log(`已为楼层 ${floorId} 添加标签`);
            
            // 创建一个简单的文本对象作为楼层标识
            const textGeometry = new THREE.TextGeometry(`${floorId}F`, {
                size: 0.5,
                height: 0.1,
            });
            
            const textMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
            const textMesh = new THREE.Mesh(textGeometry, textMaterial);
            
            // 将文本放在精灵位置
            textMesh.position.copy(sprite.position);
            
            // 添加到场景
            scene.add(textMesh);
        } catch (error) {
            console.error(`为楼层 ${floorId} 创建标签时出错:`, error);
            
            // 使用备用方法 - 创建一个简单的立方体作为标记
            try {
                const geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
                const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
                const cube = new THREE.Mesh(geometry, material);
                
                // 获取模型边界盒
                const box = new THREE.Box3().setFromObject(floorModel);
                const center = box.getCenter(new THREE.Vector3());
                
                // 设置立方体位置在模型中心上方
                cube.position.set(center.x, yOffset + 1, center.z);
                
                // 添加到场景
                scene.add(cube);
                console.log(`已为楼层 ${floorId} 添加备用标记`);
            } catch (backupError) {
                console.error(`创建备用标记也失败:`, backupError);
            }
        }
    };

    // 调整相机位置以查看所有楼层 - 增加相机距离
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
        cameraZ *= 1.8; // 增加相机距离（原来是1.5）
        
        // 设置相机位置
        camera.position.set(center.x, center.y, center.z + cameraZ);
        camera.lookAt(center);
        
        // 更新控制器目标
        controls.target.copy(center);
        controls.update();
        
        console.log("相机已调整以查看所有楼层", {
            center,
            cameraPosition: camera.position,
            cameraLookAt: controls.target
        });
    };

    // 显示当前楼层，其他楼层半透明
    const showCurrentFloor = () => {
        Object.entries(floorModels.value).forEach(([floorId, floorModel]) => {
            const isCurrentFloor = parseInt(floorId) === currentFloor.value;
            
            floorModel.traverse((child) => {
                if (child.isMesh && child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(mat => {
                            mat.opacity = isCurrentFloor ? 1.0 : 0.3;
                        });
                    } else {
                        child.material.opacity = isCurrentFloor ? 1.0 : 0.3;
                    }
                }
            });
        });
        
        // 更新当前模型引用
        model = floorModels.value[currentFloor.value];
    };

    // 切换楼层 - 使用定时器替代requestAnimationFrame
    const switchFloor = (floorId) => {
        if (currentFloor.value === floorId) return;
        
        console.log(`切换到楼层 ${floorId}`);
        currentFloor.value = floorId;
        
        // 获取当前楼层模型
        const currentModel = floorModels.value[floorId];
        if (!currentModel) {
            console.error(`未找到楼层 ${floorId} 的模型`);
            return;
        }
        
        // 计算楼层中心
        const box = new THREE.Box3().setFromObject(currentModel);
        const center = box.getCenter(new THREE.Vector3());
        
        // 平滑过渡到新位置
        const duration = 1000; // 过渡时间(毫秒)
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
            // 清除之前的定时器
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
                // 使用定时器代替requestAnimationFrame
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

    // 创建Three.js环境
    const createThree = () => {
        return new Promise((resolve) => {
            uni.createSelectorQuery()
                .select('#webgl')
                .node()
                .exec((res) => {
                    canvas = res[0].node;
                    THREE = createScopedThreejs(canvas);
                    resolve();
                });
        });
    }

    // 创建渲染器
    const createRenderer = () => {
        renderer = new THREE.WebGLRenderer();
        renderer.setSize(canvas.width, canvas.height);
    }

    // 创建场景
    const createScene = () => {
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0xeeeeee);  // 设置场景背景色
    }

    // 创建相机
    const createCamera = () => {
        camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 1000);
        camera.position.set(0, 2, 5);  // 设置相机位置
        camera.lookAt(0, 0, 0);  // 设置相机朝向
    }

    // 加载GLTF模型
    const loadGLTF = (url) => {
        return new Promise((resolve, reject) => {
            if (!GLTFLoader) {
                console.error('GLTFLoader未初始化');
                reject(new Error('GLTFLoader not initialized'));
                return;
            }

            console.log('开始下载模型文件:', url);

            // 下载模型文件
            uni.downloadFile({
                url: url,
                success: (res) => {
                    if (res.statusCode === 200) {
                        console.log('文件下载成功:', res.tempFilePath);

                        // 加载模型
                        const loader = new GLTFLoader();
                        console.log('GLTFLoader创建成功，开始加载模型');
                        
                        loader.load(res.tempFilePath,
                            (gltf) => {
                                console.log('模型加载成功:', gltf);
                                if (!gltf) {
                                    reject(new Error('模型加载失败：gltf 对象为空'));
                                    return;
                                }

                                if (!gltf.scene) {
                                    reject(new Error('模型加载失败：gltf.scene 为空'));
                                    return;
                                }

                                console.log('模型场景有效，准备返回');
                                resolve(gltf.scene);
                            },
                            (progress) => {
                                console.log('加载进度:', progress);
                            },
                            (error) => {
                                console.error('加载错误:', error);
                                reject(error);
                            }
                        );
                    } else {
                        console.error('文件下载失败:', res.statusCode);
                        reject(new Error(`文件下载失败: ${res.statusCode}`));
                    }
                },
                fail: (error) => {
                    console.error('下载失败:', error);
                    reject(error);
                }
            });
        });
    }

    // 创建光源
    const createLight = () => {
        // 环境光
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        scene.add(ambientLight);

        // 平行光
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(5, 5, 5);
        scene.add(directionalLight);

        // 点光源
        const pointLight = new THREE.PointLight(0xffffff, 1);
        pointLight.position.set(-5, 5, 5);
        scene.add(pointLight);
    }

    // 创建控制器
    const createControls = () => {
        controls = new OrbitControls(camera, renderer.domElement);
        
        // 设置控制器参数
        controls.enableDamping = true;  // 启用阻尼效果
        controls.dampingFactor = 0.1;  // 阻尼系数
        controls.rotateSpeed = 0.5;  // 旋转速度
        controls.panSpeed = 0.5;  // 平移速度
        
        // 禁用缩放和平移，只允许旋转
        controls.enableZoom = false;
        controls.enablePan = false;
        controls.enableRotate = true;
        controls.screenSpacePanning = true;
        
        // 设置旋转角度限制
        controls.maxPolarAngle = Math.PI;
        controls.minPolarAngle = 0;
        controls.maxDistance = 50;
        controls.minDistance = 1;

        // 自定义左右旋转方法
        controls.rotateLeft = function(angle) {
            const rotationMatrix = new THREE.Matrix4();
            rotationMatrix.makeRotationY(angle);
            camera.position.applyMatrix4(rotationMatrix);
            camera.lookAt(controls.target);
        };

        // 自定义上下旋转方法
        controls.rotateUp = function(angle) {
            const rotationMatrix = new THREE.Matrix4();
            rotationMatrix.makeRotationX(angle);
            camera.position.applyMatrix4(rotationMatrix);
            camera.lookAt(controls.target);
        };
    }

    // 相机过渡动画 - 修复requestAnimationFrame问题
    const animateCameraTransition = (targetCenter, targetBox, duration) => {
        const startPosition = camera.position.clone();
        const startTarget = controls.target.clone();
        const newTarget = targetCenter.clone();
        
        // 计算新的相机位置，保持与目标的相对方向但调整距离
        const direction = new THREE.Vector3().subVectors(camera.position, controls.target).normalize();
        const distance = targetBox.getSize(new THREE.Vector3()).length() * CONFIG.cameraDistanceFactor;
        const newPosition = new THREE.Vector3().copy(newTarget).add(direction.multiplyScalar(distance));
        
        // 创建动画
        const startTime = Date.now();
        
        function animateCamera() {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeProgress = easeInOutQuad(progress);
            
            // 插值计算当前位置
            camera.position.lerpVectors(startPosition, newPosition, easeProgress);
            controls.target.lerpVectors(startTarget, newTarget, easeProgress);
            
            // 更新控制器
            controls.update();
            
            // 如果动画未完成，继续
            if (progress < 1) {
                // 使用canvas的requestAnimationFrame而不是全局的
                canvas.requestAnimationFrame(animateCamera);
            } else {
                // 动画完成后更新楼层透明度
                showCurrentFloor();
            }
        }
        
        // 启动动画 - 使用canvas的requestAnimationFrame
        canvas.requestAnimationFrame(animateCamera);
    };

    // 动画循环 - 使用定时器替代requestAnimationFrame
    const animate = () => {
        // 使用定时器代替requestAnimationFrame
        setTimeout(animate, 1000 / 60);
        
        // 如果启用了自动旋转
        if (autoRotate.value) {
            const rotationSpeed = 0.005;
            controls.rotateLeft(rotationSpeed);
        }
        
        renderer.render(scene, camera);
        controls.update();
    };

    // 触摸开始事件处理
    const handleTouchStart = (event) => {
        if (!event.touches || event.touches.length === 0) return;
        if (event.touches.length === 1) {
            // 单指触摸，记录起始位置
            const touch = event.touches[0];
            lastTouchX = touch.pageX;
            lastTouchY = touch.pageY;
            isDragging = true;
        } else if (event.touches.length === 2) {
            // 双指触摸，计算初始距离
            const dx = event.touches[0].pageX - event.touches[1].pageX;
            const dy = event.touches[0].pageY - event.touches[1].pageY;
            lastTouchDistance = Math.sqrt(dx * dx + dy * dy);
            isDragging = false;
        }
    };

    // 触摸移动事件处理
    const handleTouchMove = (event) => {
        if (!controls || !event.touches || event.touches.length === 0) return;
        if (event.touches.length === 1 && isDragging) {
            // 单指移动，旋转模型
            const touch = event.touches[0];
            const deltaX = touch.pageX - lastTouchX;
            const deltaY = touch.pageY - lastTouchY;
            if (Math.abs(deltaX) > Math.abs(deltaY)) {
                // 水平移动大于垂直移动，进行水平旋转
                const rotationSpeed = 0.005;
                controls.rotateLeft(deltaX * rotationSpeed);
            } else {
                // 垂直移动大于水平移动，进行垂直旋转
                const rotationSpeed = 0.005;
                controls.rotateUp(-deltaY * rotationSpeed);
            }
            lastTouchX = touch.pageX;
            lastTouchY = touch.pageY;
        } else if (event.touches.length === 2) {
            // 双指移动，缩放模型
            const dx = event.touches[0].pageX - event.touches[1].pageX;
            const dy = event.touches[0].pageY - event.touches[1].pageY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (lastTouchDistance > 0) {
                const zoomSpeed = 0.005;
                const delta = distance - lastTouchDistance;
                if (camera && controls) {
                    camera.position.multiplyScalar(1 - delta * zoomSpeed);
                }
            }
            lastTouchDistance = distance;
        }
    };

    // 触摸结束事件处理
    const handleTouchEnd = (event) => {
        isDragging = false;
        lastTouchDistance = 0;
    };

    // 标准化模型大小
    const normalizeModelSize = (object) => {
        const box = new THREE.Box3().setFromObject(object);
        const size = box.getSize(new THREE.Vector3()).length();
        const scale = 8 / size;  // 增加默认大小

        object.scale.set(scale, scale, scale);
        
        // 重置位置，保留Y轴位置
        const y = object.position.y;
        object.position.set(0, y, 0);
        
        console.log('模型已标准化，大小:', size, '缩放比例:', scale);
    }

    // 调整相机位置以适应模型
    const fitCameraToObject = (camera, controls, object, offset = 1.5) => {
        if (!camera || !controls || !object) {
            console.warn('fitCameraToObject: 缺少必要的参数');
            return;
        }

        const box = new THREE.Box3().setFromObject(object);
        const size = box.getSize(new THREE.Vector3()).length();
        const center = box.getCenter(new THREE.Vector3());

        camera.position.copy(center);
        camera.position.z += size * offset;
        camera.lookAt(center);

        controls.target.copy(center);
        controls.update();
    }

    // 切换自动旋转
    const toggleRotation = () => {
        autoRotate.value = !autoRotate.value;
    };

    // 放大
    const zoomIn = () => {
        if (!camera || !controls) return;
        const zoomSpeed = 0.1;
        camera.position.multiplyScalar(1 - zoomSpeed);
    };

    // 缩小
    const zoomOut = () => {
        if (!camera || !controls) return;
        const zoomSpeed = 0.1;
        camera.position.multiplyScalar(1 + zoomSpeed);
    };

    // 重置相机位置
    const resetCamera = () => {
        if (model) {
            fitCameraToObject(camera, controls, model);
        } else {
            camera.position.set(0, 0, 5);
            camera.lookAt(0, 0, 0);
            if (controls) {
                controls.target.set(0, 0, 0);
                controls.update();
            }
        }
    };

    // 添加固定标记点
    const addFixedMarkers = () => {
        if (!scene || !THREE) return;

        // 加载标记点纹理
        const textureLoader = new THREE.TextureLoader();
        const markerTexture = textureLoader.load('/static/images/marker.png');

        // 定义标记点位置
        const positions = [
            { x: 0, y: 1, z: 0, name: '顶部', size: 10 },
            { x: 1, y: 0, z: 0, name: '右侧', size: 10 },
            { x: -1, y: 0, z: 0, name: '左侧', size: 10 },
            { x: 0, y: 0, z: 1, name: '前方', size: 10 },
            { x: 0, y: 0, z: -1, name: '后方', size: 10 }
        ];

        // 创建标记点
        positions.forEach(pos => {
            const spriteMaterial = new THREE.SpriteMaterial({ 
                map: markerTexture,
                color: 0xffffff,
                transparent: true,
                opacity: 0.8,
                sizeAttenuation: false
            });
            
            const sprite = new THREE.Sprite(spriteMaterial);
            sprite.position.set(pos.x, pos.y, pos.z);
            
            const scale = pos.size / 100;
            sprite.scale.set(scale, scale, 1);
            
            scene.add(sprite);
            markers.value.push(sprite);
        });

        // 创建导航线
        createNavigationLines();
    };

    // 创建导航线
    const createNavigationLines = () => {
        if (!scene || !THREE || markers.value.length < 2) return;

        // 创建线条材质
        const lineMaterial = new THREE.LineBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.5,
            linewidth: 2
        });

        // 连接所有标记点
        for (let i = 0; i < markers.value.length - 1; i++) {
            const points = [];
            points.push(markers.value[i].position);
            points.push(markers.value[i + 1].position);

            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const line = new THREE.Line(geometry, lineMaterial);
            
            scene.add(line);
            navigationLines.value.push(line);
        }

        // 连接最后一个点和第一个点，形成闭环
        const points = [];
        points.push(markers.value[markers.value.length - 1].position);
        points.push(markers.value[0].position);

        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(geometry, lineMaterial);
        
        scene.add(line);
        navigationLines.value.push(line);
    };

    // 清理函数
    const cleanup = () => {
        // 清理标记点
        markers.value.forEach(marker => {
            if (marker && scene) {
                scene.remove(marker);
                if (marker.material) {
                    marker.material.dispose();
                }
            }
        });
        markers.value = [];

        // 清理导航线
        navigationLines.value.forEach(line => {
            if (line && scene) {
                scene.remove(line);
                if (line.geometry) {
                    line.geometry.dispose();
                }
                if (line.material) {
                    line.material.dispose();
                }
            }
        });
        navigationLines.value = [];
    };
</script>

<style>
    .cover-view {
      position: absolute;
      top: calc(50% - 150rpx);
      left: calc(50% - 300rpx);
      /* opacity: .7; */
    }
    
    .flex-wrp{
      display:flex;
    }
    
    .flex-item{
      width: 200rpx;
      height: 300rpx;
      font-size: 26rpx;
    }
    
    .demo-text-1 {
      background: rgba(26, 173, 25, 0.7);
    }
    
    .demo-text-2 {
      background: rgba(39, 130, 215, 0.7);
    }
    
    .demo-text-3 {
      background: rgba(255, 255, 255, 0.7);
    }
    
    .container {
        position: relative;
        width: 100%;
        height: 100%;
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
</style>
