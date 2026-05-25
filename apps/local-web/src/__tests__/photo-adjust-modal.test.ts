// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

import { openPhotoAdjustModal, type PhotoTransform } from '../photo-adjust-modal';

const DATA_URI = 'data:image/png;base64,AAAA';

const openDefault = (overrides: Partial<Parameters<typeof openPhotoAdjustModal>[0]> = {}) => {
  const onApply = vi.fn();
  openPhotoAdjustModal({
    dataUri: DATA_URI,
    boxAspectRatio: 30.31 / 38.69,
    initial: { zoom: 1, offsetX: 50, offsetY: 50 },
    onApply,
    ...overrides,
  });
  return { onApply };
};

const backdrop = (): HTMLElement => {
  const el = document.querySelector<HTMLElement>('.photo-adjust-backdrop');
  if (el === null) throw new Error('modal not open');
  return el;
};

const findButton = (label: string): HTMLButtonElement => {
  const btn = Array.from(backdrop().querySelectorAll('button')).find(
    (b) => b.textContent === label,
  );
  if (btn === undefined) throw new Error(`button not found: ${label}`);
  return btn;
};

afterEach(() => {
  // 残ったモーダルを掃除 (innerHTML 不使用)
  document.body.replaceChildren();
});

describe('openPhotoAdjustModal', () => {
  it('role=dialog / aria-modal のモーダルを開く', () => {
    openDefault();
    const dialog = backdrop().querySelector('.photo-adjust-dialog');
    expect(dialog?.getAttribute('role')).toBe('dialog');
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
  });

  it('crop frame に boxAspectRatio が設定される', () => {
    openDefault();
    const frame = backdrop().querySelector<HTMLElement>('.photo-adjust-frame');
    // jsdom は aspect-ratio を `X / 1` 形に正規化する
    expect(frame?.style.aspectRatio).toBe(`${30.31 / 38.69} / 1`);
  });

  it('初期 transform が preview img に反映される (offset only)', () => {
    openDefault({ initial: { zoom: 1, offsetX: 30, offsetY: 70 } });
    const img = backdrop().querySelector<HTMLImageElement>('.photo-adjust-frame__image');
    expect(img?.style.objectPosition).toBe('30% 70%');
    // zoom=1 なので transform 無し
    expect(img?.style.transform).toBe('');
  });

  it('zoom slider 操作で preview に scale が乗る', () => {
    openDefault();
    const slider = backdrop().querySelector<HTMLInputElement>('.photo-adjust-zoom__slider');
    if (slider === null) throw new Error('no slider');
    slider.value = '2';
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    const img = backdrop().querySelector<HTMLImageElement>('.photo-adjust-frame__image');
    expect(img?.style.transform).toBe('scale(2)');
  });

  it('矢印キーで offset が変わる (ArrowRight で offsetX 増)', () => {
    openDefault();
    const frame = backdrop().querySelector<HTMLElement>('.photo-adjust-frame');
    if (frame === null) throw new Error('no frame');
    frame.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowRight' }));
    const img = backdrop().querySelector<HTMLImageElement>('.photo-adjust-frame__image');
    // 50 + 3 = 53
    expect(img?.style.objectPosition).toBe('53% 50%');
  });

  it('適用で onApply に transform を渡してモーダルを閉じる', () => {
    const { onApply } = openDefault();
    const slider = backdrop().querySelector<HTMLInputElement>('.photo-adjust-zoom__slider');
    if (slider === null) throw new Error('no slider');
    slider.value = '1.5';
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    findButton('適用').click();
    expect(onApply).toHaveBeenCalledTimes(1);
    const arg = onApply.mock.calls[0]?.[0] as PhotoTransform;
    expect(arg.zoom).toBeCloseTo(1.5);
    expect(document.querySelector('.photo-adjust-backdrop')).toBeNull();
  });

  it('キャンセルで onApply を呼ばずに閉じる', () => {
    const { onApply } = openDefault();
    findButton('キャンセル').click();
    expect(onApply).not.toHaveBeenCalled();
    expect(document.querySelector('.photo-adjust-backdrop')).toBeNull();
  });

  it('ESC で onApply を呼ばずに閉じる', () => {
    const { onApply } = openDefault();
    document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }));
    expect(onApply).not.toHaveBeenCalled();
    expect(document.querySelector('.photo-adjust-backdrop')).toBeNull();
  });

  it('リセットで初期 (zoom=1, 中央) に戻す', () => {
    openDefault({ initial: { zoom: 2.5, offsetX: 10, offsetY: 90 } });
    findButton('リセット').click();
    const img = backdrop().querySelector<HTMLImageElement>('.photo-adjust-frame__image');
    expect(img?.style.objectPosition).toBe('50% 50%');
    expect(img?.style.transform).toBe('');
  });

  it('onChangeImage 指定時のみ「画像を変更」ボタンが出て、 click で閉じてから callback', () => {
    const onChangeImage = vi.fn();
    openDefault({ onChangeImage });
    findButton('画像を変更').click();
    expect(document.querySelector('.photo-adjust-backdrop')).toBeNull();
    expect(onChangeImage).toHaveBeenCalledTimes(1);
  });

  it('onChangeImage 未指定なら「画像を変更」ボタンは無い', () => {
    openDefault();
    const btn = Array.from(backdrop().querySelectorAll('button')).find(
      (b) => b.textContent === '画像を変更',
    );
    expect(btn).toBeUndefined();
  });

  it('zoom slider に範囲外 (5) を入れても適用後 zoom は 3 以下に clamp される', () => {
    const { onApply } = openDefault();
    const slider = backdrop().querySelector<HTMLInputElement>('.photo-adjust-zoom__slider');
    if (slider === null) throw new Error('no slider');
    slider.value = '5';
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    findButton('適用').click();
    const arg = onApply.mock.calls[0]?.[0] as PhotoTransform;
    expect(arg.zoom).toBeLessThanOrEqual(3);
  });
});
