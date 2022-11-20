import { defineBuildConfig } from "unbuild";
import pkg from "./package.json";

export default defineBuildConfig({
  entries: ["./lib/index"],
  outDir: "./dist",
  declaration: true,
  externals: [
    ...Object.keys(pkg.dependencies),
    ...Object.keys(pkg.devDependencies),
  ],
  rollup: {
    emitCJS: true,
  },
});
