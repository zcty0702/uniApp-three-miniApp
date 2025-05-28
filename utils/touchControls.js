class TouchControls {
    constructor(controls, camera, THREE) {
        this.controls = controls;
        this.camera = camera;
        this.THREE = THREE;
        this.lastTouchX = 0;
        this.lastTouchY = 0;
        this.isDragging = false;
        this.lastTouchDistance = 0;
    }

    // 处理触摸开始事件
    handleTouchStart(event) {
        if (!event.touches || event.touches.length === 0) return;
        
        if (event.touches.length === 1) {
            const touch = event.touches[0];
            this.lastTouchX = touch.pageX;
            this.lastTouchY = touch.pageY;
            this.isDragging = true;
        } else if (event.touches.length === 2) {
            const dx = event.touches[0].pageX - event.touches[1].pageX;
            const dy = event.touches[0].pageY - event.touches[1].pageY;
            this.lastTouchDistance = Math.sqrt(dx * dx + dy * dy);
            this.isDragging = false;
        }
    }

    // 处理触摸移动事件
    handleTouchMove(event) {
        if (!this.controls || !event.touches || event.touches.length === 0) return;

        if (event.touches.length === 1 && this.isDragging) {
            const touch = event.touches[0];
            const deltaX = touch.pageX - this.lastTouchX;
            const deltaY = touch.pageY - this.lastTouchY;

            if (Math.abs(deltaX) > Math.abs(deltaY)) {
                // 水平移动：左右旋转
                const rotationSpeed = 0.005;
                this.rotateLeft(-deltaX * rotationSpeed);
            } else {
                // 垂直移动：上下旋转
                const rotationSpeed = 0.005;
                this.rotateUp(-deltaY * rotationSpeed);
            }

            this.lastTouchX = touch.pageX;
            this.lastTouchY = touch.pageY;
        } else if (event.touches.length === 2) {
            const dx = event.touches[0].pageX - event.touches[1].pageX;
            const dy = event.touches[0].pageY - event.touches[1].pageY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (this.lastTouchDistance > 0) {
                const zoomSpeed = 0.005;
                const delta = distance - this.lastTouchDistance;
                if (this.camera && this.controls) {
                    this.camera.position.multiplyScalar(1 - delta * zoomSpeed);
                }
            }
            this.lastTouchDistance = distance;
        }
    }

    // 处理触摸结束事件
    handleTouchEnd() {
        this.isDragging = false;
        this.lastTouchDistance = 0;
    }

    // 放大
    zoomIn() {
        if (!this.camera || !this.controls) return;
        const zoomSpeed = 0.1;
        this.camera.position.multiplyScalar(1 - zoomSpeed);
    }

    // 缩小
    zoomOut() {
        if (!this.camera || !this.controls) return;
        const zoomSpeed = 0.1;
        this.camera.position.multiplyScalar(1 + zoomSpeed);
    }

    // 重置相机位置
    resetCamera(model) {
        if (model) {
            this.fitCameraToObject(model);
        } else {
            this.camera.position.set(0, 0, 5);
            this.camera.lookAt(0, 0, 0);
            if (this.controls) {
                this.controls.target.set(0, 0, 0);
                this.controls.update();
            }
        }
    }

    // 调整相机位置以适应模型
    fitCameraToObject(object, offset = 1.5) {
        if (!this.camera || !this.controls || !object) {
            return;
        }

        const box = new this.THREE.Box3().setFromObject(object);
        const size = box.getSize(new this.THREE.Vector3()).length();
        const center = box.getCenter(new this.THREE.Vector3());

        this.camera.position.copy(center);
        this.camera.position.z += size * offset;
        this.camera.lookAt(center);

        this.controls.target.copy(center);
        this.controls.update();
    }

    // 自定义左右旋转方法
    rotateLeft(angle) {
        if (!this.camera || !this.controls) return;
        
        // 计算旋转矩阵
        const rotationMatrix = new this.THREE.Matrix4();
        rotationMatrix.makeRotationY(angle);
        
        // 应用旋转
        this.camera.position.applyMatrix4(rotationMatrix);
        this.camera.lookAt(this.controls.target);
    }

    // 自定义上下旋转方法
    rotateUp(angle) {
        if (!this.camera || !this.controls) return;
        
        // 计算旋转矩阵
        const rotationMatrix = new this.THREE.Matrix4();
        rotationMatrix.makeRotationX(angle);
        
        // 应用旋转
        this.camera.position.applyMatrix4(rotationMatrix);
        this.camera.lookAt(this.controls.target);
    }
}

export default TouchControls; 