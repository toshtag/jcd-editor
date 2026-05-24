// Profile photo resize helpers (apps/local-web)。
//
// 役割:
//   - 高解像度の File (~10 MB の JPEG/PNG) を、 core schema の dataUri
//     上限 (5,000,000 chars ≈ 3.75 MB raw) 以下に収まる data URI に変換する
//   - 履歴書の写真欄 (紙上 30.31mm × 38.69mm @ 300dpi ≈ 358 × 457 px) を
//     満たすのに必要な解像度は high-DPI でも 1200 px 程度。長辺 2400 px を
//     初期目標とし、目標サイズに収まるまで段階的に縮小する
//
// 設計判断:
//   - PNG 入力でも JPEG q=0.9 で再エンコード (証明写真は写実画像で透過不要、
//     PNG より圧倒的に小さい)
//   - リサイズ不要なほど小さい画像 (long edge ≤ 1600 px) はそのまま data URI
//     化して JPEG 再エンコードを避ける (= 余計な loss を入れない)
//   - 例外時はメッセージ付き Error を throw し、 main.ts 側で showStatus に
//     表示する
//
// 責務分離:
//   - validatePhotoFile (profile-photo.ts) は pure 検証で、本 module を
//     呼ばずに MIME / 上限バイト数だけ確認する
//   - 本 module は DOM API (Image / Canvas / URL.createObjectURL) を使う
//     ので testing では jsdom の制限に注意 (canvas.toDataURL は jsdom 標準
//     では 'data:,' しか返さないため、 unit test は smoke level に留める)

// core schema dataUri は 5,000,000 chars。 base64 overhead を考慮して
// 安全マージン込み 4,500,000 chars (= 約 3.3 MB raw) を目標とする。
const TARGET_DATA_URI_MAX_CHARS = 4_500_000;

// raw bytes 換算で安全に data URI 化できる入力 file size の閾値。
// 4,500,000 chars / (4/3 base64 膨張) ≈ 3,375,000 bytes。安全側に 3,000,000。
// この閾値以下なら画像 decode を経由せず単純 data URI 化で OK。
const SKIP_DECODE_MAX_BYTES = 3_000_000;

// 履歴書写真欄を紙上で過不足なく満たす長辺の初期値 (px)。 high-DPI display や
// PDF 出力時の鮮明さを担保しつつ、不要に大きくしない。
const INITIAL_MAX_EDGE_PX = 2400;

// この閾値以下の画像はリサイズせずそのまま data URI 化する (lossless 維持)。
const SKIP_RESIZE_MAX_EDGE_PX = 1600;

// 縮小段階 (1 回で目標未達なら次の長辺で再エンコード)。 0.75x ずつ。
const RESIZE_STEPS_PX = [INITIAL_MAX_EDGE_PX, 1800, 1350, 1000, 750];

// 再エンコード時の JPEG quality。証明写真用途で 0.9 を初期値、目標未達なら
// 段階的に下げる。 0.7 を下回ると顔の階調が破綻し始めるため、これより低くしない。
const JPEG_QUALITY_STEPS = [0.9, 0.85, 0.8, 0.75, 0.7];

const loadImageFromFile = async (file: File): Promise<HTMLImageElement> => {
  const objectUrl = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        resolve(img);
      };
      img.onerror = () => {
        reject(new Error('画像の読み込みに失敗しました (壊れたファイルの可能性があります)'));
      };
      img.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

const fileToDataUri = async (file: File): Promise<string> => {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('FileReader が string を返しませんでした'));
        return;
      }
      resolve(result);
    };
    reader.onerror = () => {
      reject(new Error('ファイル読み込みに失敗しました'));
    };
    reader.readAsDataURL(file);
  });
};

const drawScaledToCanvas = (
  img: HTMLImageElement,
  maxEdgePx: number,
): { canvas: HTMLCanvasElement; width: number; height: number } => {
  const longEdge = Math.max(img.naturalWidth, img.naturalHeight);
  const scale = longEdge > maxEdgePx ? maxEdgePx / longEdge : 1;
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx === null) {
    throw new Error('Canvas 2D context を取得できませんでした');
  }
  // 縮小品質の向上のため、smoothing を有効にする (Chrome / Safari default true
  // だが明示)。
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);
  return { canvas, width, height };
};

export type ResizedPhoto = {
  /** 出力 data URI (常に image/jpeg、後段の schema 通過用)。 */
  dataUri: string;
  /** 出力 media type。 リサイズが走れば image/jpeg。 入力が小さく no-op
   *  なら入力 mediaType (image/jpeg | image/png) のまま。 */
  mediaType: 'image/jpeg' | 'image/png';
  /** リサイズが実際に走ったか (テスト / debug 用) */
  resized: boolean;
};

/**
 * 写真ファイルを core schema dataUri 上限内に収まる data URI に変換する。
 *
 * - 入力が SKIP_RESIZE_MAX_EDGE_PX 以下: 無変換で data URI 化
 *   (PNG は PNG のまま、 JPEG は JPEG のまま)
 * - それ以外: 段階的に縮小 + JPEG 再エンコードし、目標 chars 以下に収まる
 *   最初の組み合わせを返す
 * - すべての組み合わせで目標未達: 最も小さい結果を返し、 caller 側で
 *   schema validation に委ねる (5,000,000 chars 未満なら通る可能性あり)
 *
 * @throws Error 画像読み込みや Canvas 操作に失敗した場合
 */
export const resizePhotoToDataUri = async (file: File): Promise<ResizedPhoto> => {
  // 早期 fast-path: ファイル size が十分小さいなら、画像 decode (Image / Canvas)
  // を経由せずに直接 data URI 化する。 base64 膨張後も core schema 上限に収まる
  // ことが保証される。 利点:
  //   - 小さい入力で余計な decode / re-encode を行わない (lossless 維持)
  //   - jsdom など Image.onload が発火しない環境でも安全に通る
  if (file.size <= SKIP_DECODE_MAX_BYTES) {
    const dataUri = await fileToDataUri(file);
    return {
      dataUri,
      mediaType: file.type as 'image/jpeg' | 'image/png',
      resized: false,
    };
  }

  const img = await loadImageFromFile(file);
  const longEdge = Math.max(img.naturalWidth, img.naturalHeight);

  // SKIP_RESIZE_MAX_EDGE_PX 以下なら無変換で data URI 化を試みる。
  // 結果が目標以下なら lossless で済む。 超える場合はリサイズに fall through。
  if (longEdge <= SKIP_RESIZE_MAX_EDGE_PX) {
    const dataUri = await fileToDataUri(file);
    if (dataUri.length <= TARGET_DATA_URI_MAX_CHARS) {
      return {
        dataUri,
        mediaType: file.type as 'image/jpeg' | 'image/png',
        resized: false,
      };
    }
    // PNG で長辺小さくても base64 が膨らむケース (透過大きな PNG など)
    // のために fall through。
  }

  // 段階的に縮小 + 再エンコードを試す。
  let smallest: { dataUri: string; length: number } | null = null;
  for (const maxEdge of RESIZE_STEPS_PX) {
    const { canvas } = drawScaledToCanvas(img, maxEdge);
    for (const quality of JPEG_QUALITY_STEPS) {
      const dataUri = canvas.toDataURL('image/jpeg', quality);
      if (dataUri.length <= TARGET_DATA_URI_MAX_CHARS) {
        return { dataUri, mediaType: 'image/jpeg', resized: true };
      }
      if (smallest === null || dataUri.length < smallest.length) {
        smallest = { dataUri, length: dataUri.length };
      }
    }
  }

  // 目標未達でも最小結果を返す (core schema は 5,000,000 chars までは許容)。
  if (smallest === null) {
    throw new Error('画像のリサイズに失敗しました');
  }
  return { dataUri: smallest.dataUri, mediaType: 'image/jpeg', resized: true };
};
