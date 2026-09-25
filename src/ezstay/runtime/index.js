import { createHttpRuntime } from "./httpRuntime.js";
import { createLocalPreviewRuntime } from "./localPreviewRuntime.js";

export function createRuntime({ mode = "local-preview", ...options } = {}) {
  if (mode === "backend-sandbox") return createHttpRuntime(options);
  return createLocalPreviewRuntime(options);
}

export { createHttpRuntime, createLocalPreviewRuntime };
