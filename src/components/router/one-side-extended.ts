import { NumberExt } from "@antv/x6-common";

const getDirectionParams = (side: string) => {
  let coord: "x" | "y";
  let dim: "width" | "height";
  let factor: number;

  switch (side) {
    case "top":
      factor = -1;
      coord = "y";
      dim = "height";
      break;
    case "left":
      factor = -1;
      coord = "x";
      dim = "width";
      break;
    case "right":
      factor = 1;
      coord = "x";
      dim = "width";
      break;
    case "bottom":
    default:
      factor = 1;
      coord = "y";
      dim = "height";
      break;
  }
  return { coord, dim, factor };
};

export const oneSideExtended = function (vertices, options, edgeView) {
  const padding = NumberExt.normalizeSides(options.padding || 40);
  const sourceBBox = edgeView.sourceBBox;
  const targetBBox = edgeView.targetBBox;
  const sourcePoint = sourceBBox.getCenter();
  const targetPoint = targetBBox.getCenter();

  const [sourceSide, targetSide] = Array.isArray(options.side)
    ? options.side
    : [options.side || "bottom", options.side || "bottom"];

  // 分别处理起点和终点方向
  const sourceParams = getDirectionParams(sourceSide);
  const targetParams = getDirectionParams(targetSide);

  // 起点偏移（使用sourceSide的配置）
  sourcePoint[sourceParams.coord] +=
    sourceParams.factor *
    (sourceBBox[sourceParams.dim] / 2 + padding[sourceSide]);

  // 终点偏移（使用targetSide的配置）
  targetPoint[targetParams.coord] +=
    targetParams.factor *
    (targetBBox[targetParams.dim] / 2 + padding[targetSide]);

  // 处理同轴
  if (sourceParams.coord === targetParams.coord) {
    // 同轴同向
    if (sourceParams.factor === targetParams.factor) {
      if (
        sourceParams.factor *
          (sourcePoint[sourceParams.coord] - targetPoint[targetParams.coord]) >
        0
      ) {
        targetPoint[targetParams.coord] = sourcePoint[sourceParams.coord];
      } else {
        sourcePoint[sourceParams.coord] = targetPoint[targetParams.coord];
      }
    } else {
      // 同轴反向
      // 获取源节点和目标节点在延伸方向上的实际坐标
      const sourceExtendedCoord = sourcePoint[sourceParams.coord];
      const targetExtendedCoord = targetPoint[targetParams.coord];

      // 判断是否存在方向冲突（路径反向交叉）
      const isConflict =
        (sourceParams.factor === 1 &&
          sourceExtendedCoord > targetExtendedCoord) || // 右向延伸但源坐标 > 目标坐标
        (sourceParams.factor === -1 &&
          sourceExtendedCoord < targetExtendedCoord); // 左向延伸但源坐标 < 目标坐标
      if (isConflict) {
        const midAxis = sourceParams.coord === "x" ? "y" : "x";
        const midValue = (sourcePoint[midAxis] + targetPoint[midAxis]) / 2;
        const midPoint1 = { ...sourcePoint };
        const midPoint2 = { ...targetPoint };
        midPoint1[midAxis] = midValue;
        midPoint2[midAxis] = midValue;
        vertices.push(midPoint1, midPoint2);
      } else {
        if (sourceParams.coord === "x") {
          const midX = (sourcePoint.x + targetPoint.x) / 2;
          const midPoint1 = { x: midX, y: sourcePoint.y };
          const midPoint2 = { x: midX, y: targetPoint.y };
          vertices.push(midPoint1, midPoint2);
        } else {
          const midY = (sourcePoint.y + targetPoint.y) / 2;
          const midPoint1 = { x: sourcePoint.x, y: midY };
          const midPoint2 = { x: targetPoint.x, y: midY };
          vertices.push(midPoint1, midPoint2);
        }
      }
    }
  } else {
    // 处理异轴（水平+垂直）
    const sourceCoord = sourceParams.coord; // 'x' 或 'y'
    const targetCoord = targetParams.coord; // 'x' 或 'y'
    const isConflict =
      (sourcePoint[sourceCoord] - targetPoint[sourceCoord]) *
        sourceParams.factor >
        0 ||
      (targetPoint[targetCoord] - sourcePoint[targetCoord]) *
        targetParams.factor >
        0;

    if (!isConflict) {
      // 无冲突：直接使用直角点 directPoint
      const directPoint = { x: sourcePoint.x, y: targetPoint.y };
      vertices = [directPoint];
    } else {
      // 有冲突：插入两个中间点形成绕行路径（实际只需要一个，下面得出的两个点坐标相同）
      const midPoint1 = { ...sourcePoint };
      const midPoint2 = { ...targetPoint };
      midPoint1[targetCoord] = targetPoint[targetCoord];
      midPoint2[sourceCoord] = sourcePoint[sourceCoord];
      vertices = [midPoint1, midPoint2];
    }
  }
  const points = [sourcePoint.toJSON(), ...vertices, targetPoint.toJSON()];
  return points;
};