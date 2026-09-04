import { DEFAULT_MOTION_PROPS } from "./config.js";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return parsed;
};

const toInt = (value, fallback, min, max) =>
  Math.round(clamp(toNumber(value, fallback), min, max));

const toPositiveFrames = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(1, Math.round(parsed));
};

const toFrame = (value, fallback = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(0, Math.floor(parsed));
};

const toText = (value, fallback) => {
  if (typeof value !== "string") {
    return fallback;
  }
  const resolved = value.trim();
  return resolved.length > 0 ? resolved : fallback;
};

const toPoint = (value, fallback) => ({
  x: clamp(toNumber(value?.x, fallback.x), 0, 1),
  y: clamp(toNumber(value?.y, fallback.y), 0, 1),
});

// 每帧独立可计算的 ease：三次缓出
const easeOutCubic = (k) => 1 - Math.pow(1 - k, 3);
// 缓入缓出，用于聚焦/缩放的推镜
const easeInOutCubic = (k) =>
  k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;

const phase = (t, start, end) => {
  if (end <= start) {
    return t >= end ? 1 : 0;
  }
  return clamp((t - start) / (end - start), 0, 1);
};

export const resolveMotionSceneContext = (pluginParams = {}) => {
  const d = DEFAULT_MOTION_PROPS;
  const videoWidth = toInt(pluginParams.videoWidth, d.videoWidth, 480, 1920);
  const videoHeight = toInt(pluginParams.videoHeight, d.videoHeight, 480, 1920);
  const durationSeconds = clamp(
    toNumber(pluginParams.durationSeconds, d.durationSeconds),
    1,
    30
  );

  return {
    imageSrc: toText(pluginParams.imageSrc, d.imageSrc),
    durationSeconds,
    strength: clamp(toNumber(pluginParams.strength, d.strength), 0, 5),
    focusFrom: toPoint(pluginParams.focusFrom, d.focusFrom),
    focusTo: toPoint(pluginParams.focusTo, d.focusTo),
    zoomFrom: clamp(toNumber(pluginParams.zoomFrom, d.zoomFrom), 0.5, 4),
    zoomTo: clamp(toNumber(pluginParams.zoomTo, d.zoomTo), 0.5, 4),
    zoomDrift: clamp(toNumber(pluginParams.zoomDrift, d.zoomDrift), 0, 1),
    focusStartSec: clamp(
      toNumber(pluginParams.focusStartSec, d.focusStartSec),
      0,
      durationSeconds
    ),
    focusEndSec: clamp(
      toNumber(pluginParams.focusEndSec, d.focusEndSec),
      0,
      durationSeconds
    ),
    maskStartSec: clamp(
      toNumber(pluginParams.maskStartSec, d.maskStartSec),
      0,
      durationSeconds
    ),
    maskEndSec: clamp(
      toNumber(pluginParams.maskEndSec, d.maskEndSec),
      0,
      durationSeconds
    ),
    rect: { ...d.rect, ...(pluginParams.rect ?? {}) },
    moire: { ...d.moire, ...(pluginParams.moire ?? {}) },
    vignette: { ...d.vignette, ...(pluginParams.vignette ?? {}) },
    layout: {
      videoWidth,
      videoHeight,
    },
  };
};

export const getMotionDurationInFrames = ({ fps, sceneContext, pluginParams } = {}) => {
  const resolvedContext = sceneContext ?? resolveMotionSceneContext(pluginParams ?? {});
  const resolvedFps = toPositiveFrames(fps, 30);
  return toPositiveFrames(resolvedContext.durationSeconds * resolvedFps, resolvedFps);
};

export const buildMotionSceneProps = ({
  frame = 0,
  fps,
  loop = false,
  sceneContext,
  pluginParams,
} = {}) => {
  const resolvedContext = sceneContext ?? resolveMotionSceneContext(pluginParams ?? {});
  const resolvedFps = toPositiveFrames(fps, 30);
  const durationInFrames = getMotionDurationInFrames({
    fps: resolvedFps,
    sceneContext: resolvedContext,
  });

  const rawFrame = toFrame(frame, 0);
  const boundedFrame = loop
    ? rawFrame % durationInFrames
    : Math.min(rawFrame, durationInFrames - 1);
  const t = boundedFrame / resolvedFps; // 当前时间（秒）

  const c = resolvedContext;

  // 聚焦 + 缩放推镜
  const k = easeInOutCubic(phase(t, c.focusStartSec, c.focusEndSec));
  const focus = {
    x: c.focusFrom.x + (c.focusTo.x - c.focusFrom.x) * k,
    y: c.focusFrom.y + (c.focusTo.y - c.focusFrom.y) * k,
  };
  // 推镜到位后继续线性微推（drift），让后半段画面保持呼吸感而不是死住
  const driftK = phase(t, c.focusEndSec, c.durationSeconds);
  const zoom = c.zoomFrom + (c.zoomTo - c.zoomFrom) * k + c.zoomDrift * driftK;

  // 标注滑入 0 → 1
  const mask = easeOutCubic(phase(t, c.maskStartSec, c.maskEndSec));

  return {
    ...c,
    durationInFrames,
    frame: boundedFrame,
    progress: durationInFrames <= 1 ? 0 : boundedFrame / (durationInFrames - 1),
    focus,
    zoom,
    rects: [{ ...c.rect, mask }],
  };
};
