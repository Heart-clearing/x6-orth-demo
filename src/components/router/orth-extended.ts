import { ArrayExt } from "@antv/x6-common";
import { Point, Rectangle, Line, Angle } from "@antv/x6-geometry";
import * as Util from "./util";

enum BearingEnum {
  left = "W",
  right = "E",
  top = "S",
  bottom = "N",
}

const getExtraPoint = (side: string, bbox: Rectangle, padding = 10) => {
  let p: { x: number; y: number } | null = null;
  switch (side) {
    case "left":
      p = {
        x: bbox.x - padding,
        y: bbox.y + bbox.height / 2,
      };
      break;
    case "right":
      p = {
        x: bbox.x + bbox.width + padding,
        y: bbox.y + bbox.height / 2,
      };
      break;
    case "top":
      p = {
        x: bbox.x + bbox.width / 2,
        y: bbox.y - padding,
      };
      break;
    case "bottom":
      p = {
        x: bbox.x + bbox.width / 2,
        y: bbox.y + bbox.height + padding,
      };
      break;
    default:
      p = {
        x: bbox.x + bbox.width / 2,
        y: bbox.y + bbox.height / 2,
      };
  }
  return Point.create(p);
};

const lineIntersectsRects = (p1: Point, p2: Point, rects: any[]): boolean => {
  for (const rect of rects) {
    // 快速排除测试
    if (Math.max(p1.x, p2.x) < rect.x) continue; // 线段在矩形左侧
    if (Math.min(p1.x, p2.x) > rect.x + rect.width) continue; // 线段在矩形右侧
    if (Math.max(p1.y, p2.y) < rect.y) continue; // 线段在矩形上方
    if (Math.min(p1.y, p2.y) > rect.y + rect.height) continue; // 线段在矩形下方

    // 如果所有排除条件都不满足，说明线段可能与矩形相交
    return true;
  }

  // 所有矩形都未相交
  return false;
};

const getGap = (rect1: any, rect2: any, direction: "h" | "v") => {
  // 处理水平方向 'h'
  if (direction === "h") {
    // 如果 rect1 在 rect2 的左边且不重叠
    if (rect1.x + rect1.width < rect2.x) {
      return rect2.x - (rect1.x + rect1.width);
    }
    // 如果 rect2 在 rect1 的左边且不重叠
    else if (rect2.x + rect2.width < rect1.x) {
      return rect1.x - (rect2.x + rect2.width);
    }
    // 矩形在水平方向上重叠或相接
    else {
      return null;
    }
  }
  // 处理垂直方向 'v'
  else if (direction === "v") {
    // 如果 rect1 在 rect2 的上方且不重叠
    if (rect1.y + rect1.height < rect2.y) {
      return rect2.y - (rect1.y + rect1.height);
    }
    // 如果 rect2 在 rect1 的上方且不重叠
    else if (rect2.y + rect2.height < rect1.y) {
      return rect1.y - (rect2.y + rect2.height);
    }
    // 矩形在垂直方向上重叠或相接
    else {
      return null;
    }
  }
  // 如果方向参数无效，抛出错误
  else {
    throw new Error('Invalid direction: must be "v" or "h"');
  }
};

const formateResult = (
  result: Point[],
  vertices: Point[],
  padding: number,
  sourceBBox: Rectangle,
  targetBBox: Rectangle,
  sourceRawBox: any,
  targetRawBox: any,
  inLine: boolean
) => {
  const horzontalDisableRange = [
    [sourceBBox.x, sourceBBox.x + sourceBBox.width - padding * 2],
    [targetBBox.x, targetBBox.x + targetBBox.width - padding * 2],
  ];

  const verticalDisableRange = [
    [sourceBBox.y, sourceBBox.y + sourceBBox.height - padding * 2],
    [targetBBox.y, targetBBox.y + targetBBox.height - padding * 2],
  ];
  // 遍历result检测
  for (let i = result.length - 1; i > 0; i--) {
    // debugger
    let from = result[i - 1];
    let to = result[i];

    const bearing = Private.getBearing(from, to);
    if (
      !lineIntersectsRects(from, to, [sourceBBox, targetBBox]) ||
      vertices.some((item) => item.x === from.x && item.y === from.y) ||
      vertices.some((item) => item.x === to.x && item.y === to.y)
    ) {
      break;
    }
    if (bearing === BearingEnum.left || bearing === BearingEnum.right) {
      const p = from.y;
      let shouldMove = false;
      for (let j = 0; j < verticalDisableRange.length; j++) {
        const range = verticalDisableRange[j];
        if (p >= range[0] && p <= range[1]) {
          shouldMove = true;
          break;
        }
      }

      if (shouldMove) {
        const arr = verticalDisableRange.flat().sort((a, b) => a - b);
        const innerArr = arr.slice(1, -1);
        const outerArr = [arr[0], arr[arr.length - 1]];
        const gap = getGap(sourceRawBox, targetRawBox, "v");
        if (gap && gap > padding * 2 + 20) {
          result[i] = new Point(to.x, innerArr[0] + gap / 2 + padding);
          const newPoint = new Point(from.x, result[i].y);
          result.splice(i - 1, 1, newPoint);
        } else {
          result[i] = getMovedPoint(
            to,
            { x: to.x, y: outerArr[0] },
            { x: to.x, y: outerArr[1] },
            padding,
            "v"
          );
          const newPointArr = [new Point(from.x, result[i].y)];
          if (i === 1) {
            newPointArr.unshift(new Point(from.x, from.y));
          }
          result.splice(i - 1, 1, ...newPointArr);
        }
      }
    }
    if (bearing === BearingEnum.top || bearing === BearingEnum.bottom) {
      const p = from.x;
      let shouldMove = false;
      for (let j = 0; j < horzontalDisableRange.length; j++) {
        const range = horzontalDisableRange[j];
        if (p >= range[0] && p <= range[1]) {
          shouldMove = true;
          break;
        }
      }
      if (shouldMove) {
        const arr = horzontalDisableRange.flat().sort((a, b) => a - b);
        const innerArr = arr.slice(1, -1);
        const outerArr = [arr[0], arr[arr.length - 1]];
        const gap = getGap(sourceRawBox, targetRawBox, "h");
        if (gap && gap > padding * 2 + 20) {
          result[i] = new Point(innerArr[0] + gap / 2 + padding, to.y);
          const newPoint = new Point(result[i].x, from.y);
          result.splice(i - 1, 1, newPoint);
        } else {
          result[i] = getMovedPoint(
            to,
            { x: outerArr[0], y: to.y },
            { x: outerArr[1], y: to.y },
            padding,
            "h"
          );
          const newPointArr = [new Point(result[i].x, from.y)];
          if (i === 1) {
            newPointArr.unshift(new Point(from.x, from.y));
          }
          result.splice(i - 1, 1, ...newPointArr);
        }
      }
    }
  }
  console.log("after res", result);

  return result;
};

/**
 * Returns a route with orthogonal line segments.
 */
export const orthExtended = function (vertices, options, edgeView) {
  let sourceBBox = Util.getSourceBBox(edgeView, options);
  let targetBBox = Util.getTargetBBox(edgeView, options);
  const sourceAnchor = Util.getSourceAnchor(edgeView, options);
  const targetAnchor = Util.getTargetAnchor(edgeView, options);

  const [sourceSide, targetSide] = Array.isArray(options.side)
    ? options.side
    : [options.side || "bottom", options.side || "bottom"];
  const padding = options.padding || 20;

  // If anchor lies outside of bbox, the bbox expands to include it
  // 如果锚点位于边界框之外，将边界框扩展以包含锚点。
  sourceBBox = sourceBBox.union(Util.getPointBBox(sourceAnchor));
  targetBBox = targetBBox.union(Util.getPointBBox(targetAnchor));

  const sourceRawBox = {
    x: sourceBBox.x + padding,
    y: sourceBBox.y + padding,
    width: sourceBBox.width - padding * 2,
    height: sourceBBox.height - padding * 2,
  };
  const targetRawBox = {
    x: targetBBox.x + padding,
    y: targetBBox.y + padding,
    width: targetBBox.width - padding * 2,
    height: targetBBox.height - padding * 2,
  };

  const points = vertices.map((p) => Point.create(p));
  // 源
  // points.unshift(sourceAnchor)
  // points.push(targetAnchor)

  // 除了 sourceAnchor 和 targetAnchor，还添加额外的点位来固定方向
  const sourceExtraPoint = getExtraPoint(sourceSide, sourceBBox, 10);
  points.unshift(sourceExtraPoint);
  points.unshift(sourceAnchor);
  const targetExtraPoint = getExtraPoint(targetSide, targetBBox, 10);
  points.push(targetExtraPoint);
  points.push(targetAnchor);

  const inLine = isInALine(points); // 所有点位是否在一条直线上

  let bearing: Private.Bearings | null = null;
  let result: any = [];

  for (let i = 0, len = points.length - 1; i < len; i += 1) {
    let route: any = null;
    // debugger
    const from = points[i];
    let to = points[i + 1];
    const isOrthogonal = Private.getBearing(from, to) != null;

    if (i === 0) {
      if (i + 1 === len) {
        if (sourceBBox.intersectsWithRect(targetBBox.clone().inflate(1))) {
          route = Private.insideNode(from, to, sourceBBox, targetBBox);
        } else if (!isOrthogonal) {
          route = Private.nodeToNode(from, to, sourceBBox, targetBBox);
        }
      } else {
        if (sourceBBox.containsPoint(to)) {
          route = Private.insideNode(
            from,
            to,
            sourceBBox,
            Util.getPointBBox(to).moveAndExpand(Util.getPaddingBox(options))
          );
        } else if (!isOrthogonal) {
          route = Private.nodeToVertex(from, to, sourceBBox);
        }
      }
    } else if (i + 1 === len) {
      // 两节点过近或重叠时的特殊处理
      //   const isOrthogonalLoop =
      //     isOrthogonal && Private.getBearing(to, from) === bearing;

      //   if (targetBBox.containsPoint(from) || isOrthogonalLoop) {
      //     route = Private.insideNode(
      //       from,
      //       to,
      //       Util.getPointBBox(from).moveAndExpand(Util.getPaddingBox(options)),
      //       targetBBox,
      //       bearing
      //     );
      //   } else if (!isOrthogonal) {
      //     route = Private.vertexToNode(from, to, targetBBox, bearing);
      //   }
      // route = Private.vertexToNode(from, to, targetBBox, bearing);
      // debugger

      const targetFix = points[i];
      const targetAnchor = points[i + 1];
      const direction = BearingEnum[targetSide];

      const route = Private.vertexToNode2(
        targetFix,
        targetAnchor,
        targetBBox,
        direction as Private.Bearings
      );
      result.push(...route.points);
    } else if (!isOrthogonal) {
      route = Private.vertexToVertex(from, to, bearing);
    } else if (isOrthogonal) {
      if (sourceBBox.intersectsWithRect(targetBBox.clone().inflate(1))) {
        route = Private.insideNode(from, to, sourceBBox, targetBBox);
      }
    }
    if (route) {
      result.push(...route.points);
      bearing = route.direction as Private.Bearings;
    } else {
      bearing = Private.getBearing(from, to);
    }
    if (i + 1 < len) {
      result.push(to);
    }
  }

  // 所有点在一条直线上时，如果没有横穿节点，直接返回空，否则删除多余点
  if (inLine) {
    result = [result[0], result[result.length - 1]];
    if (
      (sourceSide === "left" &&
        targetSide === "right" &&
        sourceRawBox.x >= targetRawBox.x + targetRawBox.width) ||
      (sourceSide === "right" &&
        targetSide === "left" &&
        targetRawBox.x >= sourceRawBox.x + sourceRawBox.width)
    ) {
      result = [];
      return result;
    }
    if (
      (sourceSide === "top" &&
        targetSide === "bottom" &&
        sourceRawBox.y >= targetRawBox.y + targetRawBox.height) ||
      (sourceSide === "bottom" &&
        targetSide === "top" &&
        targetRawBox.y >= sourceRawBox.y + sourceRawBox.height)
    ) {
      result = [];
      return result;
    }
  }

  // 过滤相同的点位
  result = filterSamePoints(result);

  // return result;
  result = formateResult(
    result,
    vertices,
    padding,
    sourceBBox,
    targetBBox,
    sourceRawBox,
    targetRawBox,
    inLine
  );

  result.push(targetExtraPoint);

  return result;
};

const isInALine = (points: Point[]) => {
  const xArr = points.map((item) => item.x);
  const yArr = points.map((item) => item.y);
  const uniqueX = ArrayExt.uniq(xArr);
  const uniqueY = ArrayExt.uniq(yArr);
  if (uniqueX.length === 1 || uniqueY.length === 1) {
    return true;
  }
  return false;
};

const filterSamePoints = (points: Point[]) => {
  const result: Point[] = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (!result.find((item) => item.x === p.x && item.y === p.y)) {
      result.push(p);
    }
  }
  return result;
};

const getMovedPoint = (
  p: any,
  p1: any,
  p2: any,
  padding: number,
  dir: "h" | "v"
): Point => {
  // 判断 p 离 p1 和 p2 哪个更近
  const isP1Closer =
    dir === "h"
      ? Math.abs(p.x - p1.x) < Math.abs(p.x - p2.x) // 水平方向比较 x
      : Math.abs(p.y - p1.y) < Math.abs(p.y - p2.y); // 垂直方向比较 y

  // 确定最近的点
  const closestPoint = isP1Closer ? p1 : p2;

  // 判断最近点是较小的点还是较大的点
  if (dir === "h") {
    // 水平方向
    if (closestPoint.x < (isP1Closer ? p2.x : p1.x)) {
      // 最近点是较小的点，减去 padding
      return new Point(closestPoint.x, p.y);
    } else {
      // 最近点是较大的点，加上 padding
      return new Point(closestPoint.x + padding * 2, p.y);
    }
  } else {
    // 垂直方向
    if (closestPoint.y < (isP1Closer ? p2.y : p1.y)) {
      // 最近点是较小的点，减去 padding
      return new Point(p.x, closestPoint.y);
    } else {
      // 最近点是较大的点，加上 padding
      return new Point(p.x, closestPoint.y + padding * 2);
    }
  }
};

namespace Private {
  /**
   * Bearing to opposite bearing map
   */
  const opposites = {
    N: "S",
    S: "N",
    E: "W",
    W: "E",
  };

  /**
   * Bearing to radians map
   */
  const radians = {
    N: (-Math.PI / 2) * 3,
    S: -Math.PI / 2,
    E: 0,
    W: Math.PI,
  };

  /**
   * Returns a point `p` where lines p,p1 and p,p2 are perpendicular
   * and p is not contained in the given box
   */
  function freeJoin(p1: Point, p2: Point, bbox: Rectangle) {
    let p = new Point(p1.x, p2.y);
    if (bbox.containsPoint(p)) {
      p = new Point(p2.x, p1.y);
    }

    // kept for reference
    // if (bbox.containsPoint(p)) {
    //   return null
    // }

    return p;
  }

  /**
   * Returns either width or height of a bbox based on the given bearing.
   */
  export function getBBoxSize(bbox: Rectangle, bearing: Bearings) {
    return bbox[bearing === "W" || bearing === "E" ? "width" : "height"];
  }

  export type Bearings = ReturnType<typeof getBearing>;

  export function getBearing(from: Point.PointLike, to: Point.PointLike) {
    // 判断是否是同一个点
    if (from.x === to.x && from.y === to.y) {
      return null;
    }

    if (from.x === to.x) {
      return from.y > to.y ? "N" : "S";
    }

    if (from.y === to.y) {
      return from.x > to.x ? "W" : "E";
    }

    return null;
  }

  const padding = 20;

  export function vertexToVertex(from: Point, to: Point, bearing: Bearings) {
    const p1 = new Point(from.x, to.y);
    const p2 = new Point(to.x, from.y);

    const d1 = getBearing(from, p1);
    const d2 = getBearing(from, p2);
    const opposite = bearing ? opposites[bearing] : null;
    const points: Point[] = [];

    let p =
      d1 === bearing || (d1 !== opposite && (d2 === opposite || d2 !== bearing))
        ? p1
        : p2;

    // obstacles.forEach(obstacle => {
    //   const d1 = getBearing(from, p);
    //   const d2 = getBearing(p, to)
    //   if(lineIntersectsRect(from, p, obstacle)) {
    //     if(d1 === BearingEnum.left || d1 === BearingEnum.right) {
    //       p = new Point(from.x, obstacle.y + obstacle.height / 2);
    //     } else {
    //       if(from.y < p.y) {
    //         if((from.y + padding) < obstacle.y){
    //           p.y = obstacle.y - padding
    //           points.push(p, new Point(to.x, p.y))
    //         } else {
    //           p.y = obstacle.y + obstacle.height + padding
    //           points.push(p, new Point(to.x, p.y))
    //         }
    //       } else  {
    //         if((from.y - padding > p.y)){
    //           p.y = from.y + padding
    //           points.push(p, new Point(to.x, p.y))
    //         } else {
    //           p.y = from.y - padding
    //           points.push(p, new Point(to.x, p.y))
    //         }
    //       }
    //     }
    //     if()
    //   }

    // })

    return { points: [p], direction: getBearing(p, to) };
  }

  export function nodeToVertex(from: Point, to: Point, fromBBox: Rectangle) {
    const p = freeJoin(from, to, fromBBox);

    return { points: [p], direction: getBearing(p, to) };
  }

  export function vertexToNode(
    from: Point,
    to: Point,
    toBBox: Rectangle,
    bearing: Bearings
  ) {
    const points = [new Point(from.x, to.y), new Point(to.x, from.y)];
    const freePoints = points.filter((p) => !toBBox.containsPoint(p));
    const freeBearingPoints = freePoints.filter(
      (p) => getBearing(p, from) !== bearing
    );

    let p;

    if (freeBearingPoints.length > 0) {
      // Try to pick a point which bears the same direction as the previous segment.

      p = freeBearingPoints
        .filter((p) => getBearing(from, p) === bearing)
        .pop();
      p = p || freeBearingPoints[0];

      return {
        points: [p],
        direction: getBearing(p, to),
      };
    }

    {
      // Here we found only points which are either contained in the element or they would create
      // a link segment going in opposite direction from the previous one.
      // We take the point inside element and move it outside the element in the direction the
      // route is going. Now we can join this point with the current end (using freeJoin).

      p = ArrayExt.difference(points, freePoints)[0];

      const p2 = Point.create(to).move(p, -getBBoxSize(toBBox, bearing) / 2);
      const p1 = freeJoin(p2, from, toBBox);

      return {
        points: [p1, p2],
        direction: getBearing(p2, to),
      };
    }
  }

  export function nodeToNode(
    from: Point,
    to: Point,
    fromBBox: Rectangle,
    toBBox: Rectangle
  ) {
    let route = nodeToVertex(to, from, toBBox);
    const p1 = route.points[0];

    if (fromBBox.containsPoint(p1)) {
      route = nodeToVertex(from, to, fromBBox);
      const p2 = route.points[0];

      if (toBBox.containsPoint(p2)) {
        const fromBorder = Point.create(from).move(
          p2,
          -getBBoxSize(fromBBox, getBearing(from, p2)) / 2
        );
        const toBorder = Point.create(to).move(
          p1,
          -getBBoxSize(toBBox, getBearing(to, p1)) / 2
        );

        const mid = new Line(fromBorder, toBorder).getCenter();
        const startRoute = nodeToVertex(from, mid, fromBBox);
        const endRoute = vertexToVertex(
          mid,
          to,
          startRoute.direction as Bearings
        );

        route.points = [startRoute.points[0], endRoute.points[0]];
        route.direction = endRoute.direction;
      }
    }

    return route;
  }

  export function vertexToNode2(
    from: Point,
    to: Point,
    toBBox: Rectangle,
    bearing: Bearings
  ) {
    // 1. 生成原始候选路径点
    const points = [new Point(from.x, to.y), new Point(to.x, from.y)];

    // 2. 筛选不在目标节点内部且方向一致的点
    const freePoints = points.filter((p) => !toBBox.containsPoint(p));
    const freeBearingPoints = freePoints.filter(
      (p) => getBearing(p, from) !== bearing
    );

    let p;

    // 3. 优先选择符合 targetSide 方向的点
    const directionParams = getDirectionParamsFromBearing(bearing);
    const alignedPoints = freePoints.filter((p) =>
      isPointAlignedWithBearing(p, toBBox, directionParams)
    );

    if (alignedPoints.length > 0) {
      // 存在符合 targetSide 方向的点，直接使用
      p = alignedPoints[0];
    } else if (freeBearingPoints.length > 0) {
      // 原有逻辑（动态选择方向一致的点）
      p =
        freeBearingPoints
          .filter((p) => getBearing(from, p) === bearing)
          .pop() || freeBearingPoints[0];
    } else {
      // 原有逻辑（处理内部点）
      p = ArrayExt.difference(points, freePoints)[0];
      const p2 = Point.create(to).move(p, -getBBoxSize(toBBox, bearing) / 2);
      const p1 = freeJoin(p2, from, toBBox);
      return { points: [p1, p2], direction: getBearing(p2, to) };
    }

    // 4. 强制方向为 targetSide
    return {
      points: [p],
      direction: bearing, // 固定方向，而非动态计算
    };
  }

  export function vertexToNode3(
    from: Point,
    to: Point,
    toBBox: Rectangle,
    bearing: Bearings
  ) {
    // 1. 获取方向参数（坐标轴、偏移因子）
    const directionParams = getDirectionParamsFromBearing(bearing);

    // 2. 根据方向生成候选路径点
    let candidates: Point[];
    if (directionParams.coord === "y") {
      // 垂直方向（Top/Bottom）：固定 X 坐标为节点中点或 from.x（视穿透情况）
      const targetX = toBBox.x + toBBox.width / 2; // 优先节点中点
      candidates = [
        new Point(targetX, from.y), // 垂直延伸候选点（中点对齐）
        new Point(from.x, to.y), // 水平延伸候选点（保持原有逻辑）
      ];
    } else {
      // 水平方向（Left/Right）：保持原有逻辑
      candidates = [new Point(from.x, to.y), new Point(to.x, from.y)];
    }

    // 3. 筛选候选点：排除目标节点内部的点
    const freePoints = candidates.filter((p) => !toBBox.containsPoint(p));

    // 4. 优先选择符合 targetSide 方向对齐的点
    const alignedPoints = freePoints.filter((p) =>
      isPointAlignedWithBearing(p, toBBox, directionParams)
    );

    let p: Point;

    // 5. 决策逻辑
    if (alignedPoints.length > 0) {
      p = alignedPoints[0];
    } else if (freePoints.length > 0) {
      // 动态选择方向一致的点
      p =
        freePoints.find((p) => getBearing(from, p) === bearing) ||
        freePoints[0];
    } else {
      // 处理内部点（原有逻辑）
      p = candidates.find((p) => toBBox.containsPoint(p))!;
      const p2 = p.clone().move(to, -getBBoxSize(toBBox, bearing) / 2);
      const p1 = freeJoin(p2, from, toBBox);
      return { points: [p1, p2], direction: getBearing(p2, to) };
    }

    // 6. 强制对齐到目标边缘线（修复偏移问题）
    if (directionParams.coord === "y") {
      // 垂直方向：修正 Y 坐标为边缘线
      p[directionParams.coord] =
        directionParams.factor > 0
          ? toBBox.y + toBBox.height // Bottom
          : toBBox.y; // Top
    } else {
      // 水平方向：修正 X 坐标为边缘线
      p[directionParams.coord] =
        directionParams.factor > 0
          ? toBBox.x + toBBox.width // Right
          : toBBox.x; // Left
    }

    // 7. 交叉检测：若路径穿透节点则生成绕行点
    if (isSegmentCrossingBBox(from, p, toBBox)) {
      const [detour1, detour2] = generateDetourPoints(
        from,
        p,
        toBBox,
        directionParams
      );
      return {
        points: [detour1, detour2, p],
        direction: bearing,
      };
    }

    return {
      points: [p],
      direction: bearing,
    };
  }

  /** 生成绕行路径点（直角绕行） */
  function generateDetourPoints(
    from: Point,
    p: Point,
    toBBox: Rectangle,
    params: { coord: "x" | "y"; factor: number }
  ): [Point, Point] {
    const padding = 10; // 与 getExtraPoint 的偏移一致
    let detour1: Point, detour2: Point;

    if (params.coord === "y") {
      // 垂直方向绕行（Top/Bottom）
      detour1 = new Point(p.x, from.y);
      detour2 = new Point(p.x, p.y + params.factor * padding);
    } else {
      // 水平方向绕行（Left/Right）
      detour1 = new Point(from.x, p.y);
      detour2 = new Point(p.x + params.factor * padding, p.y);
    }

    return [detour1, detour2];
  }

  /** 判断线段是否穿透节点 */
  function isSegmentCrossingBBox(a: Point, b: Point, bbox: Rectangle): boolean {
    // 实现略：检测线段与矩形边界的交点（非端点）
    return false;
  }

  // 判断点是否在 targetSide 方向延伸线上
  function isPointAlignedWithBearing(
    p: Point,
    toBBox: Rectangle,
    params: { coord: "x" | "y"; factor: number }
  ): boolean {
    // 计算目标边缘线的坐标
    const edgePosition =
      params.factor > 0
        ? toBBox[params.coord] + toBBox[params.coord + "2"] // 底部或右侧
        : toBBox[params.coord]; // 顶部或左侧

    // 检查点是否在目标边缘线上（允许 1px 容差）
    return Math.abs(p[params.coord] - edgePosition) < 1;
  }

  // 辅助函数：将 bearing转换为坐标轴和因子
  function getDirectionParamsFromBearing(bearing: Bearings): {
    coord: "x" | "y";
    factor: number;
  } {
    switch (bearing) {
      case "E":
        return { coord: "x", factor: 1 };
      case "W":
        return { coord: "x", factor: -1 };
      case "S":
        return { coord: "y", factor: 1 };
      case "N":
        return { coord: "y", factor: -1 };
      default:
        throw new Error(`Invalid bearing: ${bearing}`);
    }
  }

  // Finds route for situations where one node is inside the other.
  // Typically the route is directed outside the outer node first and
  // then back towards the inner node.
  export function insideNode(
    from: Point,
    to: Point,
    fromBBox: Rectangle,
    toBBox: Rectangle,
    bearing?: Bearings
  ) {
    const boundary = fromBBox.union(toBBox).inflate(1);

    // start from the point which is closer to the boundary
    const center = boundary.getCenter();
    const reversed = center.distance(to) > center.distance(from);
    const start = reversed ? to : from;
    const end = reversed ? from : to;

    let p1: Point;
    let p2: Point;
    let p3: Point;

    if (bearing) {
      // Points on circle with radius equals 'W + H` are always outside the rectangle
      // with width W and height H if the center of that circle is the center of that rectangle.
      p1 = Point.fromPolar(
        boundary.width + boundary.height,
        radians[bearing],
        start
      );
      p1 = boundary.getNearestPointToPoint(p1).move(p1, -1);
    } else {
      p1 = boundary.getNearestPointToPoint(start).move(start, 1);
    }

    p2 = freeJoin(p1, end, boundary);

    let points: Point[];

    if (p1.round().equals(p2.round())) {
      p2 = Point.fromPolar(
        boundary.width + boundary.height,
        Angle.toRad(p1.theta(start)) + Math.PI / 2,
        end
      );
      p2 = boundary.getNearestPointToPoint(p2).move(end, 1).round();
      p3 = freeJoin(p1, p2, boundary);
      points = reversed ? [p2, p3, p1] : [p1, p3, p2];
    } else {
      points = reversed ? [p2, p1] : [p1, p2];
    }

    const direction = reversed ? getBearing(p1, to) : getBearing(p2, to);

    return {
      points,
      direction,
    };
  }
}
