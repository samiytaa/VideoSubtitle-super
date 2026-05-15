const { contextBridge, webUtils } = require("electron");

contextBridge.exposeInMainWorld("videoSubtitleApp", {
  getPathForFile(file) {
    if (!file) return undefined;

    try {
      const filePath = webUtils.getPathForFile(file);
      return typeof filePath === "string" && filePath.trim() ? filePath : undefined;
    } catch {
      return undefined;
    }
  }
});
