/**
 * Orthogonal Connector Router
 *   - Given two rectangles and their connection points, returns the path for an orthogonal connector.
 *
 * https://jose.page
 * 2020
 */

type BasicCardinalPoint = "n" | "e" | "s" | "w";
type Direction = "v" | "h";
export type Side = "top" | "right" | "bottom" | "left";
type BendDirection = BasicCardinalPoint | "unknown" | "none";

/**
 * A point in space
 */
interface Point {
  x: number;
  y: number;
}

/**
 * A size tuple
 */
interface Size {
  width: number;
  height: number;
}

/**
 * A line between two points
 */
interface Line {
  a: Point;
  b: Point;
}

/**
 * Represents a Rectangle by location and size
 */
interface Rect extends Size {
  left: number;
  top: number;
}

/**
 * Represents a connection point on a routing request
 */
interface ConnectorPoint {
  shape: Rect;
  side: Side;
  distance: number;
}

/**
 * Byproduct data emitted by the routing algorithm
 */
interface OrthogonalConnectorByproduct {
  hRulers: number[];
  vRulers: number[];
  spots: Point[];
  grid: Rectangle[];
  connections: Line[];
}

/**
 * Routing request data
 */
interface OrthogonalConnectorOpts {
  pointA: ConnectorPoint;
  pointB: ConnectorPoint;
  shapeMargin: number;
  globalBoundsMargin: number;
  globalBounds: Rect;
  vertices?: Point[];
  graph?: any;
}

/**
 * Utility Point creator
 * @param x
 * @param y
 */
function makePt(x: number, y: number): Point {
  return { x, y };
}

/**
 * Computes distance between two points
 * @param a
 * @param b
 */
function distance(a: Point, b: Point): number {
//   if (
//     extraVertices.some((v) => v.x === a.x && v.y === a.y) ||
//     extraVertices.some((v) => v.x === b.x && v.y === b.y)
//   ) {
//     return Number.MIN_SAFE_INTEGER;
//   }
  return Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2));
}

/**
 * Abstracts a Rectangle and adds geometric utilities
 * 抽象一个矩形并添加几何工具
 */
class Rectangle {
  static get empty(): Rectangle {
    return new Rectangle(0, 0, 0, 0);
  }

  static fromRect(r: Rect): Rectangle {
    return new Rectangle(r.left, r.top, r.width, r.height);
  }

  static fromLTRB(
    left: number,
    top: number,
    right: number,
    bottom: number
  ): Rectangle {
    return new Rectangle(left, top, right - left, bottom - top);
  }

  constructor(
    readonly left: number,
    readonly top: number,
    readonly width: number,
    readonly height: number
  ) {}

  contains(p: Point): boolean {
    return (
      p.x >= this.left &&
      p.x <= this.right &&
      p.y >= this.top &&
      p.y <= this.bottom
    );
  }

  inflate(horizontal: number, vertical: number): Rectangle {
    return Rectangle.fromLTRB(
      this.left - horizontal,
      this.top - vertical,
      this.right + horizontal,
      this.bottom + vertical
    );
  }

  intersects(rectangle: Rectangle): boolean {
    let thisX = this.left;
    let thisY = this.top;
    let thisW = this.width;
    let thisH = this.height;
    let rectX = rectangle.left;
    let rectY = rectangle.top;
    let rectW = rectangle.width;
    let rectH = rectangle.height;
    return (
      rectX < thisX + thisW &&
      thisX < rectX + rectW &&
      rectY < thisY + thisH &&
      thisY < rectY + rectH
    );
  }

  union(r: Rectangle): Rectangle {
    const x = [this.left, this.right, r.left, r.right];
    const y = [this.top, this.bottom, r.top, r.bottom];
    return Rectangle.fromLTRB(
      Math.min(...x),
      Math.min(...y),
      Math.max(...x),
      Math.max(...y)
    );
  }

  get center(): Point {
    return {
      x: this.left + this.width / 2,
      y: this.top + this.height / 2,
    };
  }

  get right(): number {
    return this.left + this.width;
  }

  get bottom(): number {
    return this.top + this.height;
  }

  get location(): Point {
    return makePt(this.left, this.top);
  }

  get northEast(): Point {
    return { x: this.right, y: this.top };
  }

  get southEast(): Point {
    return { x: this.right, y: this.bottom };
  }

  get southWest(): Point {
    return { x: this.left, y: this.bottom };
  }

  get northWest(): Point {
    return { x: this.left, y: this.top };
  }

  get east(): Point {
    return makePt(this.right, this.center.y);
  }

  get north(): Point {
    return makePt(this.center.x, this.top);
  }

  get south(): Point {
    return makePt(this.center.x, this.bottom);
  }

  get west(): Point {
    return makePt(this.left, this.center.y);
  }

  get size(): Size {
    return { width: this.width, height: this.height };
  }
}

/**
 * Represents a node in a graph, whose data is a Point
 * 表示图中的一个节点，其数据为点
 */
class PointNode {
  public distance = Number.MAX_SAFE_INTEGER;
  public shortestPath: PointNode[] = [];
  public adjacentNodes: Map<PointNode, number> = new Map();
  constructor(public data: Point) {}
}

/***
 * Represents a Graph of Point nodes
 * 表示一个点节点的图
 */
class PointGraph {
  private index: { [x: string]: { [y: string]: PointNode } } = {};

  add(p: Point) {
    const { x, y } = p;
    const xs = x.toString(),
      ys = y.toString();

    if (!(xs in this.index)) {
      this.index[xs] = {};
    }
    if (!(ys in this.index[xs])) {
      this.index[xs][ys] = new PointNode(p);
    }
  }

  private getLowestDistanceNode(unsettledNodes: Set<PointNode>): PointNode {
    let lowestDistanceNode: PointNode | null = null;
    let lowestDistance = Number.MAX_SAFE_INTEGER;
    for (const node of unsettledNodes) {
      const nodeDistance = node.distance;
      if (nodeDistance < lowestDistance) {
        lowestDistance = nodeDistance;
        lowestDistanceNode = node;
      }
    }
    return lowestDistanceNode!;
  }

  private inferPathDirection(node: PointNode): Direction | null {
    if (node.shortestPath.length == 0) {
      return null;
    }

    return this.directionOfNodes(
      node.shortestPath[node.shortestPath.length - 1],
      node
    );
  }

  calculateShortestPathFromSource(
    graph: PointGraph,
    source: PointNode
  ): PointGraph {
    source.distance = 0;

    const settledNodes: Set<PointNode> = new Set();
    const unsettledNodes: Set<PointNode> = new Set();
    unsettledNodes.add(source);

    while (unsettledNodes.size != 0) {
      const currentNode = this.getLowestDistanceNode(unsettledNodes);
      unsettledNodes.delete(currentNode);

      for (const [adjacentNode, edgeWeight] of currentNode.adjacentNodes) {
        if (!settledNodes.has(adjacentNode)) {
          this.calculateMinimumDistance(adjacentNode, edgeWeight, currentNode);
          unsettledNodes.add(adjacentNode);
        }
      }
      settledNodes.add(currentNode);
    }

    return graph;
  }

  private calculateMinimumDistance(
    evaluationNode: PointNode,
    edgeWeigh: number,
    sourceNode: PointNode
  ) {
    // debugger
    const sourceDistance = sourceNode.distance;
    const comingDirection = this.inferPathDirection(sourceNode);
    const goingDirection = this.directionOfNodes(sourceNode, evaluationNode);
    const changingDirection =
      comingDirection && goingDirection && comingDirection != goingDirection;
    // const extraWeigh = changingDirection ? Math.pow(edgeWeigh + 1, 2) : 0;
    const extraWeigh = 0

    if (sourceDistance + edgeWeigh + extraWeigh < evaluationNode.distance) {
      evaluationNode.distance = sourceDistance + edgeWeigh + extraWeigh;
      const shortestPath: PointNode[] = [...sourceNode.shortestPath];
      shortestPath.push(sourceNode);
      evaluationNode.shortestPath = shortestPath;
    }
  }

  private directionOf(a: Point, b: Point): Direction | null {
    if (a.x === b.x) {
      return "h";
    } else if (a.y === b.y) {
      return "v";
    } else {
      return null;
    }
  }

  private directionOfNodes(a: PointNode, b: PointNode): Direction | null {
    return this.directionOf(a.data, b.data);
  }

  connect(a: Point, b: Point) {
    const nodeA = this.get(a);
    const nodeB = this.get(b);

    if (!nodeA || !nodeB) {
      throw new Error(`A point was not found`);
    }

    nodeA.adjacentNodes.set(nodeB, distance(a, b));
  }

  has(p: Point): boolean {
    const { x, y } = p;
    const xs = x.toString(),
      ys = y.toString();
    return xs in this.index && ys in this.index[xs];
  }

  get(p: Point): PointNode | null {
    const { x, y } = p;
    const xs = x.toString(),
      ys = y.toString();

    if (xs in this.index && ys in this.index[xs]) {
      return this.index[xs][ys];
    }

    return null;
  }
}

/**
 * Gets the actual point of the connector based on the distance parameter
 * 根据距离参数计算连接点的实际点
 * @param p
 */
function computePt(p: ConnectorPoint): Point {
  const b = Rectangle.fromRect(p.shape);
  switch (p.side) {
    case "bottom":
      return makePt(b.left + b.width * p.distance, b.bottom);
    case "top":
      return makePt(b.left + b.width * p.distance, b.top);
    case "left":
      return makePt(b.left, b.top + b.height * p.distance);
    case "right":
      return makePt(b.right, b.top + b.height * p.distance);
  }
}

/**
 * Extrudes the connector point by margin depending on it's side
 * 根据连接点的边距扩展连接点
 * @param cp
 * @param margin
 */
function extrudeCp(cp: ConnectorPoint, margin: number): Point {
  const { x, y } = computePt(cp);
  switch (cp.side) {
    case "top":
      return makePt(x, y - margin);
    case "right":
      return makePt(x + margin, y);
    case "bottom":
      return makePt(x, y + margin);
    case "left":
      return makePt(x - margin, y);
  }
}

/**
 * Returns flag indicating if the side belongs on a vertical axis
 * @param side
 */
function isVerticalSide(side: Side): boolean {
  return side == "top" || side == "bottom";
}

/**
 * Creates a grid of rectangles from the specified set of rulers, contained on the specified bounds
 * 从指定的一组标尺创建一个矩形网格，包含在指定的边界内
 * @param verticals
 * @param horizontals
 * @param bounds
 */
function rulersToGrid(
  verticals: number[],
  horizontals: number[],
  bounds: Rectangle
): Grid {
  const result: Grid = new Grid();

  verticals.sort((a, b) => a - b);
  horizontals.sort((a, b) => a - b);

  let lastX = bounds.left;
  let lastY = bounds.top;
  let column = 0;
  let row = 0;

  for (const y of horizontals) {
    for (const x of verticals) {
      result.set(row, column++, Rectangle.fromLTRB(lastX, lastY, x, y));
      lastX = x;
    }

    // Last cell of the row
    result.set(row, column, Rectangle.fromLTRB(lastX, lastY, bounds.right, y));
    lastX = bounds.left;
    lastY = y;
    column = 0;
    row++;
  }

  lastX = bounds.left;

  // Last fow of cells
  for (const x of verticals) {
    result.set(
      row,
      column++,
      Rectangle.fromLTRB(lastX, lastY, x, bounds.bottom)
    );
    lastX = x;
  }

  // Last cell of last row
  result.set(
    row,
    column,
    Rectangle.fromLTRB(lastX, lastY, bounds.right, bounds.bottom)
  );

  return result;
}

/**
 * Returns an array without repeated points
 * 返回一个没有重复点的数组
 * @param points
 */
function reducePoints(points: Point[]): Point[] {
  const result: Point[] = [];
  const map = new Map<number, number[]>();

  points.forEach((p) => {
    const { x, y } = p;
    let arr: number[] = map.get(y) || map.set(y, []).get(y)!;

    if (arr.indexOf(x) < 0) {
      arr.push(x);
    }
  });

  for (const [y, xs] of map) {
    for (const x of xs) {
      result.push(makePt(x, y));
    }
  }

  return result;
}

/**
 * Returns a set of spots generated from the grid, avoiding colliding spots with specified obstacles
 * 从网格中返回一组点，避免与指定障碍物碰撞
 * @param grid
 * @param obstacles
 */
function gridToSpots(grid: Grid, obstacles: Rectangle[]): Point[] {
  const obstacleCollision = (p: Point) =>
    obstacles.filter((o) => o.contains(p)).length > 0;

  const gridPoints: Point[] = [];

  for (const [row, data] of grid.data) {
    const firstRow = row == 0;
    const lastRow = row == grid.rows - 1;

    for (const [col, r] of data) {
      const firstCol = col == 0;
      const lastCol = col == grid.columns - 1;
      const nw = firstCol && firstRow;
      const ne = firstRow && lastCol;
      const se = lastRow && lastCol;
      const sw = lastRow && firstCol;

      if (nw || ne || se || sw) {
        gridPoints.push(r.northWest, r.northEast, r.southWest, r.southEast);
      } else if (firstRow) {
        gridPoints.push(r.northWest, r.north, r.northEast);
      } else if (lastRow) {
        gridPoints.push(r.southEast, r.south, r.southWest);
      } else if (firstCol) {
        gridPoints.push(r.northWest, r.west, r.southWest);
      } else if (lastCol) {
        gridPoints.push(r.northEast, r.east, r.southEast);
      } else {
        gridPoints.push(
          r.northWest,
          r.north,
          r.northEast,
          r.east,
          r.southEast,
          r.south,
          r.southWest,
          r.west,
          r.center
        );
      }
    }
  }

  // for(const r of grid) {
  //     gridPoints.push(
  //         r.northWest, r.north, r.northEast, r.east,
  //         r.southEast, r.south, r.southWest, r.west, r.center);
  // }

  // Reduce repeated points and filter out those who touch shapes
  return reducePoints(gridPoints).filter((p) => !obstacleCollision(p));
}

/**
 * Creates a graph connecting the specified points orthogonally
 * 创建一个图，连接指定的点，使它们正交
 * @param spots
 */
function createGraph(spots: Point[]): {
  graph: PointGraph;
  connections: Line[];
} {
  const hotXs: number[] = [];
  const hotYs: number[] = [];
  const graph = new PointGraph();
  const connections: Line[] = [];

  spots.forEach((p) => {
    const { x, y } = p;
    if (hotXs.indexOf(x) < 0) hotXs.push(x);
    if (hotYs.indexOf(y) < 0) hotYs.push(y);
    graph.add(p);
  });

  hotXs.sort((a, b) => a - b);
  hotYs.sort((a, b) => a - b);

  const inHotIndex = (p: Point): boolean => graph.has(p);

  for (let i = 0; i < hotYs.length; i++) {
    for (let j = 0; j < hotXs.length; j++) {
      const b = makePt(hotXs[j], hotYs[i]);

      if (!inHotIndex(b)) continue;

      if (j > 0) {
        const a = makePt(hotXs[j - 1], hotYs[i]);

        if (inHotIndex(a)) {
          graph.connect(a, b);
          graph.connect(b, a);
          connections.push({ a, b });
        }
      }

      if (i > 0) {
        const a = makePt(hotXs[j], hotYs[i - 1]);

        if (inHotIndex(a)) {
          graph.connect(a, b);
          graph.connect(b, a);
          connections.push({ a, b });
        }
      }
    }
  }

  return { graph, connections };
}

/**
 * Solves the shotest path for the origin-destination path of the graph
 * 解决图的起点-终点最短路径
 * @param graph
 * @param origin
 * @param destination
 */
function shortestPath(
  graph: PointGraph,
  origin: Point,
  destination: Point
): Point[] {
  const originNode = graph.get(origin);
  const destinationNode = graph.get(destination);

  if (!originNode) {
    throw new Error(`Origin node {${origin.x},${origin.y}} not found`);
  }

  if (!destinationNode) {
    throw new Error(`Origin node {${origin.x},${origin.y}} not found`);
  }

  graph.calculateShortestPathFromSource(graph, originNode);

  return destinationNode.shortestPath.map((n) => n.data);
}

/**
 * Given two segments represented by 3 points,
 * 给定两条线段，每条线段由三个点表示，
 * determines if the second segment bends on an orthogonal direction or not, and which.
 * 确定第二条线段是否在正交方向上弯曲，以及弯曲的方向。
 *
 * @param a
 * @param b
 * @param c
 * @return Bend direction, unknown if not orthogonal or 'none' if straight line
 */
function getBend(a: Point, b: Point, c: Point): BendDirection {
  const equalX = a.x === b.x && b.x === c.x;
  const equalY = a.y === b.y && b.y === c.y;
  const segment1Horizontal = a.y === b.y;
  const segment1Vertical = a.x === b.x;
  const segment2Horizontal = b.y === c.y;
  const segment2Vertical = b.x === c.x;

  if (equalX || equalY) {
    return "none";
  }

  if (
    !(segment1Vertical || segment1Horizontal) ||
    !(segment2Vertical || segment2Horizontal)
  ) {
    return "unknown";
  }

  if (segment1Horizontal && segment2Vertical) {
    return c.y > b.y ? "s" : "n";
  } else if (segment1Vertical && segment2Horizontal) {
    return c.x > b.x ? "e" : "w";
  }

  throw new Error("Nope");
}

/**
 * Simplifies the path by removing unnecessary points, based on orthogonal pathways
 * 基于正交路径，通过移除不必要的点来简化路径
 * @param points
 */
function simplifyPath(points: Point[]): Point[] {
  if (points.length <= 2) {
    return points;
  }

  const r: Point[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const cur = points[i];

    if (i === points.length - 1) {
      r.push(cur);
      break;
    }

    const prev = points[i - 1];
    const next = points[i + 1];
    const bend = getBend(prev, cur, next);

    if (bend !== "none") {
      r.push(cur);
    }
  }
  return r;
}

/**
 * Helps create the grid portion of the algorithm
 * 帮助创建算法的网格部分
 */
class Grid {
  private _rows = 0;
  private _cols = 0;

  readonly data: Map<number, Map<number, Rectangle>> = new Map();

  constructor() {}

  set(row: number, column: number, rectangle: Rectangle) {
    this._rows = Math.max(this.rows, row + 1);
    this._cols = Math.max(this.columns, column + 1);

    const rowMap: Map<number, Rectangle> =
      this.data.get(row) || this.data.set(row, new Map()).get(row)!;

    rowMap.set(column, rectangle);
  }

  get(row: number, column: number): Rectangle | null {
    const rowMap = this.data.get(row);

    if (rowMap) {
      return rowMap.get(column) || null;
    }

    return null;
  }

  rectangles(): Rectangle[] {
    const r: Rectangle[] = [];

    for (const [_, data] of this.data) {
      for (const [_, rect] of data) {
        r.push(rect);
      }
    }

    return r;
  }

  get columns(): number {
    return this._cols;
  }

  get rows(): number {
    return this._rows;
  }
}

function drawGraphPoints(graph: any, points: Point[]) {
  // 删除原路径点
  const circles =
    graph?.getNodes()?.filter((node) => node.shape === "circle") || [];
  circles.forEach((item) => {
    graph.removeNode(item.id);
  });

  // 添加新路径点
  points.forEach((p) => {
    const stroke = extraVertices.some((v) => v.x === p.x && v.y === p.y)
      ? "#ff0000"
      : "#000";
    graph.addNode({
      shape: "circle", // 形状为圆形
      x: p.x, // X 坐标
      y: p.y, // Y 坐标
      attrs: {
        body: {
          r: 3, // 半径，控制点的大小
          fill: "#fff", // 填充颜色
          stroke,
        },
      },
    });
  });
}

/**
 * Main logic wrapped in a class to hold a space for potential future functionallity
 * 包在类中的主要逻辑为潜在的未来功能提供了空间
 */
export class OrthogonalConnector {
  static readonly byproduct: OrthogonalConnectorByproduct = {
    hRulers: [],
    vRulers: [],
    spots: [],
    grid: [],
    connections: [],
  };

  static route(opts: OrthogonalConnectorOpts): Point[] {
    const { pointA, pointB, globalBoundsMargin, vertices } = opts;

    const spots: Point[] = [];
    const verticals: number[] = [];
    const horizontals: number[] = [];
    const sideA = pointA.side,
      sideAVertical = isVerticalSide(sideA);
    const sideB = pointB.side,
      sideBVertical = isVerticalSide(sideB);
    const originA = computePt(pointA);
    const originB = computePt(pointB);
    const shapeA = Rectangle.fromRect(pointA.shape);
    const shapeB = Rectangle.fromRect(pointB.shape);
    const bigBounds = Rectangle.fromRect(opts.globalBounds);
    let shapeMargin = opts.shapeMargin;
    let inflatedA = shapeA.inflate(shapeMargin, shapeMargin);
    let inflatedB = shapeB.inflate(shapeMargin, shapeMargin);

    // 检查边界框碰撞
    if (inflatedA.intersects(inflatedB)) {
      shapeMargin = 0;
      inflatedA = shapeA;
      inflatedB = shapeB;
    }

    const inflatedBounds = inflatedA
      .union(inflatedB)
      .inflate(globalBoundsMargin, globalBoundsMargin);

    // Curated bounds to stick to 要坚持的限定范围
    const bounds = Rectangle.fromLTRB(
      Math.max(inflatedBounds.left, bigBounds.left),
      Math.max(inflatedBounds.top, bigBounds.top),
      Math.min(inflatedBounds.right, bigBounds.right),
      Math.min(inflatedBounds.bottom, bigBounds.bottom)
    );

    // Add edges to rulers 将边缘添加到标尺
    for (const b of [inflatedA, inflatedB]) {
      verticals.push(b.left);
      verticals.push(b.right);
      horizontals.push(b.top);
      horizontals.push(b.bottom);
    }

    // Rulers at origins of shapes 在形状的原点添加标尺
    (sideAVertical ? verticals : horizontals).push(
      sideAVertical ? originA.x : originA.y
    );
    (sideBVertical ? verticals : horizontals).push(
      sideBVertical ? originB.x : originB.y
    );

    // Points of shape antennas 形状的连接点
    for (const connectorPt of [pointA, pointB]) {
      const p = computePt(connectorPt);
      const add = (dx: number, dy: number) =>
        spots.push(makePt(p.x + dx, p.y + dy));

      switch (connectorPt.side) {
        case "top":
          add(0, -shapeMargin);
          break;
        case "right":
          add(shapeMargin, 0);
          break;
        case "bottom":
          add(0, shapeMargin);
          break;
        case "left":
          add(-shapeMargin, 0);
          break;
      }
    }

    // 添加必须经过的自定义节点
    vertices &&
      vertices.forEach((v) => {
        verticals.push(v.x);
        horizontals.push(v.y);
      });
    extraVertices = vertices || [];

    // Sort rulers 排序标尺
    verticals.sort((a, b) => a - b);
    horizontals.sort((a, b) => a - b);

    // Create grid 创建网格
    const grid = rulersToGrid(verticals, horizontals, bounds);
    const gridPoints = gridToSpots(grid, [inflatedA, inflatedB]);

    drawGraphPoints(opts.graph, gridPoints);

    // Add to spots 将点添加到spots
    spots.push(...gridPoints);

    // Create graph 创建图
    const { graph, connections } = createGraph(spots);
    console.log("graph", graph);

    // Origin and destination by extruding antennas 通过扩展连接点计算起点和终点（横坐标都加上了shapeMargin）
    const origin = extrudeCp(pointA, shapeMargin); // 起点坐标
    const destination = extrudeCp(pointB, shapeMargin); // 终点坐标
    console.log("calc origin", origin);
    console.log("calcdestination", destination);

    const start = computePt(pointA); // 矩形原始起点坐标
    const end = computePt(pointB); // 矩形原始终点坐标
    console.log("orginal start", start);
    console.log("orginal end", end);

    // const test = findOrthogonalPath(spots, origin, destination); // 无用

    this.byproduct.spots = spots;
    this.byproduct.vRulers = verticals;
    this.byproduct.hRulers = horizontals;
    this.byproduct.grid = grid.rectangles();
    this.byproduct.connections = connections;

    const path = shortestPath(graph, origin, destination);

    if (path.length > 0) {
      return simplifyPath([
        start,
        ...path,
        // ...shortestPath(graph, origin, destination),
        end,
      ]);
    } else {
      return [];
    }
  }
}

let extraVertices: Point[] = [];
