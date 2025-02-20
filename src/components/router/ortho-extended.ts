import { OrthogonalConnector } from "../algo-utils/ortho-connector";
import type { Side } from "../algo-utils/ortho-connector";
import { Rectangle } from "@antv/x6-geometry";
import * as Util from "./util";
import { Graph } from "@antv/x6";

const generateOrthoPath = (
  width: number,
  height: number,
  sourceBox: Rectangle,
  targetBox: Rectangle,
  sourceSide: Side,
  targetSide: Side,
  vertices: {x: number, y: number}[],
  graph: Graph
) => {
  return OrthogonalConnector.route({
    pointA: { shape: sourceBox, side: sourceSide, distance: 0.5 },
    pointB: { shape: targetBox, side: targetSide, distance: 0.5 },
    shapeMargin: 5,
    globalBoundsMargin: 20,
    globalBounds: { left: 0, top: 0, width, height },
    vertices,
    graph
  });
};

export const orthoExtended = (vertices, options, edgeView) => {
  let sourceBBox = Util.getSourceBBox(edgeView, options);
  let targetBBox = Util.getTargetBBox(edgeView, options);
  const sourceAnchor = Util.getSourceAnchor(edgeView, options);
  const targetAnchor = Util.getTargetAnchor(edgeView, options);

  const [sourceSide, targetSide] = Array.isArray(options.side)
    ? options.side
    : [options.side || "bottom", options.side || "bottom"];

  sourceBBox = sourceBBox.union(Util.getPointBBox(sourceAnchor));
  targetBBox = targetBBox.union(Util.getPointBBox(targetAnchor));

  return generateOrthoPath(
    options.canvas[0] || 1000,
    options.canvas[1] || 1000,
    sourceBBox,
    targetBBox,
    sourceSide,
    targetSide,
    vertices || [],
    options.graph
  );
};



