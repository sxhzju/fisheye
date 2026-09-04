import React, { useEffect, useRef, useState } from "react";
import { cancelRender, continueRender, delayRender, staticFile } from "remotion";
import { FisheyeRenderer } from "./lib/FisheyeRenderer.js";

/**
 * 鱼眼 motion 场景：底图经 WebGL 鱼眼畸变 + 摩尔纹 + 暗角，
 * 聚焦/缩放推向「浙大」二字，标注色块 mask 从 0 滑入到 1。
 * 所有动画量（focus/zoom/rects）由 timeline 按帧独立计算后传入，
 * 这里只负责把当帧参数同步绘制到 canvas。
 */
export const MotionScene = ({
  imageSrc,
  strength,
  zoom,
  focus,
  moire,
  vignette,
  rects,
  layout,
  onAutoLayoutReady,
}) => {
  const canvasRef = useRef(null);
  const rendererRef = useRef(null);
  const [image, setImage] = useState(null);
  const [imageHandle] = useState(() => delayRender("Loading fisheye source image"));

  useEffect(() => {
    const img = new Image();
    img.onload = () => setImage(img);
    img.onerror = () => cancelRender(new Error(`Failed to load ${imageSrc}`));
    img.src = staticFile(imageSrc);
  }, [imageSrc]);

  useEffect(() => {
    if (!image || !canvasRef.current) return;
    if (!rendererRef.current) {
      rendererRef.current = new FisheyeRenderer(canvasRef.current);
    }
    rendererRef.current.setSource(image);
    continueRender(imageHandle);
    onAutoLayoutReady?.();
  }, [image, imageHandle, onAutoLayoutReady]);

  useEffect(() => () => rendererRef.current?.destroy(), []);

  // 每帧同步当前参数并重绘（setParams 内部对图片源会立即 render）
  useEffect(() => {
    if (!image) return;
    rendererRef.current?.setParams({
      strength,
      zoom,
      focus: { ...focus },
      moire: { ...moire },
      vignette: { ...vignette },
      rects,
    });
  }, [image, strength, zoom, focus, moire, vignette, rects]);

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{ backgroundColor: "#000" }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: layout?.videoWidth ?? "100%",
          height: layout?.videoHeight ?? "100%",
          display: "block",
        }}
      />
    </div>
  );
};
