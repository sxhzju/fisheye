/**
 * FisheyeRenderer — 基于 WebGL 的鱼眼畸变 + 摩尔纹 + 暗角渲染器。
 * 与框架无关，可直接接收 <img> / <video> / <canvas> 作为纹理源。
 */

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const FRAG = `
precision highp float;
varying vec2 vUv;

uniform sampler2D uTex;
uniform float uAspect;         // 画布宽高比 w/h
uniform vec2  uFocus;          // 聚焦位置（畸变中心），gl 坐标系 (y 向上)
uniform float uStrength;       // 桶形畸变强度
uniform float uZoom;           // 中心放大
uniform float uMoireIntensity; // 摩尔纹强度 0..1
uniform float uMoireScale;     // 摩尔纹线条频率
uniform float uMoireAngle;     // 摩尔纹方向（弧度）
uniform float uVignette;       // 暗角强度 0..1
uniform float uVignetteRadius; // 暗角起始半径
uniform float uVignetteSoft;   // 暗角过渡宽度

#define MAX_RECTS 8
uniform int   uRectCount;
uniform vec4  uRects[MAX_RECTS];      // x,y,w,h，源图 UV（gl 坐标，y 向上）
uniform vec4  uRectColors[MAX_RECTS]; // rgb + opacity
uniform float uRectBlends[MAX_RECTS]; // 0 normal / 1 multiply / 2 screen / 3 lighten
uniform float uRectMasks[MAX_RECTS];  // 0..1 从左到右滑入进度

void main() {
  // ---- 鱼眼畸变：以 uFocus 为中心的桶形畸变 ----
  vec2 p = vUv - uFocus;
  p.x *= uAspect;                       // 用真实比例保证畸变是圆形的
  float r2 = dot(p, p);
  vec2 pd = p * (1.0 + uStrength * r2) / uZoom;
  pd.x /= uAspect;
  vec2 suv = uFocus + pd;

  vec3 col;
  bool inside = suv.x >= 0.0 && suv.x <= 1.0 && suv.y >= 0.0 && suv.y <= 1.0;
  if (inside) {
    col = texture2D(uTex, suv).rgb;
  } else {
    // 越界处向边缘颜色柔和过渡到黑
    vec2 cuv = clamp(suv, 0.0, 1.0);
    float over = length(suv - cuv) * 12.0;
    col = texture2D(uTex, cuv).rgb * max(0.0, 1.0 - over);
  }

  // ---- 标注矩形：画在源图坐标上，随鱼眼一起弯曲，再被摩尔纹/暗角覆盖 ----
  for (int i = 0; i < MAX_RECTS; i++) {
    if (i >= uRectCount) break;
    vec4 rc = uRects[i];
    if (inside &&
        suv.x >= rc.x && suv.x <= rc.x + rc.z * uRectMasks[i] &&
        suv.y >= rc.y && suv.y <= rc.y + rc.w) {
      vec3 mark = uRectColors[i].rgb;
      float mode = uRectBlends[i];
      vec3 blended;
      if (mode < 0.5)      blended = mark;                                  // normal
      else if (mode < 1.5) blended = col * mark;                            // multiply
      else if (mode < 2.5) blended = 1.0 - (1.0 - col) * (1.0 - mark);      // screen
      else                 blended = max(col, mark);                        // lighten
      col = mix(col, blended, uRectColors[i].a);
    }
  }

  // ---- 摩尔纹：源空间细扫描线 × 屏幕空间细扫描线 的干涉 ----
  // 源线绕聚焦点抵消 zoom，保证聚焦处两组线频率只差一点（zoom=1 时就是 suv）。
  // 不抵消的话 zoom>1 把源线放粗，拍纹在聚焦处又密又碎，宽条纹跑到外圈、弯曲方向与鱼眼相反。
  vec2 muv = (suv - uFocus) * uZoom + uFocus;
  float s = sin(uMoireAngle), c = cos(uMoireAngle);
  float srcCoord = -s * muv.x * uAspect + c * muv.y;  // 随画面一起弯曲的线
  float scrCoord = -s * vUv.x * uAspect + c * vUv.y;  // 固定的屏幕线
  float l1 = sin(srcCoord * uMoireScale);
  // 屏幕线略疏于源线：拍纹在聚焦处最宽，向外随桶形畸变变密、与画面同向外凸
  float l2 = sin(scrCoord * uMoireScale * 0.955 + 1.3);
  float beat = 0.5 - 0.5 * l1 * l2;                   // 干涉条纹：两组线重合处透光（亮），交错处遮光（暗）
  float fine = 0.5 + 0.5 * l1;                        // 细扫描线本体
  float moire = mix(fine, beat, 0.65);
  col *= 1.0 - uMoireIntensity * moire;

  // ---- 暗角：以画面中心为准的径向压暗 ----
  vec2 q = (vUv - 0.5) * vec2(uAspect, 1.0);
  float d = length(q);
  float fall = smoothstep(uVignetteRadius - uVignetteSoft,
                          uVignetteRadius + uVignetteSoft, d);
  col *= 1.0 - uVignette * fall;

  gl_FragColor = vec4(col, 1.0);
}
`;

export const DEFAULT_PARAMS = {
  strength: 1.6,            // 畸变强度
  zoom: 1.35,               // 缩放
  focus: { x: 0.5, y: 0.5 },// 聚焦位置，页面坐标（y 向下），0..1
  moire: {
    intensity: 0.28,
    scale: 900,             // 线条频率
    angle: 0,               // 弧度，0 = 水平线
  },
  vignette: {
    amount: 0.85,
    radius: 0.72,
    softness: 0.45,
  },
  // 标注矩形，默认不加。每项：
  // { x, y, w, h,          源图坐标 0..1（y 向下，与页面一致）
  //   color: '#ffe200',    CSS 十六进制颜色
  //   opacity: 1,
  //   blend: 'multiply',   'normal' | 'multiply' | 'screen' | 'lighten'
  //   mask: 1 }            0..1 从左到右滑入进度（动画用），默认 1 全显示
  rects: [],
};

export const MAX_RECTS = 8;
const BLEND_MODES = { normal: 0, multiply: 1, screen: 2, lighten: 3 };

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error('Shader compile error: ' + gl.getShaderInfoLog(sh));
  }
  return sh;
}

export class FisheyeRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl', {
      premultipliedAlpha: false,
      preserveDrawingBuffer: true, // 允许导出截图
    });
    if (!gl) throw new Error('WebGL not supported');
    this.gl = gl;

    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error('Program link error: ' + gl.getProgramInfoLog(prog));
    }
    gl.useProgram(prog);
    this.prog = prog;

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]), // 覆盖全屏的大三角形
      gl.STATIC_DRAW
    );
    const loc = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    this.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

    this.u = {};
    for (const name of [
      'uAspect', 'uFocus', 'uStrength', 'uZoom',
      'uMoireIntensity', 'uMoireScale', 'uMoireAngle',
      'uVignette', 'uVignetteRadius', 'uVignetteSoft',
      'uRectCount', 'uRects[0]', 'uRectColors[0]', 'uRectBlends[0]', 'uRectMasks[0]',
    ]) {
      this.u[name.replace('[0]', '')] = gl.getUniformLocation(prog, name);
    }

    this.source = null;
    this.isVideo = false;
    this.params = structuredClone(DEFAULT_PARAMS);
    this._raf = 0;
  }

  /** source: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement */
  setSource(source) {
    this.source = source;
    this.isVideo = typeof HTMLVideoElement !== 'undefined' &&
      source instanceof HTMLVideoElement;
    this._sizeToSource();
    this._upload();
    if (this.isVideo) this.start();
    else { this.stop(); this.render(); }
  }

  setParams(partial) {
    const p = this.params;
    this.params = {
      ...p,
      ...partial,
      focus: { ...p.focus, ...(partial.focus || {}) },
      moire: { ...p.moire, ...(partial.moire || {}) },
      vignette: { ...p.vignette, ...(partial.vignette || {}) },
      rects: partial.rects !== undefined ? partial.rects : p.rects,
    };
    if (!this.isVideo) this.render();
  }

  _sizeToSource() {
    const s = this.source;
    if (!s) return;
    const w = s.videoWidth || s.naturalWidth || s.width || 1;
    const h = s.videoHeight || s.naturalHeight || s.height || 1;
    const cap = 1920;
    const k = Math.min(1, cap / Math.max(w, h));
    this.canvas.width = Math.round(w * k);
    this.canvas.height = Math.round(h * k);
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  _upload() {
    const { gl, source } = this;
    if (!source) return;
    if (this.isVideo && source.readyState < 2) return;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, source);
  }

  render() {
    const { gl, u, params: p } = this;
    if (!this.source) return;
    if (this.isVideo) {
      if (this.canvas.width <= 1 && this.source.videoWidth) this._sizeToSource();
      this._upload();
    }
    gl.uniform1f(u.uAspect, this.canvas.width / Math.max(1, this.canvas.height));
    // 页面坐标 y 向下 → gl 坐标 y 向上
    gl.uniform2f(u.uFocus, p.focus.x, 1 - p.focus.y);
    gl.uniform1f(u.uStrength, p.strength);
    gl.uniform1f(u.uZoom, p.zoom);
    gl.uniform1f(u.uMoireIntensity, p.moire.intensity);
    gl.uniform1f(u.uMoireScale, p.moire.scale);
    gl.uniform1f(u.uMoireAngle, p.moire.angle);
    gl.uniform1f(u.uVignette, p.vignette.amount);
    gl.uniform1f(u.uVignetteRadius, p.vignette.radius);
    gl.uniform1f(u.uVignetteSoft, p.vignette.softness);

    const rects = (p.rects || []).slice(0, MAX_RECTS);
    gl.uniform1i(u.uRectCount, rects.length);
    if (rects.length) {
      const geo = new Float32Array(MAX_RECTS * 4);
      const cols = new Float32Array(MAX_RECTS * 4);
      const blends = new Float32Array(MAX_RECTS);
      const masks = new Float32Array(MAX_RECTS);
      rects.forEach((r, i) => {
        // 页面坐标 y 向下 → gl 坐标 y 向上：矩形顶边 y 变为底边 1-(y+h)
        geo.set([r.x, 1 - r.y - r.h, r.w, r.h], i * 4);
        const [cr, cg, cb] = hexToRgb(r.color || '#ffe200');
        cols.set([cr, cg, cb, r.opacity ?? 1], i * 4);
        blends[i] = BLEND_MODES[r.blend] ?? BLEND_MODES.multiply;
        masks[i] = Math.min(1, Math.max(0, r.mask ?? 1));
      });
      gl.uniform4fv(u.uRects, geo);
      gl.uniform4fv(u.uRectColors, cols);
      gl.uniform1fv(u.uRectBlends, blends);
      gl.uniform1fv(u.uRectMasks, masks);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  start() {
    this.stop();
    const loop = () => {
      this.render();
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  }

  stop() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = 0;
  }

  destroy() {
    this.stop();
    const { gl } = this;
    gl.deleteTexture(this.tex);
    gl.deleteProgram(this.prog);
    // 不调用 loseContext()：同一 canvas 的 getContext 永远返回同一个上下文，
    // 主动丢弃会让后续复用（如 React StrictMode 的双重挂载）拿到已失效的上下文。
    this.source = null;
  }
}
