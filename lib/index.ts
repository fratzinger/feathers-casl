export * from "./hooks";
export * from "./channels";
export * from "./utils";

import initialize from "./initialize";

export default initialize;

export * from "./types";

if (typeof module !== "undefined") {
  module.exports = Object.assign(initialize, module.exports);
}
