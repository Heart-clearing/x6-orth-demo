import { ArrayExt } from "@antv/x6-common";
import { Point, Rectangle, Line, Angle } from "@antv/x6-geometry";
import * as Util from "./util";


enum BearingEnum {
  left = "W",
  right = "E",
  top = "S",
  bottom = "N",
}

const getExtraPoint = (side: string, bbox: Rectangle, padding = 20) => {
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

function getFinalPath(path: Point[], obstacles: Rectangle[]) {
  // const finalPath = avoidObstacles(path, obstacles);
  // return finalPath;
  return []
}



/**
 * Returns a route with orthogonal line segments.
 */
export const customOrth = function (vertices, options, edgeView) {
  let sourceBBox = Util.getSourceBBox(edgeView, options);
  let targetBBox = Util.getTargetBBox(edgeView, options);
  const sourceAnchor = Util.getSourceAnchor(edgeView, options);
  const targetAnchor = Util.getTargetAnchor(edgeView, options);

  const [sourceSide, targetSide] = Array.isArray(options.side)
    ? options.side
    : [options.side || "bottom", options.side || "bottom"];

  // If anchor lies outside of bbox, the bbox expands to include it
  // 如果锚点位于边界框之外，将边界框扩展以包含锚点。
  sourceBBox = sourceBBox.union(Util.getPointBBox(sourceAnchor));
  targetBBox = targetBBox.union(Util.getPointBBox(targetAnchor));

  // Generate initial orthogonal path
  const initialPath = [
    getExtraPoint(sourceSide, sourceBBox),
    ...vertices.map(p => ({ x: p.x, y: p.y })),
    getExtraPoint(targetSide, targetBBox),
  ];
  
  const obstacles: any[] = [sourceBBox, targetBBox];

  // Perform obstacle avoidance
  const finalPath: any[] = [];
  console.log('finalPath', finalPath);
  

  return [sourceAnchor, ...finalPath.map(p => new Point(p.x, p.y)), targetAnchor];
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
