<template>
  <div ref="container" class="graph-wp"></div>
</template>
<script setup lang="ts">
import { Graph } from "@antv/x6";
import { onMounted, ref } from "vue";
import { registerCustomRouter } from "./router";

const container = ref<HTMLElement>();

let graph: Graph;

const initGraph = () => {
  graph = new Graph({
    container: container.value,
    grid: true,
    background: {
      color: "#F2F7FA",
    },
  });
};

const vertices = [
  { x: 460, y: 600 },
  { x: 700, y: 500 },
  { x: 200, y: 400 },
];

const createTestData = () => {
  const source = graph.addNode({
    x: 460,
    y: 550,
    width: 100,
    height: 50,
    attrs: {
      body: {
        fill: "#f5f5f5",
        stroke: "#d9d9d9",
      },
    },
  });

  const target = graph.addNode({
    x: 330,
    y: 500,
    width: 100,
    height: 50,
    attrs: {
      body: {
        fill: "#2358ff",
        stroke: "#d9d9d9",
      },
    },
  });

  graph.addEdge({
    source,
    target,
    router: {
      // name: "orthoExtended",
      // args: {
      //   side: ["left", "right"],
      //   canvas: [container.value?.clientWidth, container.value?.clientHeight],
      //   graph,
      // },

      // name: 'orthCopy',
      // args: { side: ["left", "right"] },

      name: "orthExtended",
      args: {
        side: ["left", "bottom"],
      },

      // name: "oneSideExtended",
      // args: { side: ["left", "right"] },
    },
    // vertices,
    attrs: {
      line: {
        stroke: "#722ed1",
      },
    },
    tools: [
      {
        name: "vertices",
        args: {
          attrs: { fill: "#666" },
        },
      },
      // {
      //   name: "segments",
      //   args: {
      //     snapRadius: 20,
      //     attrs: {
      //       fill: "#444",
      //     },
      //   },
      // },
    ],
  });

  drawGraphPoints(graph, vertices);
};

function drawGraphPoints(graph: any, points: any[]) {
  // 删除原路径点
  const circles =
    graph?.getNodes()?.filter((node) => node.shape === "circle") || [];
  circles.forEach((item) => {
    graph.removeNode(item.id);
  });

  // 添加新路径点
  points.forEach((p) => {
    graph.addNode({
      shape: "circle", // 形状为圆形
      x: p.x, // X 坐标
      y: p.y, // Y 坐标
      attrs: {
        body: {
          r: 3, // 半径，控制点的大小
          fill: "#fff", // 填充颜色
          stroke: "#ff0000",
        },
      },
    });
  });
}

onMounted(() => {
  registerCustomRouter();
  initGraph();
  createTestData();
});
</script>
<style lang="less" scoped>
.graph-wp {
  width: 100%;
  height: 100%;
}
</style>
