import * as THREE from 'three'

export default {
  // 简单路径查找，实际项目应使用更复杂的算法
  findPath(start, end, obstacles) {
    // 这里实现一个简单的直线路径
    // 实际项目应该使用A*或其它寻路算法
    // 并考虑障碍物碰撞
    
    const path = [
      new THREE.Vector3(start.x, start.y, start.z),
      new THREE.Vector3(end.x, end.y, end.z)
    ]
    
    return path
  },
  
  // 完整的A*算法实现
  aStarFindPath(start, end, obstacles) {
    // 创建网格导航图
    const gridSize = 0.5; // 网格单元大小
    const gridExtent = 20; // 网格范围
    
    // 创建3D网格
    const grid = this.createGrid(gridSize, gridExtent, obstacles);
    
    // 开放列表和关闭列表
    const openList = [];
    const closedList = [];
    
    // 起点和终点的网格坐标
    const startNode = this.worldToGrid(start, gridSize);
    const endNode = this.worldToGrid(end, gridSize);
    
    // 设置起点属性
    startNode.g = 0;
    startNode.h = this.heuristic(startNode, endNode);
    startNode.f = startNode.g + startNode.h;
    startNode.parent = null;
    
    // 将起点加入开放列表
    openList.push(startNode);
    
    // 主循环
    while (openList.length > 0) {
      // 找到F值最小的节点
      let currentIndex = 0;
      for (let i = 0; i < openList.length; i++) {
        if (openList[i].f < openList[currentIndex].f) {
          currentIndex = i;
        }
      }
      const currentNode = openList[currentIndex];
      
      // 如果到达终点，构建路径并返回
      if (currentNode.x === endNode.x && currentNode.y === endNode.y && currentNode.z === endNode.z) {
        const path = [];
        let current = currentNode;
        while (current) {
          path.push(this.gridToWorld(current, gridSize));
          current = current.parent;
        }
        return path.reverse();
      }
      
      // 将当前节点从开放列表移到关闭列表
      openList.splice(currentIndex, 1);
      closedList.push(currentNode);
      
      // 检查相邻节点
      const neighbors = this.getNeighbors(currentNode, grid);
      for (const neighbor of neighbors) {
        // 如果邻居在关闭列表中，跳过
        if (closedList.some(node => 
          node.x === neighbor.x && node.y === neighbor.y && node.z === neighbor.z)) {
          continue;
        }
        
        // 计算从当前节点到邻居的G值
        const tentativeG = currentNode.g + this.distance(currentNode, neighbor);
        
        // 检查邻居是否在开放列表中
        const inOpenList = openList.some(node => 
          node.x === neighbor.x && node.y === neighbor.y && node.z === neighbor.z);
        
        if (!inOpenList || tentativeG < neighbor.g) {
          // 更新邻居的属性
          neighbor.parent = currentNode;
          neighbor.g = tentativeG;
          neighbor.h = this.heuristic(neighbor, endNode);
          neighbor.f = neighbor.g + neighbor.h;
          
          // 如果邻居不在开放列表中，添加它
          if (!inOpenList) {
            openList.push(neighbor);
          }
        }
      }
    }
    
    // 如果没有找到路径，返回空数组
    return [];
  },
  
  // 创建3D网格
  createGrid(gridSize, gridExtent, obstacles) {
    const grid = {};
    const size = Math.ceil(gridExtent * 2 / gridSize);
    
    // 初始化网格
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        for (let z = 0; z < size; z++) {
          const key = `${x},${y},${z}`;
          grid[key] = {
            x: x,
            y: y,
            z: z,
            walkable: true
          };
        }
      }
    }
    
    // 标记障碍物
    if (obstacles && obstacles.length > 0) {
      for (const obstacle of obstacles) {
        if (obstacle.isMesh) {
          this.markObstacle(grid, obstacle, gridSize);
        }
      }
    }
    
    return grid;
  },
  
  // 标记障碍物
  markObstacle(grid, mesh, gridSize) {
    // 获取网格的包围盒
    const box = new THREE.Box3().setFromObject(mesh);
    
    // 将包围盒转换为网格坐标
    const minGrid = this.worldToGrid(box.min, gridSize);
    const maxGrid = this.worldToGrid(box.max, gridSize);
    
    // 标记包围盒内的所有网格单元为不可行走
    for (let x = minGrid.x; x <= maxGrid.x; x++) {
      for (let y = minGrid.y; y <= maxGrid.y; y++) {
        for (let z = minGrid.z; z <= maxGrid.z; z++) {
          const key = `${x},${y},${z}`;
          if (grid[key]) {
            grid[key].walkable = false;
          }
        }
      }
    }
  },
  
  // 获取相邻节点
  getNeighbors(node, grid) {
    const neighbors = [];
    const directions = [
      { x: 1, y: 0, z: 0 },
      { x: -1, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
      { x: 0, y: -1, z: 0 },
      { x: 0, y: 0, z: 1 },
      { x: 0, y: 0, z: -1 }
    ];
    
    for (const dir of directions) {
      const x = node.x + dir.x;
      const y = node.y + dir.y;
      const z = node.z + dir.z;
      const key = `${x},${y},${z}`;
      
      if (grid[key] && grid[key].walkable) {
        neighbors.push({
          x: x,
          y: y,
          z: z,
          walkable: true,
          g: 0,
          h: 0,
          f: 0,
          parent: null
        });
      }
    }
    
    return neighbors;
  },
  
  // 启发式函数（曼哈顿距离）
  heuristic(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z);
  },
  
  // 两点之间的距离
  distance(a, b) {
    return Math.sqrt(
      Math.pow(a.x - b.x, 2) + 
      Math.pow(a.y - b.y, 2) + 
      Math.pow(a.z - b.z, 2)
    );
  },
  
  // 世界坐标转网格坐标
  worldToGrid(position, gridSize) {
    return {
      x: Math.floor(position.x / gridSize),
      y: Math.floor(position.y / gridSize),
      z: Math.floor(position.z / gridSize),
      walkable: true,
      g: 0,
      h: 0,
      f: 0,
      parent: null
    };
  },
  
  // 网格坐标转世界坐标
  gridToWorld(gridPos, gridSize) {
    return new THREE.Vector3(
      (gridPos.x + 0.5) * gridSize,
      (gridPos.y + 0.5) * gridSize,
      (gridPos.z + 0.5) * gridSize
    );
  },
  
  // 创建导航网格
  createNavMesh(model) {
    // 从3D模型创建导航网格
    // 返回可用于路径查找的数据结构
    return {
      vertices: [],
      faces: []
    }
  }
}
