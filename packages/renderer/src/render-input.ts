// RenderInput は renderer に渡される入力契約を表す。
//
// - `careerProfile` は @jcd-editor/core が公開する `CareerProfile` 型に従う
//   parse 済みデータ。renderer 側で parse / validate は行わない
//   (`parseCareerProfile` 呼び出しは renderer の責務外、呼び出し側が事前に
//   parse する前提)。
// - `kind` は出力したいドキュメント種別 (rirekisho / shokumukeirekisho 等)。
// - `templateId` は templateId 明示時に使う。省略時は registry が `kind` に
//   マッチするテンプレートを implicit に選ぶ。実装は `templateId !== undefined`
//   で省略と指定を区別する必要がある (空文字列は「指定あり」として扱う)。
// - `editable` (WYSIWYG mode、optional、default false): true のとき template は
//   user data を流し込む div に `contenteditable="plaintext-only"` と
//   `data-field` を付与する。これにより、レンダリング結果の DOM を直接編集
//   UI として使える (= 入力 = preview = PDF の DOM が同一)。
//   false / 未指定のときは従来通り read-only な div を出力 (PDF / preview)。
//   template が editable を実装していない場合は無視される (graceful degrade)。

import type { CareerProfile } from '@jcd-editor/core';

import type { DocumentKind } from './document-kind';
import type { TemplateId } from './template-id';

export type RenderInput = {
  careerProfile: CareerProfile;
  kind: DocumentKind;
  templateId?: TemplateId;
  editable?: boolean;
};
