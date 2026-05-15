const path = require("path");

function resolveAppPaths(app) {
  const appRoot = app.isPackaged ? app.getAppPath() : path.join(__dirname, "..");
  const resourcesRoot = app.isPackaged ? process.resourcesPath : path.join(__dirname, "..");
  const rendererDist = path.join(appRoot, "dist");
  const web2apiBaseDir = app.isPackaged
    ? path.join(resourcesRoot, "app-resources", "integrated", "web2api")
    : path.join(__dirname, "..", "integrated", "web2api");
  const userDataDir = path.join(app.getPath("userData"), "data");
  const iconPath = path.join(web2apiBaseDir, "public", "favicon.ico");

  return {
    iconPath,
    rendererDist,
    web2apiBaseDir,
    userDataDir
  };
}

module.exports = {
  resolveAppPaths
};
