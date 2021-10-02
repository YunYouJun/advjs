require("esbuild-register");

// eslint-disable-next-line @typescript-eslint/no-var-requires
const config = require("./config/index.ts");
module.exports = config.default;
