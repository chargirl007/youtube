'use strict';

const canvas = document.getElementById('thumbnailCanvas');
const ctx = canvas.getContext('2d');
const W = 1280, H = 720;

// === State ===
const state = {
  bg: {
    style: 'solid',
    color: '#2d5a3d',
    grad1: '#2d5a3d',
    grad2: '#1a1a2e',
    gradDir: 'horizontal',
    photo: null,
    overlayColor: '#000000',
    overlayOpacity: 0.4,
  },
  photo: {
    img: null,
    x: 640, y: 360,
    scale: 1,
    flipX: false,
    removeBg: false,
  },
  textLayers: [],
  decos: [],
  border: {
    style: 'none',
    color: '#f5c842',
    width: 8,
  },
  decoColor: '#f5c842',
  decoSize: 60,
};

// === Render ===
function render() {
  ctx.clearRect(0, 0, W, H);
  drawBackground();
  drawPhoto();
  drawDecorations();
  drawTextLayers();
  drawBorder();
}

function drawBackground() {
  const { bg } = state;
  if (bg.style === 'solid') {
    ctx.fillStyle = bg.color;
    ctx.fillRect(0, 0, W, H);
  } else if (bg.style === 'gradient') {
    let grad;
    if (bg.gradDir === 'horizontal') {
      grad = ctx.createLinearGradient(0, 0, W, 0);
    } else if (bg.gradDir === 'vertical') {
      grad = ctx.createLinearGradient(0, 0, 0, H);
    } else if (bg.gradDir === 'diagonal') {
      grad = ctx.createLinearGradient(0, 0, W, H);
    } else {
      grad = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, W*0.7);
    }
    grad.addColorStop(0, bg.grad1);
    grad.addColorStop(1, bg.grad2);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  } else if (bg.style === 'photo' && bg.photo) {
    const img = bg.photo;
    const scale = Math.max(W / img.width, H / img.height);
    const sw = img.width * scale, sh = img.height * scale;
    ctx.drawImage(img, (W - sw) / 2, (H - sh) / 2, sw, sh);
    // overlay
    const hex = bg.overlayColor;
    ctx.fillStyle = hexToRgba(hex, bg.overlayOpacity);
    ctx.fillRect(0, 0, W, H);
  } else {
    ctx.fillStyle = '#1a1a22';
    ctx.fillRect(0, 0, W, H);
  }
}

function drawPhoto() {
  const { photo } = state;
  if (!photo.img) return;
  const img = photo.img;
  const sw = img.width * photo.scale;
  const sh = img.height * photo.scale;
  ctx.save();
  ctx.translate(photo.x, photo.y);
  if (photo.flipX) ctx.scale(-1, 1);
  ctx.drawImage(img, -sw / 2, -sh / 2, sw, sh);
  ctx.restore();
}

function drawTextLayers() {
  state.textLayers.forEach(layer => {
    if (!layer.text.trim()) return;
    ctx.save();
    ctx.translate(layer.x, layer.y);
    ctx.rotate((layer.rotation * Math.PI) / 180);

    const size = layer.size;
    const weight = layer.bold ? 'bold' : 'normal';
    const style = layer.italic ? 'italic ' : '';
    ctx.font = `${style}${weight} ${size}px "${layer.font}"`;
    ctx.textAlign = layer.align;
    ctx.textBaseline = 'middle';

    const lines = layer.text.split('\n');
    const lineH = size * 1.2;
    const totalH = lines.length * lineH;
    const startY = -(totalH / 2) + lineH / 2;

    lines.forEach((line, i) => {
      const y = startY + i * lineH;
      const metrics = ctx.measureText(line);
      const tw = metrics.width;

      // Background box
      if (layer.bgEnabled) {
        const pad = layer.bgPadding;
        const rad = layer.bgRadius;
        let bx = -pad;
        if (layer.align === 'center') bx = -tw / 2 - pad;
        if (layer.align === 'right') bx = -tw - pad;
        const by = y - size / 2 - pad;
        const bw = tw + pad * 2;
        const bh = size + pad * 2;
        roundRect(ctx, bx, by, bw, bh, rad, layer.bgColor);
      }

      // Shadow
      if (layer.shadow) {
        ctx.shadowColor = 'rgba(0,0,0,0.7)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetX = 3;
        ctx.shadowOffsetY = 3;
      }

      // Stroke / outline
      if (layer.stroke) {
        ctx.strokeStyle = layer.strokeColor;
        ctx.lineWidth = layer.strokeWidth * 2;
        ctx.lineJoin = 'round';
        ctx.strokeText(line, 0, y);
      }

      ctx.fillStyle = layer.color;
      ctx.fillText(line, 0, y);

      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    });

    ctx.restore();
  });
}

function roundRect(ctx, x, y, w, h, r, fill) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function drawDecorations() {
  state.decos.forEach(d => {
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.rotate((d.rotation * Math.PI) / 180);
    ctx.fillStyle = d.color;
    ctx.strokeStyle = d.color;
    ctx.lineWidth = 3;

    switch (d.type) {
      case 'star': drawStar(ctx, 0, 0, d.size); break;
      case 'heart': drawHeart(ctx, 0, 0, d.size); break;
      case 'circle': drawCircle(ctx, 0, 0, d.size); break;
      case 'squiggle': drawSquiggle(ctx, 0, 0, d.size); break;
      case 'arrow': drawArrow(ctx, 0, 0, d.size); break;
      case 'dot': drawDots(ctx, 0, 0, d.size); break;
      case 'badge': drawBadge(ctx, 0, 0, d.size); break;
      case 'leaf': drawLeaf(ctx, 0, 0, d.size); break;
    }
    ctx.restore();
  });
}

function drawStar(ctx, x, y, size) {
  const r1 = size / 2, r2 = size / 5;
  const pts = 5;
  ctx.beginPath();
  for (let i = 0; i < pts * 2; i++) {
    const r = i % 2 === 0 ? r1 : r2;
    const angle = (i * Math.PI) / pts - Math.PI / 2;
    i === 0 ? ctx.moveTo(x + r * Math.cos(angle), y + r * Math.sin(angle))
             : ctx.lineTo(x + r * Math.cos(angle), y + r * Math.sin(angle));
  }
  ctx.closePath();
  ctx.fill();
}

function drawHeart(ctx, x, y, size) {
  const s = size / 60;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.moveTo(0, -10);
  ctx.bezierCurveTo(-30, -40, -60, -10, 0, 30);
  ctx.bezierCurveTo(60, -10, 30, -40, 0, -10);
  ctx.fill();
  ctx.restore();
}

function drawCircle(ctx, x, y, size) {
  ctx.beginPath();
  ctx.arc(x, y, size / 2, 0, Math.PI * 2);
  ctx.lineWidth = size / 10;
  ctx.stroke();
}

function drawSquiggle(ctx, x, y, size) {
  const s = size;
  ctx.beginPath();
  ctx.moveTo(x - s / 2, y);
  ctx.bezierCurveTo(x - s / 4, y - s / 3, x + s / 4, y + s / 3, x + s / 2, y);
  ctx.lineWidth = size / 12;
  ctx.stroke();
}

function drawArrow(ctx, x, y, size) {
  const s = size / 2;
  ctx.beginPath();
  ctx.moveTo(x - s, y);
  ctx.lineTo(x + s, y);
  ctx.lineTo(x + s * 0.5, y - s * 0.4);
  ctx.moveTo(x + s, y);
  ctx.lineTo(x + s * 0.5, y + s * 0.4);
  ctx.lineWidth = size / 10;
  ctx.stroke();
}

function drawDots(ctx, x, y, size) {
  const r = size / 12;
  const gap = size / 3;
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      ctx.beginPath();
      ctx.arc(x + i * gap, y + j * gap, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawBadge(ctx, x, y, size) {
  const r = size / 2;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4 - Math.PI / 8;
    const rr = i % 2 === 0 ? r : r * 0.8;
    i === 0 ? ctx.moveTo(x + rr * Math.cos(angle), y + rr * Math.sin(angle))
             : ctx.lineTo(x + rr * Math.cos(angle), y + rr * Math.sin(angle));
  }
  ctx.closePath();
  ctx.fill();
}

function drawLeaf(ctx, x, y, size) {
  ctx.beginPath();
  ctx.moveTo(x, y - size / 2);
  ctx.bezierCurveTo(x + size / 2, y - size / 4, x + size / 2, y + size / 4, x, y + size / 2);
  ctx.bezierCurveTo(x - size / 2, y + size / 4, x - size / 2, y - size / 4, x, y - size / 2);
  ctx.fill();
}

function drawBorder() {
  const { border } = state;
  if (border.style === 'none') return;
  const half = border.width / 2;
  ctx.strokeStyle = border.color;
  ctx.lineWidth = border.width;

  if (border.style === 'dashed') {
    ctx.setLineDash([border.width * 3, border.width * 2]);
  } else if (border.style === 'double') {
    ctx.setLineDash([]);
    ctx.strokeRect(half, half, W - border.width, H - border.width);
    ctx.strokeRect(half * 3, half * 3, W - border.width * 3, H - border.width * 3);
    return;
  } else {
    ctx.setLineDash([]);
  }

  ctx.strokeRect(half, half, W - border.width, H - border.width);
  ctx.setLineDash([]);
}

// === Text Layers ===
let textLayerCount = 0;

function createTextLayer() {
  const id = ++textLayerCount;
  const layer = {
    id,
    text: 'Your Title Here',
    font: 'Caveat',
    size: 80,
    color: '#ffffff',
    bold: false,
    italic: false,
    shadow: true,
    stroke: false,
    strokeColor: '#000000',
    strokeWidth: 3,
    x: 640,
    y: 360,
    rotation: 0,
    align: 'center',
    bgEnabled: false,
    bgColor: '#f5c842',
    bgPadding: 10,
    bgRadius: 8,
  };
  state.textLayers.push(layer);
  return layer;
}

function addTextLayerUI(layer) {
  const template = document.getElementById('textLayerTemplate');
  const clone = template.content.cloneNode(true);
  const card = clone.querySelector('.text-layer-card');
  card.dataset.id = layer.id;
  card.querySelector('.text-layer-label').textContent = `Text Layer ${layer.id}`;

  const textarea = card.querySelector('.text-content');
  textarea.value = layer.text;
  textarea.addEventListener('input', () => { layer.text = textarea.value; render(); });

  const fontSel = card.querySelector('.text-font');
  fontSel.value = layer.font;
  fontSel.addEventListener('change', () => { layer.font = fontSel.value; render(); });

  const sizeSlider = card.querySelector('.text-size');
  const sizeVal = card.querySelector('.size-val');
  sizeSlider.value = layer.size;
  sizeSlider.addEventListener('input', () => {
    layer.size = +sizeSlider.value;
    sizeVal.textContent = layer.size;
    render();
  });

  const colorInput = card.querySelector('.text-color');
  colorInput.value = layer.color;
  colorInput.addEventListener('input', () => { layer.color = colorInput.value; render(); });

  card.querySelectorAll('[data-tc]').forEach(btn => {
    btn.addEventListener('click', () => {
      layer.color = btn.dataset.tc;
      colorInput.value = layer.color;
      render();
    });
  });

  card.querySelectorAll('.style-toggle').forEach(btn => {
    btn.dataset.prop === 'shadow' && layer.shadow && btn.classList.add('active');
    btn.addEventListener('click', () => {
      const prop = btn.dataset.prop;
      layer[prop] = !layer[prop];
      btn.classList.toggle('active', layer[prop]);
      render();
    });
  });

  const strokeColor = card.querySelector('.text-stroke-color');
  strokeColor.value = layer.strokeColor;
  strokeColor.addEventListener('input', () => { layer.strokeColor = strokeColor.value; render(); });

  const strokeWidth = card.querySelector('.text-stroke-width');
  const strokeVal = card.querySelector('.stroke-val');
  strokeWidth.addEventListener('input', () => {
    layer.strokeWidth = +strokeWidth.value;
    strokeVal.textContent = layer.strokeWidth;
    render();
  });

  const posX = card.querySelector('.text-pos-x');
  const posXVal = card.querySelector('.pos-x-val');
  posX.value = layer.x;
  posX.addEventListener('input', () => {
    layer.x = +posX.value;
    posXVal.textContent = layer.x;
    render();
  });

  const posY = card.querySelector('.text-pos-y');
  const posYVal = card.querySelector('.pos-y-val');
  posY.value = layer.y;
  posY.addEventListener('input', () => {
    layer.y = +posY.value;
    posYVal.textContent = layer.y;
    render();
  });

  const rotation = card.querySelector('.text-rotation');
  const rotVal = card.querySelector('.rot-val');
  rotation.addEventListener('input', () => {
    layer.rotation = +rotation.value;
    rotVal.textContent = layer.rotation;
    render();
  });

  card.querySelectorAll('[data-align]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.align === layer.align);
    btn.addEventListener('click', () => {
      layer.align = btn.dataset.align;
      card.querySelectorAll('[data-align]').forEach(b => b.classList.toggle('active', b === btn));
      render();
    });
  });

  const bgToggle = card.querySelector('.text-bg-toggle');
  bgToggle.checked = layer.bgEnabled;
  bgToggle.addEventListener('change', () => { layer.bgEnabled = bgToggle.checked; render(); });

  const bgColor = card.querySelector('.text-bg-color');
  bgColor.value = layer.bgColor;
  bgColor.addEventListener('input', () => { layer.bgColor = bgColor.value; render(); });

  const bgPad = card.querySelector('.text-bg-padding');
  const bgPadVal = card.querySelector('.bg-pad-val');
  bgPad.addEventListener('input', () => {
    layer.bgPadding = +bgPad.value;
    bgPadVal.textContent = layer.bgPadding;
    render();
  });

  const bgRad = card.querySelector('.text-bg-radius');
  const bgRadVal = card.querySelector('.bg-rad-val');
  bgRad.addEventListener('input', () => {
    layer.bgRadius = +bgRad.value;
    bgRadVal.textContent = layer.bgRadius;
    render();
  });

  card.querySelector('.remove-text-btn').addEventListener('click', () => {
    state.textLayers = state.textLayers.filter(l => l.id !== layer.id);
    card.remove();
    render();
  });

  document.getElementById('textLayersList').appendChild(clone);
}

// === Decorations ===
let decoCount = 0;

function addDeco(type) {
  const id = ++decoCount;
  const deco = {
    id,
    type,
    x: W / 2 + (Math.random() - 0.5) * 400,
    y: H / 2 + (Math.random() - 0.5) * 200,
    color: state.decoColor,
    size: state.decoSize,
    rotation: Math.random() * 30 - 15,
  };
  state.decos.push(deco);
  addDecoItemUI(deco);
  render();
}

function addDecoItemUI(deco) {
  const list = document.getElementById('decoItemsList');
  const row = document.createElement('div');
  row.className = 'deco-item-row';
  row.dataset.id = deco.id;

  const icons = { star:'✦', heart:'♥', circle:'◎', squiggle:'〜', arrow:'→', dot:'•', badge:'◉', leaf:'❧' };
  row.innerHTML = `
    <span>${icons[deco.type] || '?'} ${deco.type}</span>
    <label style="font-size:0.75rem;color:#8a8490">X</label>
    <input type="range" min="0" max="1280" value="${Math.round(deco.x)}" style="width:60px;accent-color:#c9a96e" class="deco-x">
    <label style="font-size:0.75rem;color:#8a8490">Y</label>
    <input type="range" min="0" max="720" value="${Math.round(deco.y)}" style="width:60px;accent-color:#c9a96e" class="deco-y">
    <button title="Remove">✕</button>
  `;

  row.querySelector('.deco-x').addEventListener('input', e => {
    deco.x = +e.target.value; render();
  });
  row.querySelector('.deco-y').addEventListener('input', e => {
    deco.y = +e.target.value; render();
  });
  row.querySelector('button').addEventListener('click', () => {
    state.decos = state.decos.filter(d => d.id !== deco.id);
    row.remove();
    render();
  });

  list.appendChild(row);
}

// === Event Wiring ===

// BG style buttons
document.getElementById('bgStyleBtns').querySelectorAll('.style-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.getElementById('bgStyleBtns').querySelectorAll('.style-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.bg.style = btn.dataset.style;
    document.getElementById('solidColorGroup').classList.toggle('hidden', state.bg.style !== 'solid');
    document.getElementById('gradientGroup').classList.toggle('hidden', state.bg.style !== 'gradient');
    document.getElementById('bgPhotoGroup').classList.toggle('hidden', state.bg.style !== 'photo');
    render();
  });
});

document.getElementById('bgColor').addEventListener('input', e => { state.bg.color = e.target.value; render(); });
document.querySelectorAll('[data-color]').forEach(btn => {
  btn.addEventListener('click', () => {
    state.bg.color = btn.dataset.color;
    document.getElementById('bgColor').value = state.bg.color;
    render();
  });
});

document.getElementById('gradColor1').addEventListener('input', e => { state.bg.grad1 = e.target.value; render(); });
document.getElementById('gradColor2').addEventListener('input', e => { state.bg.grad2 = e.target.value; render(); });
document.getElementById('gradDirection').addEventListener('change', e => { state.bg.gradDir = e.target.value; render(); });

document.getElementById('bgPhotoInput').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const img = new Image();
  img.onload = () => { state.bg.photo = img; render(); };
  img.src = URL.createObjectURL(file);
});

const bgOverlay = document.getElementById('bgOverlay');
const bgOverlayVal = document.getElementById('bgOverlayVal');
bgOverlay.addEventListener('input', () => {
  state.bg.overlayOpacity = +bgOverlay.value / 100;
  bgOverlayVal.textContent = bgOverlay.value;
  render();
});

document.getElementById('bgOverlayColor').addEventListener('input', e => { state.bg.overlayColor = e.target.value; render(); });
document.querySelectorAll('[data-overlay]').forEach(btn => {
  btn.addEventListener('click', () => {
    state.bg.overlayColor = btn.dataset.overlay;
    document.getElementById('bgOverlayColor').value = state.bg.overlayColor;
    render();
  });
});

// Photo upload
document.getElementById('photoInput').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const img = new Image();
  img.onload = () => {
    const scale = Math.min((W * 0.6) / img.width, (H * 0.9) / img.height, 1);
    state.photo.img = img;
    state.photo.scale = scale;
    document.getElementById('photoControls').classList.remove('hidden');
    document.getElementById('photoScale').value = Math.round(scale * 100);
    document.getElementById('photoScaleVal').textContent = Math.round(scale * 100);
    render();
  };
  img.src = URL.createObjectURL(file);
});

document.getElementById('photoX').addEventListener('input', e => {
  state.photo.x = +e.target.value;
  document.getElementById('photoXVal').textContent = e.target.value;
  render();
});

document.getElementById('photoY').addEventListener('input', e => {
  state.photo.y = +e.target.value;
  document.getElementById('photoYVal').textContent = e.target.value;
  render();
});

document.getElementById('photoScale').addEventListener('input', e => {
  state.photo.scale = +e.target.value / 100;
  document.getElementById('photoScaleVal').textContent = e.target.value;
  render();
});

document.getElementById('flipPhotoBtn').addEventListener('click', () => {
  state.photo.flipX = !state.photo.flipX;
  render();
});

document.getElementById('removeBgBtn').addEventListener('click', () => {
  if (!state.photo.img) return;
  const offscreen = document.createElement('canvas');
  offscreen.width = state.photo.img.width;
  offscreen.height = state.photo.img.height;
  const oc = offscreen.getContext('2d');
  oc.drawImage(state.photo.img, 0, 0);
  const imageData = oc.getImageData(0, 0, offscreen.width, offscreen.height);
  const data = imageData.data;

  // Simple threshold: make near-white pixels transparent
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i+1], b = data[i+2];
    if (r > 220 && g > 220 && b > 220) data[i+3] = 0;
  }
  oc.putImageData(imageData, 0, 0);
  const newImg = new Image();
  newImg.onload = () => { state.photo.img = newImg; render(); };
  newImg.src = offscreen.toDataURL();
});

// Text layers
document.getElementById('addTextBtn').addEventListener('click', () => {
  const layer = createTextLayer();
  layer.text = '';
  layer.y = 100 + state.textLayers.length * 100;
  addTextLayerUI(layer);
  render();
});

// Decorations
document.querySelectorAll('.deco-btn').forEach(btn => {
  btn.addEventListener('click', () => addDeco(btn.dataset.deco));
});

document.getElementById('decoColor').addEventListener('input', e => { state.decoColor = e.target.value; });
document.querySelectorAll('[data-deco-color]').forEach(btn => {
  btn.addEventListener('click', () => {
    state.decoColor = btn.dataset.decoColor;
    document.getElementById('decoColor').value = state.decoColor;
  });
});

const decoSize = document.getElementById('decoSize');
const decoSizeVal = document.getElementById('decoSizeVal');
decoSize.addEventListener('input', () => {
  state.decoSize = +decoSize.value;
  decoSizeVal.textContent = decoSize.value;
});

// Border
document.querySelectorAll('[data-border]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-border]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.border.style = btn.dataset.border;
    render();
  });
});

document.getElementById('borderColor').addEventListener('input', e => { state.border.color = e.target.value; render(); });

const borderWidth = document.getElementById('borderWidth');
const borderWidthVal = document.getElementById('borderWidthVal');
borderWidth.addEventListener('input', () => {
  state.border.width = +borderWidth.value;
  borderWidthVal.textContent = borderWidth.value;
  render();
});

// Download
document.getElementById('downloadBtn').addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = 'thumbnail.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
});

// Reset
document.getElementById('resetBtn').addEventListener('click', () => {
  if (!confirm('Reset all changes?')) return;
  location.reload();
});

// === Helpers ===
function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// === Init ===
function init() {
  // Default text layer
  const layer = createTextLayer();
  layer.text = 'Your Title Here';
  layer.font = 'Caveat';
  layer.size = 110;
  layer.shadow = true;
  layer.y = 200;
  addTextLayerUI(layer);

  // Default decorations
  state.decos.push({ id: ++decoCount, type: 'star', x: 100, y: 80, color: '#f5c842', size: 50, rotation: 15 });
  state.decos.push({ id: ++decoCount, type: 'star', x: 1180, y: 100, color: '#f5c842', size: 35, rotation: -10 });
  state.decos.push({ id: ++decoCount, type: 'star', x: 200, y: 650, color: '#f5c842', size: 30, rotation: 5 });

  render();
}

init();
