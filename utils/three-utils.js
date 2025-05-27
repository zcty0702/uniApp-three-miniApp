import * as THREE from 'three'

// 创建文字纹理
export function createTextTexture(text, options = {}) {
    const {
        fontSize = 32,
            fontFamily = 'Arial',
            textColor = {
                r: 0,
                g: 0,
                b: 0,
                a: 1
            },
            backgroundColor = {
                r: 255,
                g: 255,
                b: 255,
                a: 0.7
            }
    } = options

    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')

    // 计算文字宽度
    context.font = `${fontSize}px ${fontFamily}`
    const textWidth = context.measureText(text).width

    // 设置canvas大小
    canvas.width = textWidth + 20
    canvas.height = fontSize + 20

    // 绘制背景
    context.fillStyle = `rgba(${backgroundColor.r}, ${backgroundColor.g}, ${backgroundColor.b}, ${backgroundColor.a})`
    context.fillRect(0, 0, canvas.width, canvas.height)

    // 绘制文字
    context.font = `${fontSize}px ${fontFamily}`
    context.fillStyle = `rgba(${textColor.r}, ${textColor.g}, ${textColor.b}, ${textColor.a})`
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText(text, canvas.width / 2, canvas.height / 2)

    // 创建纹理
    const texture = new THREE.CanvasTexture(canvas)
    texture.needsUpdate = true

    return texture
}

// 创建路径点
export function createPathPoints(start, end, obstacles = []) {
    // 简单直线路径，实际项目应实现A*等算法
    return [start, end]
}

// 计算两点间距离
export function distanceBetween(p1, p2) {
    return Math.sqrt(
        Math.pow(p2.x - p1.x, 2) +
        Math.pow(p2.y - p1.y, 2) +
        Math.pow(p2.z - p1.z, 2))
}

export function fixMatrixProxyIssue() {
  // 更安全的Matrix4.copy修复
  const originalCopy = THREE.Matrix4.prototype.copy;
  THREE.Matrix4.prototype.copy = function(m) {
    if (m.elements && this.elements) {
      // 改为逐个元素复制，而不是使用set()
      const te = this.elements;
      const me = m.elements;
      
      te[0] = me[0]; te[4] = me[4]; te[8] = me[8]; te[12] = me[12];
      te[1] = me[1]; te[5] = me[5]; te[9] = me[9]; te[13] = me[13];
      te[2] = me[2]; te[6] = me[6]; te[10] = me[10]; te[14] = me[14];
      te[3] = me[3]; te[7] = me[7]; te[11] = me[11]; te[15] = me[15];
      
      return this;
    }
    return originalCopy.call(this, m);
  };
}

