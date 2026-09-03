import { useEffect, useRef } from 'react';
import { FisheyeRenderer, DEFAULT_PARAMS } from './FisheyeRenderer.js';

export { DEFAULT_PARAMS };

/**
 * <FisheyeView /> — 可复用的鱼眼效果 React 模块。
 *
 * props:
 *  - source: HTMLImageElement | HTMLVideoElement（已加载的媒体元素）
 *  - strength, zoom: number
 *  - focus: {x, y}  聚焦位置，0..1，页面坐标（y 向下）
 *  - moire: {intensity, scale, angle}
 *  - vignette: {amount, radius, softness}
 *  - rects: 标注矩形数组，默认 []（不加标注）。每项
 *      {x, y, w, h, color, opacity, blend, mask}，坐标为源图 0..1（y 向下），
 *      blend: 'normal' | 'multiply' | 'screen' | 'lighten'，
 *      mask: 0..1 从左到右滑入进度（动画用），默认 1 全显示
 *  - onFocusChange?: (focus) => void  在画面上点击/拖动时回调新的聚焦位置
 *  - style / className: 透传给 <canvas>
 */
export default function FisheyeView({
  source,
  strength = DEFAULT_PARAMS.strength,
  zoom = DEFAULT_PARAMS.zoom,
  focus = DEFAULT_PARAMS.focus,
  moire = DEFAULT_PARAMS.moire,
  vignette = DEFAULT_PARAMS.vignette,
  rects = DEFAULT_PARAMS.rects,
  onFocusChange,
  style,
  className,
}) {
  const canvasRef = useRef(null);
  const rendererRef = useRef(null);
  const onFocusRef = useRef(onFocusChange);
  onFocusRef.current = onFocusChange;

  useEffect(() => {
    const r = new FisheyeRenderer(canvasRef.current);
    rendererRef.current = r;
    return () => r.destroy();
  }, []);

  useEffect(() => {
    if (source) rendererRef.current?.setSource(source);
  }, [source]);

  useEffect(() => {
    rendererRef.current?.setParams({
      strength, zoom,
      focus: { ...focus },
      moire: { ...DEFAULT_PARAMS.moire, ...moire },
      vignette: { ...DEFAULT_PARAMS.vignette, ...vignette },
      rects,
    });
  }, [strength, zoom, focus, moire, vignette, rects]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let dragging = false;
    const toFocus = (e) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
        y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
      };
    };
    const down = (e) => {
      if (!onFocusRef.current) return;
      dragging = true;
      canvas.setPointerCapture(e.pointerId);
      onFocusRef.current(toFocus(e));
    };
    const move = (e) => { if (dragging) onFocusRef.current?.(toFocus(e)); };
    const up = (e) => {
      dragging = false;
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    };
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    return () => {
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        display: 'block', maxWidth: '100%', height: 'auto',
        touchAction: 'none',
        cursor: onFocusChange ? 'crosshair' : 'default',
        ...style,
      }}
    />
  );
}
