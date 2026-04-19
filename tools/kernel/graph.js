import { Project } from "ts-morph";
import fs from "fs";

const project = new Project({
  tsConfigFilePath: "tsconfig.json",
});

const graph = {
  nodes: new Map(),
  edges: [],
};

console.log("[GRAPH] building unified dependency graph...");

for (const file of project.getSourceFiles()) {
  const filePath = file.getFilePath();

  graph.nodes.set(filePath, {
    exports: file.getExportedDeclarations().size,
    imports: file.getImportDeclarations().length,
  });

  for (const imp of file.getImportDeclarations()) {
    const spec = imp.getModuleSpecifierValue();

    graph.edges.push({
      from: filePath,
      to: spec,
    });
  }
}

console.log("[GRAPH] nodes:", graph.nodes.size);
console.log("[GRAPH] edges:", graph.edges.length);
