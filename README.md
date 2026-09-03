# 鱼眼畸变效果（Fisheye + 摩尔纹 + 暗角）

参考 `ref.PNG` 的屏摄风格：桶形鱼眼畸变、细扫描线/摩尔纹干涉、四周暗角。

## 运行

```bash
npm install
npm run dev
```

打开后默认加载 `public/test.jpg`。可拖入或选择任意图片/视频文件；在画面上点击/拖动即可移动聚焦（畸变中心）位置；「导出 PNG」保存当前效果帧。

## 模块

### `src/lib/FisheyeView.jsx` — React 组件

```jsx
import FisheyeView from './lib/FisheyeView.jsx';

<FisheyeView
  source={imgOrVideoElement}   // 已加载的 <img> / <video> 元素
  strength={1.6}               // 畸变强度（0 = 无畸变）
  zoom={1.35}                  // 中心缩放
  focus={{ x: 0.5, y: 0.5 }}   // 聚焦位置，0..1，页面坐标（y 向下）
  moire={{ intensity: 0.28, scale: 900, angle: 0 }}
  vignette={{ amount: 0.85, radius: 0.72, softness: 0.45 }}
  onFocusChange={(f) => ...}   // 传入后画面可点击/拖动改变聚焦位置
/>
```

### `src/lib/FisheyeRenderer.js` — 与框架无关的 WebGL 渲染器

```js
const r = new FisheyeRenderer(canvas);
r.setSource(imageOrVideo);   // 视频会自动按 rAF 逐帧渲染
r.setParams({ strength: 2, focus: { x: 0.3, y: 0.4 } });
r.destroy();
```

## 效果实现说明

- **鱼眼畸变**：以 `focus` 为中心的桶形畸变 `p' = p·(1 + strength·r²) / zoom`，按画布宽高比校正，保证畸变呈圆形。
- **摩尔纹**：跟随画面弯曲的细扫描线，与固定屏幕扫描线（频率略有偏差）相乘产生干涉拍纹，两者混合。
- **暗角**：以画面中心的径向 `smoothstep` 压暗，半径与柔和度可调。
