// 証明写真の「位置・拡大」調整モーダル (apps/local-web)。
//
// 役割:
//   - 固定アスペクト比の crop frame に写真を表示し、ドラッグで pan / スライダー
//     (とホイール) で zoom を調整させる
//   - 出力は core schema の ProfilePhotoTransform と同じ { zoom, offsetX, offsetY }
//   - frame の preview は renderer と同一の CSS モデル (object-fit: cover +
//     object-position + transform: scale) を使うので WYSIWYG / PDF と一致する
//
// 設計判断:
//   - 外部ライブラリ不使用 (repo 方針: ローカル完結 / 依存最小)。約 1 ファイルで完結
//   - DOM は createElement + textContent のみ (innerHTML 不使用、XSS 回避)
//   - a11y: role="dialog" aria-modal、focus trap、ESC / backdrop で閉じる、
//     frame は tabindex=0 で矢印キー pan / +- zoom に対応
//
// 単位:
//   - offsetX / offsetY は object-position のパーセント (0〜100、50=中央)
//   - zoom は 1〜3

export type PhotoTransform = {
  zoom: number;
  offsetX: number;
  offsetY: number;
};

export type OpenPhotoAdjustModalOptions = {
  /** 表示する画像の data URI */
  dataUri: string;
  /** crop frame のアスペクト比 (写真欄の width / height) */
  boxAspectRatio: number;
  /** 初期 transform */
  initial: PhotoTransform;
  /** 「適用」時に確定 transform を返す */
  onApply: (transform: PhotoTransform) => void;
  /** 「画像を変更」時 (モーダルは閉じてから呼ぶ)。未指定ならボタン非表示 */
  onChangeImage?: () => void;
};

const ZOOM_MIN = 1;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.05;
const OFFSET_KEY_STEP = 3; // 矢印キー 1 押下あたりの offset 変化 (%)

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const clampZoom = (z: number): number => clamp(z, ZOOM_MIN, ZOOM_MAX);
const clampOffset = (o: number): number => clamp(o, 0, 100);

const formatZoom = (zoom: number): string => `${zoom.toFixed(1)}×`;

/**
 * cover + scale(zoom) 時の、frame に対する画像のはみ出し量 (px) を軸ごとに返す。
 * pan のドラッグ量 → offset% 変換に使う。
 */
const computeOverflow = (
  frameW: number,
  frameH: number,
  naturalW: number,
  naturalH: number,
  zoom: number,
): { overflowX: number; overflowY: number } => {
  if (naturalW <= 0 || naturalH <= 0) return { overflowX: 0, overflowY: 0 };
  const coverScale = Math.max(frameW / naturalW, frameH / naturalH);
  const renderedW = naturalW * coverScale * zoom;
  const renderedH = naturalH * coverScale * zoom;
  return {
    overflowX: Math.max(0, renderedW - frameW),
    overflowY: Math.max(0, renderedH - frameH),
  };
};

/**
 * 写真調整モーダルを開く。
 */
export const openPhotoAdjustModal = (opts: OpenPhotoAdjustModalOptions): void => {
  const { dataUri, boxAspectRatio, initial, onApply, onChangeImage } = opts;

  // ライブ状態 (適用するまで currentPhoto には反映しない)
  const state: PhotoTransform = {
    zoom: clampZoom(initial.zoom),
    offsetX: clampOffset(initial.offsetX),
    offsetY: clampOffset(initial.offsetY),
  };

  const previouslyFocused =
    document.activeElement instanceof HTMLElement ? document.activeElement : null;

  // === DOM 構築 ===
  const backdrop = document.createElement('div');
  backdrop.className = 'photo-adjust-backdrop';

  const dialog = document.createElement('div');
  dialog.className = 'photo-adjust-dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'photo-adjust-title');

  const title = document.createElement('h2');
  title.className = 'photo-adjust-dialog__title';
  title.id = 'photo-adjust-title';
  title.textContent = '写真の位置・拡大を調整';

  const hint = document.createElement('p');
  hint.className = 'photo-adjust-dialog__hint';
  hint.textContent =
    '画像をドラッグして位置を、スライダー (またはホイール) で拡大率を調整します。枠の中が証明写真として印刷されます。';

  // crop frame
  const frame = document.createElement('div');
  frame.className = 'photo-adjust-frame';
  frame.style.aspectRatio = `${boxAspectRatio}`;
  frame.tabIndex = 0;
  frame.setAttribute('role', 'group');
  frame.setAttribute(
    'aria-label',
    '写真のプレビュー。ドラッグまたは矢印キーで位置、プラス・マイナスキーで拡大率を調整',
  );

  const image = document.createElement('img');
  image.className = 'photo-adjust-frame__image';
  image.src = dataUri;
  image.alt = '';

  const grid = document.createElement('div');
  grid.className = 'photo-adjust-frame__grid';

  frame.append(image, grid);

  // zoom row
  const zoomRow = document.createElement('div');
  zoomRow.className = 'photo-adjust-zoom';
  const zoomLabel = document.createElement('label');
  zoomLabel.className = 'photo-adjust-zoom__label';
  zoomLabel.textContent = '拡大率';
  zoomLabel.htmlFor = 'photo-adjust-zoom-slider';
  const zoomSlider = document.createElement('input');
  zoomSlider.className = 'photo-adjust-zoom__slider';
  zoomSlider.id = 'photo-adjust-zoom-slider';
  zoomSlider.type = 'range';
  zoomSlider.min = `${ZOOM_MIN}`;
  zoomSlider.max = `${ZOOM_MAX}`;
  zoomSlider.step = `${ZOOM_STEP}`;
  zoomSlider.value = `${state.zoom}`;
  const zoomValue = document.createElement('span');
  zoomValue.className = 'photo-adjust-zoom__value';
  zoomValue.setAttribute('aria-live', 'polite');
  zoomValue.textContent = formatZoom(state.zoom);
  zoomRow.append(zoomLabel, zoomSlider, zoomValue);

  // actions
  const actions = document.createElement('div');
  actions.className = 'photo-adjust-actions';

  const resetButton = document.createElement('button');
  resetButton.type = 'button';
  resetButton.className = 'photo-adjust-button';
  resetButton.textContent = 'リセット';

  let changeImageButton: HTMLButtonElement | undefined;
  if (onChangeImage !== undefined) {
    changeImageButton = document.createElement('button');
    changeImageButton.type = 'button';
    changeImageButton.className = 'photo-adjust-button';
    changeImageButton.textContent = '画像を変更';
  }

  const spacer = document.createElement('div');
  spacer.className = 'photo-adjust-actions__spacer';

  const cancelButton = document.createElement('button');
  cancelButton.type = 'button';
  cancelButton.className = 'photo-adjust-button';
  cancelButton.textContent = 'キャンセル';

  const applyButton = document.createElement('button');
  applyButton.type = 'button';
  applyButton.className = 'photo-adjust-button photo-adjust-button--primary';
  applyButton.textContent = '適用';

  actions.append(resetButton);
  if (changeImageButton !== undefined) actions.append(changeImageButton);
  actions.append(spacer, cancelButton, applyButton);

  dialog.append(title, hint, frame, zoomRow, actions);
  backdrop.append(dialog);

  // === preview 反映 ===
  const renderPreview = (): void => {
    // renderer と同一モデル: object-position は常に設定、 zoom>1 のときだけ scale
    image.style.objectPosition = `${state.offsetX}% ${state.offsetY}%`;
    if (state.zoom > 1) {
      image.style.transform = `scale(${state.zoom})`;
      image.style.transformOrigin = `${state.offsetX}% ${state.offsetY}%`;
    } else {
      image.style.transform = '';
      image.style.transformOrigin = '';
    }
    zoomSlider.value = `${state.zoom}`;
    zoomValue.textContent = formatZoom(state.zoom);
  };

  // === close / cleanup ===
  let closed = false;
  const close = (): void => {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKeydown, true);
    backdrop.remove();
    if (previouslyFocused !== null && document.contains(previouslyFocused)) {
      previouslyFocused.focus();
    }
  };

  // === zoom 操作 ===
  const setZoom = (z: number): void => {
    state.zoom = clampZoom(Number.parseFloat(z.toFixed(2)));
    renderPreview();
  };
  zoomSlider.addEventListener('input', () => {
    const v = Number.parseFloat(zoomSlider.value);
    if (Number.isFinite(v)) setZoom(v);
  });
  frame.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      setZoom(state.zoom + (e.deltaY < 0 ? ZOOM_STEP * 2 : -ZOOM_STEP * 2));
    },
    { passive: false },
  );

  // === pan (drag) 操作 ===
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  const panBy = (dxPx: number, dyPx: number): void => {
    const rect = frame.getBoundingClientRect();
    const { overflowX, overflowY } = computeOverflow(
      rect.width,
      rect.height,
      image.naturalWidth,
      image.naturalHeight,
      state.zoom,
    );
    // 画像を右にドラッグ → 左側が見える → object-position は減る。
    if (overflowX > 0) {
      state.offsetX = clampOffset(state.offsetX - (dxPx / overflowX) * 100);
    }
    if (overflowY > 0) {
      state.offsetY = clampOffset(state.offsetY - (dyPx / overflowY) * 100);
    }
    renderPreview();
  };
  frame.addEventListener('pointerdown', (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    frame.classList.add('is-grabbing');
    frame.setPointerCapture(e.pointerId);
  });
  frame.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    panBy(dx, dy);
  });
  const endDrag = (e: PointerEvent): void => {
    if (!dragging) return;
    dragging = false;
    frame.classList.remove('is-grabbing');
    if (frame.hasPointerCapture(e.pointerId)) frame.releasePointerCapture(e.pointerId);
  };
  frame.addEventListener('pointerup', endDrag);
  frame.addEventListener('pointercancel', endDrag);

  // === keyboard (frame focus 時): 矢印 pan / +- zoom ===
  frame.addEventListener('keydown', (e) => {
    let handled = true;
    switch (e.key) {
      case 'ArrowLeft':
        state.offsetX = clampOffset(state.offsetX - OFFSET_KEY_STEP);
        break;
      case 'ArrowRight':
        state.offsetX = clampOffset(state.offsetX + OFFSET_KEY_STEP);
        break;
      case 'ArrowUp':
        state.offsetY = clampOffset(state.offsetY - OFFSET_KEY_STEP);
        break;
      case 'ArrowDown':
        state.offsetY = clampOffset(state.offsetY + OFFSET_KEY_STEP);
        break;
      case '+':
      case '=':
        setZoom(state.zoom + ZOOM_STEP * 2);
        break;
      case '-':
        setZoom(state.zoom - ZOOM_STEP * 2);
        break;
      default:
        handled = false;
    }
    if (handled) {
      e.preventDefault();
      renderPreview();
    }
  });

  // === actions ===
  resetButton.addEventListener('click', () => {
    state.zoom = 1;
    state.offsetX = 50;
    state.offsetY = 50;
    renderPreview();
  });
  cancelButton.addEventListener('click', close);
  applyButton.addEventListener('click', () => {
    onApply({ zoom: state.zoom, offsetX: state.offsetX, offsetY: state.offsetY });
    close();
  });
  if (changeImageButton !== undefined && onChangeImage !== undefined) {
    changeImageButton.addEventListener('click', () => {
      close();
      onChangeImage();
    });
  }

  // backdrop click (dialog 外) で閉じる
  backdrop.addEventListener('pointerdown', (e) => {
    if (e.target === backdrop) close();
  });

  // === focus trap + ESC ===
  const focusableSelector = 'button, [href], input, [tabindex]:not([tabindex="-1"])';
  const onKeydown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    if (e.key !== 'Tab') return;
    const focusables = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector)).filter(
      (el) => !el.hasAttribute('disabled'),
    );
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (first === undefined || last === undefined) return;
    const active = document.activeElement;
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };
  document.addEventListener('keydown', onKeydown, true);

  // === mount ===
  document.body.append(backdrop);
  // 画像 load 後に初期 preview を確定 (naturalWidth が必要なのは drag のときだけ
  // なので、style 反映自体は即時で良い)。
  renderPreview();
  // 初期 focus は frame (操作の主対象) に。
  frame.focus();
};
