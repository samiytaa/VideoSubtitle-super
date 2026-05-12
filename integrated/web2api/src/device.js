let deviceIdPromise;

const DEVICE_ID_TIMEOUT_MS = 5000;
const DEVICE_ID_POLL_MS = 100;

function loadFingerprinter() {
  return new Promise((resolve, reject) => {
    if (window.SMSdk?.getDeviceId) {
      resolve();
      return;
    }

    window._smReadyFuncs = [];
    window.SMSdk = {
      ready(callback) {
        if (callback) {
          window._smReadyFuncs.push(callback);
        }
      }
    };

    const script = document.createElement("script");
    script.src = "https://cdn.deepseek.com/static/chat/fp-1.min.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("初始化失败"));
    document.head.appendChild(script);
  });
}

async function waitForDeviceId() {
  const deadline = Date.now() + DEVICE_ID_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const deviceId =
      window.SMSdk?.getDeviceId?.() ??
      window.localStorage?.getItem("smidV2") ??
      "";

    if (deviceId) {
      return deviceId;
    }

    if (typeof window.SMSdk?.createDeviceId === "function") {
      await Promise.resolve(window.SMSdk.createDeviceId());
    }

    await new Promise((resolve) => window.setTimeout(resolve, DEVICE_ID_POLL_MS));
  }

  throw new Error("准备超时");
}

export async function getDeviceId() {
  if (!deviceIdPromise) {
    deviceIdPromise = loadFingerprinter().then(waitForDeviceId);
  }

  return deviceIdPromise;
}
