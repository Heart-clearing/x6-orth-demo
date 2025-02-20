import { Graph } from "@antv/x6";
import { oneSideExtended } from "./one-side-extended";
import { orthExtended } from "./orth-extended";
import { orthoExtended } from "./ortho-extended";
import { customOrth } from "./orth-copy";


export const registerCustomRouter = () => {
  // 注册自定义路由
  Graph.registerRouter("oneSideExtended", oneSideExtended);
  Graph.registerRouter("orthExtended", orthExtended);
  Graph.registerRouter("orthoExtended", orthoExtended);
  Graph.registerRouter("orthCopy", customOrth);
};
