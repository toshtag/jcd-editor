// ProfilePhoto は履歴書の証明写真の参照を表す。
// dataUri (JSON 内に埋め込み) または relativePath (別ファイル参照) のいずれかを
// source で保持する。絶対パスと外部 URL は privacy / local-first の観点から
// 拒否する。core は画像データのデコードやファイルシステム操作を行わない。

import * as v from 'valibot';

import { isNonBlankText } from './_internal/text-validation';

export type ProfilePhotoMediaType = 'image/jpeg' | 'image/png';

export type ProfilePhotoSource =
  | { kind: 'dataUri'; dataUri: string; mediaType?: ProfilePhotoMediaType }
  | { kind: 'relativePath'; path: string; mediaType?: ProfilePhotoMediaType };

/**
 * 写真欄 (固定アスペクト比) 内での表示調整。
 *
 * すべて CSS の `object-fit: cover` + `object-position` + `transform: scale`
 * だけで表現できる値にしてある (renderer が画像の実寸を知らなくても PDF /
 * HTML 双方で同一の crop を再現できるようにするため)。
 *
 * - zoom: 1.0 = 等倍 (cover 相当の最小カバーサイズ)。1.5 = 1.5 倍拡大。
 *   1.0 未満は不可 (写真欄に白余白が出る)、3.0 を上限とする。
 * - offsetX / offsetY: `object-position` のパーセント値。0〜100 で、
 *   50 = 中央 (既定)。0 = 左端 / 上端、100 = 右端 / 下端を枠に合わせる。
 *   画像をドラッグして「枠に収める部分」を決めるのに使う。
 *
 * 既定値 (zoom=1, offsetX=50, offsetY=50) のフィールドは保存 JSON から省略
 * してよい (consumer 側で既定値に補完する)。
 */
export type ProfilePhotoTransform = {
  zoom?: number;
  offsetX?: number;
  offsetY?: number;
};

export type ProfilePhoto = {
  source?: ProfilePhotoSource;
  altText?: string;
  transform?: ProfilePhotoTransform;
};

const DATA_URI_MAX = 5_000_000;
const PATH_MAX = 1000;
const ALT_TEXT_MAX = 200;

// zoom の範囲: 1.0 (cover 等倍) 〜 3.0 (3 倍拡大)。 1.0 未満は写真欄に
// 白余白が出てしまうので不可。 3.0 を超える拡大は画質劣化が顕著で UX 低下。
const ZOOM_MIN = 1;
const ZOOM_MAX = 3;

// offset (object-position %) の範囲: 0 〜 100。 50 = 中央。
const OFFSET_MIN = 0;
const OFFSET_MAX = 100;

// prefix + payload (comma 後に最低 1 文字以上を要求)
const DATA_URI_PREFIX_REGEX = /^data:image\/(jpeg|png);base64,.+$/;

// POSIX absolute (/)、Windows root or UNC (\、\\)、Windows drive (C:\)、file:// URL
const hasAbsolutePathPrefix = (value: string): boolean =>
  value.startsWith('/') ||
  value.startsWith('\\') ||
  /^[a-zA-Z]:[\\/]/.test(value) ||
  value.startsWith('file://');

const hasExternalUrlPrefix = (value: string): boolean => /^(https?|ftp|data):/i.test(value);

// path segment として '..' が含まれるかをチェック (substring 検出ではない)
const hasParentTraversal = (value: string): boolean =>
  value.split(/[/\\]/).some((segment) => segment === '..');

const mediaTypeSchema = v.picklist(['image/jpeg', 'image/png']);

const dataUriSourceSchema = v.object({
  kind: v.literal('dataUri'),
  dataUri: v.pipe(
    v.string(),
    v.minLength(1, 'dataUri を入力してください'),
    v.check(isNonBlankText, 'dataUri に空白のみは指定できません'),
    v.maxLength(DATA_URI_MAX, 'dataUri が長すぎます'),
    v.regex(
      DATA_URI_PREFIX_REGEX,
      'dataUri は data:image/jpeg;base64, または data:image/png;base64, で始まり、画像データを含む必要があります',
    ),
  ),
  mediaType: v.optional(mediaTypeSchema),
});

const relativePathSourceSchema = v.object({
  kind: v.literal('relativePath'),
  path: v.pipe(
    v.string(),
    v.minLength(1, 'パスを入力してください'),
    v.check(isNonBlankText, 'パスに空白のみは指定できません'),
    v.maxLength(PATH_MAX, 'パスが長すぎます'),
    v.check((value) => !hasAbsolutePathPrefix(value), '絶対パスは指定できません'),
    v.check((value) => !hasExternalUrlPrefix(value), '外部 URL は指定できません'),
    v.check((value) => !hasParentTraversal(value), '親ディレクトリ参照 (../) は指定できません'),
  ),
  mediaType: v.optional(mediaTypeSchema),
});

const profilePhotoSourceSchema = v.variant('kind', [dataUriSourceSchema, relativePathSourceSchema]);

const offsetSchema = v.pipe(
  v.number(),
  v.minValue(OFFSET_MIN, `offset は ${OFFSET_MIN} 以上を指定してください`),
  v.maxValue(OFFSET_MAX, `offset は ${OFFSET_MAX} 以下を指定してください`),
);

const profilePhotoTransformSchema = v.object({
  zoom: v.optional(
    v.pipe(
      v.number(),
      v.minValue(ZOOM_MIN, `zoom は ${ZOOM_MIN} 以上を指定してください`),
      v.maxValue(ZOOM_MAX, `zoom は ${ZOOM_MAX} 以下を指定してください`),
    ),
  ),
  offsetX: v.optional(offsetSchema),
  offsetY: v.optional(offsetSchema),
});

/** @internal */
export const profilePhotoSchema = v.object({
  source: v.optional(profilePhotoSourceSchema),
  altText: v.optional(
    v.pipe(
      v.string(),
      v.minLength(1, 'altText を入力してください'),
      v.check(isNonBlankText, 'altText に空白のみは指定できません'),
      v.maxLength(ALT_TEXT_MAX, 'altText が長すぎます'),
    ),
  ),
  transform: v.optional(profilePhotoTransformSchema),
});
