const path = require("path");
const GasPlugin = require("gas-webpack-plugin");
const EnvironmentPlugin = require("webpack").EnvironmentPlugin;

module.exports = {
  mode: "development",
  entry: "./src/index.ts",
  devtool: false,
  output: {
    filename: "bundle.js",
    path: path.join(__dirname, "dist")
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: "ts-loader"
      }
    ]
  },
  resolve: {
    extensions: [".ts"]
  },
  plugins: [
    new EnvironmentPlugin(["DRIVE_FILE_ID", "FIREBASE_KEY"]),
    new GasPlugin()
  ]
};
