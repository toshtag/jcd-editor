// Certification は資格 / 認定 / 証明情報を表すモデル。
//
// - name:           資格・認定の正式名 (例: AWS Certified Solutions Architect、基本情報技術者試験)
// - issuer:         発行機関 (例: Amazon Web Services、IPA)
// - acquiredDate:   取得月 (YYYY-MM)
// - expirationDate: 失効月 (YYYY-MM、有効期限がある資格のみ)
// - credentialId:   認定 ID / 証明番号
// - credentialUrl:  認定検証ページ / バッジ URL (plain string として保持、
//                   フォーマット強制なし。URL らしさの判定は renderer / UI の責務)
// - description:    補足
//
// 本ファイルは renderer / template-specific validation や厳密な URL 検証を持たない。

import * as v from 'valibot';

import { createNonBlankTextSchema } from './_internal/text-validation';
import { isoYearMonthStringSchema, type IsoYearMonthString } from './value-objects/iso-date';

export type Certification = {
  name?: string;
  issuer?: string;
  acquiredDate?: IsoYearMonthString;
  expirationDate?: IsoYearMonthString;
  credentialId?: string;
  credentialUrl?: string;
  description?: string;
};

const NAME_MAX = 200;
const ISSUER_MAX = 200;
const CREDENTIAL_ID_MAX = 100;
const CREDENTIAL_URL_MAX = 2000;
const DESCRIPTION_MAX = 1000;

/** @internal */
export const certificationSchema = v.pipe(
  v.object({
    name: v.optional(createNonBlankTextSchema(NAME_MAX, '資格名')),
    issuer: v.optional(createNonBlankTextSchema(ISSUER_MAX, '発行機関')),
    acquiredDate: v.optional(isoYearMonthStringSchema),
    expirationDate: v.optional(isoYearMonthStringSchema),
    credentialId: v.optional(createNonBlankTextSchema(CREDENTIAL_ID_MAX, '認定 ID')),
    credentialUrl: v.optional(createNonBlankTextSchema(CREDENTIAL_URL_MAX, '認定 URL')),
    description: v.optional(createNonBlankTextSchema(DESCRIPTION_MAX, '備考')),
  }),
  v.check(
    (certification) =>
      certification.acquiredDate === undefined ||
      certification.expirationDate === undefined ||
      certification.acquiredDate <= certification.expirationDate,
    '取得月は失効月以前である必要があります',
  ),
);
