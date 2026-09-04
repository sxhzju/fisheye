import { motionPlugin } from "./plugin.js";
import { ACTIVE_COMPOSITION_ID } from "./composition-id.js";

export const ACTIVE_COMPOSITION = Object.freeze({
  id: ACTIVE_COMPOSITION_ID,
  fps: 30,
  plugin: motionPlugin,
});

export { ACTIVE_COMPOSITION_ID };
