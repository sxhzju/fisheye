import { useCallback, useEffect, useRef, useState } from 'react';
import FisheyeView, { DEFAULT_PARAMS } from './lib/FisheyeView.jsx';

function Slider({ label, value, min, max, step, onChange, fmt = (v) => v.toFixed(2) }) {
  return (
    <label className="slider">
      <span className="slider-label">{label}</span>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      <span className="slider-value">{fmt(value)}</span>
    </label>
  );
}

// 测试图中「浙大通」的“浙大”两个字所在区域（源图 0..1 坐标）。
// 底图是深灰气泡 + 白色文字，用 screen 混合：暗部被提成黄色块，白字保持可读。
const ZHEDA_RECT = {
  x: 0.272, y: 0.573, w: 0.082, h: 0.052,
  color: '#ffd900', opacity: 0.9, blend: 'screen',
};

export default function App() {
  const [source, setSource] = useState(null);
  const [sourceKind, setSourceKind] = useState('');
  const [params, setParams] = useState(() => structuredClone(DEFAULT_PARAMS));
  const [markZheda, setMarkZheda] = useState(true);
  const objectUrlRef = useRef(null);
  const videoRef = useRef(null);

  const set = useCallback((patch) => {
    setParams((p) => ({
      ...p, ...patch,
      focus: { ...p.focus, ...(patch.focus || {}) },
      moire: { ...p.moire, ...(patch.moire || {}) },
      vignette: { ...p.vignette, ...(patch.vignette || {}) },
    }));
  }, []);

  const cleanupOld = () => {
    if (videoRef.current) { videoRef.current.pause(); videoRef.current = null; }
    if (objectUrlRef.current) { URL.revokeObjectURL(objectUrlRef.current); objectUrlRef.current = null; }
  };

  const loadImageUrl = useCallback((url) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { setSource(img); setSourceKind('图片'); };
    img.src = url;
  }, []);

  const loadFile = useCallback((file) => {
    cleanupOld();
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    if (file.type.startsWith('video/')) {
      const video = document.createElement('video');
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.src = url;
      video.addEventListener('loadeddata', () => {
        video.play();
        videoRef.current = video;
        setSource(video);
        setSourceKind('视频');
      }, { once: true });
    } else {
      loadImageUrl(url);
    }
  }, [loadImageUrl]);

  // 默认加载测试图片
  useEffect(() => { loadImageUrl('/test.jpg'); }, [loadImageUrl]);
  useEffect(() => cleanupOld, []);

  const onDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) loadFile(file);
  };

  const exportPng = () => {
    const canvas = document.querySelector('.stage canvas');
    if (!canvas) return;
    const a = document.createElement('a');
    a.download = 'fisheye.png';
    a.href = canvas.toDataURL('image/png');
    a.click();
  };

  const p = params;
  return (
    <div className="app" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
      <aside className="panel">
        <h1>鱼眼畸变</h1>
        <p className="hint">在画面上点击 / 拖动可设置聚焦位置；支持拖入图片或视频文件。</p>

        <label className="file-btn">
          选择图片 / 视频…
          <input
            type="file" accept="image/*,video/*" hidden
            onChange={(e) => e.target.files?.[0] && loadFile(e.target.files[0])}
          />
        </label>
        <div className="row-btns">
          <button onClick={() => loadImageUrl('/test.jpg')}>重载测试图</button>
          <button onClick={exportPng}>导出 PNG</button>
          <button onClick={() => setParams(structuredClone(DEFAULT_PARAMS))}>重置参数</button>
        </div>
        {sourceKind && <p className="hint">当前源：{sourceKind}</p>}

        <h2>畸变</h2>
        <Slider label="强度" value={p.strength} min={0} max={5} step={0.01}
          onChange={(v) => set({ strength: v })} />
        <Slider label="缩放" value={p.zoom} min={0.5} max={3} step={0.01}
          onChange={(v) => set({ zoom: v })} />
        <Slider label="聚焦 X" value={p.focus.x} min={0} max={1} step={0.005}
          onChange={(v) => set({ focus: { x: v } })} />
        <Slider label="聚焦 Y" value={p.focus.y} min={0} max={1} step={0.005}
          onChange={(v) => set({ focus: { y: v } })} />

        <h2>摩尔纹</h2>
        <Slider label="强度" value={p.moire.intensity} min={0} max={1} step={0.01}
          onChange={(v) => set({ moire: { intensity: v } })} />
        <Slider label="频率" value={p.moire.scale} min={100} max={3000} step={10}
          fmt={(v) => v.toFixed(0)}
          onChange={(v) => set({ moire: { scale: v } })} />
        <Slider label="角度" value={p.moire.angle} min={-1.57} max={1.57} step={0.01}
          fmt={(v) => (v * 180 / Math.PI).toFixed(0) + '°'}
          onChange={(v) => set({ moire: { angle: v } })} />

        <h2>标注</h2>
        <label className="check">
          <input
            type="checkbox" checked={markZheda}
            onChange={(e) => setMarkZheda(e.target.checked)}
          />
          高亮“浙大”二字（黄色块，screen 混合）
        </label>

        <h2>暗角</h2>
        <Slider label="强度" value={p.vignette.amount} min={0} max={1} step={0.01}
          onChange={(v) => set({ vignette: { amount: v } })} />
        <Slider label="半径" value={p.vignette.radius} min={0.1} max={1.2} step={0.01}
          onChange={(v) => set({ vignette: { radius: v } })} />
        <Slider label="柔和度" value={p.vignette.softness} min={0.01} max={1} step={0.01}
          onChange={(v) => set({ vignette: { softness: v } })} />
      </aside>

      <main className="stage">
        <FisheyeView
          source={source}
          strength={p.strength}
          zoom={p.zoom}
          focus={p.focus}
          moire={p.moire}
          vignette={p.vignette}
          rects={markZheda ? [ZHEDA_RECT] : []}
          onFocusChange={(focus) => set({ focus })}
        />
      </main>
    </div>
  );
}
