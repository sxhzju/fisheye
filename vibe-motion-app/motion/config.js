// 源图 test.jpg 为 1219x1243，取近似等比且为偶数的输出尺寸
export const DEFAULT_LAYOUT_PARAMS = Object.freeze({
  videoWidth: 1080,
  videoHeight: 1102,
});

// 「浙大」二字在源图上的区域（0..1，y 向下），与交互测试分支的 ZHEDA_RECT 一致
export const ZHEDA_RECT = Object.freeze({
  x: 0.272,
  y: 0.573,
  w: 0.082,
  h: 0.052,
  color: "#ffd900",
  opacity: 0.9,
  blend: "screen",
});

export const DEFAULT_ANIMATION_PARAMS = Object.freeze({
  imageSrc: "test.jpg", // public/ 下的文件名，经 staticFile 解析
  durationSeconds: 2,
  strength: 1.6,

  // 聚焦：从画面中心移到「浙大」二字中心；zoom 全程固定 2
  focusFrom: Object.freeze({ x: 0.5, y: 0.5 }),
  focusTo: Object.freeze({ x: 0.313, y: 0.599 }),
  zoomFrom: 2,
  zoomTo: 2,
  zoomDrift: 0,
  focusStartSec: 0,
  focusEndSec: 1.0,

  // 标注滑入：mask 0 → 1
  maskStartSec: 1.0,
  maskEndSec: 1.8,
  rect: ZHEDA_RECT,

  moire: Object.freeze({ intensity: 0.28, scale: 900, angle: 0 }),
  vignette: Object.freeze({ amount: 0.85, radius: 0.72, softness: 0.45 }),
});

export const DEFAULT_MOTION_PROPS = Object.freeze({
  ...DEFAULT_LAYOUT_PARAMS,
  ...DEFAULT_ANIMATION_PARAMS,
});
