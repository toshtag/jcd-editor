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

export type ProfilePhoto = {
  source?: ProfilePhotoSource;
  altText?: string;
};

const DATA_URI_MAX = 5_000_000;
const PATH_MAX = 1000;
const ALT_TEXT_MAX = 200;

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
});
