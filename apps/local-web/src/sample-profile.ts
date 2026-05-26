// Sample CareerProfile input (raw plain object)。
//
// 型扱い:
//   - `CareerProfile` は parse 後の validated domain type (branded type を含む
//     可能性) のため、本 fixture は `as const satisfies CareerProfile` を **使わず**
//     raw input として宣言する
//   - `safeParseCareerProfile(sampleProfileInput)` で runtime validation し、
//     `success` の場合のみ `parsed.data` を renderer に渡す (main.ts)
//   - drift 検出は `__tests__/sample-profile.test.ts` で runtime parse によって担保
//
// Privacy:
//   - 名前: 山田 太郎 (架空)
//   - 会社: 株式会社サンプル (架空)
//   - メール: example.com ドメイン (RFC 2606 reserved)
//   - 電話: 090-0000-0000 (実電話番号ではない、桁数のみ合致)
//   - 住所: サンプル区サンプル町 (架空)
//   - 大学: サンプル大学 (架空)
//   - 資格名は公開資格 (IPA 基本情報) を使うが acquiredDate は架空
//   - profilePhoto は **含めない** (sandbox / dataUri / relativePath 論点を持ち込まない、skeleton scope)

export const sampleProfileInput = {
  schemaVersion: 1,
  basics: {
    name: { family: '山田', given: '太郎' },
    nameKana: { family: 'ヤマダ', given: 'タロウ' },
    birthDate: '1993-04-01',
    email: 'taro.yamada@example.com',
    phone: '090-0000-0000',
    address: {
      postalCode: '100-0001',
      prefecture: '東京都',
      cityAndRest: 'サンプル区サンプル町 1-2-3',
    },
    addressKana: 'トウキョウト サンプルク サンプルチョウ',
    summary: '志望の動機:\n御社の事業に共感し、自身の経験を活かして貢献したいと考え志望しました。',
    personalRequest: '勤務地は都内希望、リモートワークも可。',
  },
  workExperiences: [
    {
      companyName: '株式会社サンプル',
      position: 'ソフトウェアエンジニア',
      employmentType: '正社員',
      period: { startDate: '2020-04', isCurrent: true },
      summary: 'Web application 開発に従事',
      responsibilities: ['設計', '実装', 'レビュー'],
      achievements: ['性能改善で応答時間を 40% 短縮'],
    },
  ],
  educationHistory: [
    {
      institutionName: 'サンプル大学',
      faculty: '情報工学部',
      department: '情報科学科',
      startDate: '2016-04',
      endDate: '2020-03',
      status: '卒業',
    },
  ],
  skills: [
    { name: 'TypeScript', category: 'プログラミング言語', level: '上級' },
    { name: 'HTML / CSS', category: 'マークアップ', level: '中級' },
    { name: 'Node.js', category: 'ランタイム', level: '中級' },
  ],
  certifications: [
    {
      name: '基本情報技術者試験',
      issuer: 'IPA',
      acquiredDate: '2018-06',
    },
  ],
  // historyRows / certificationRows は WYSIWYG エディタ (PC 版) で
  // 直接編集可能にするための raw 3-column 表現。educationHistory /
  // workExperiences / certifications と内容は同じだが、これらは構造化された
  // form 入力 (SP 版) のため残し、表ベースの表示・編集には historyRows /
  // certificationRows を source of truth として使う。
  // 内容が一致するよう sample-profile.test.ts で同期チェックする。
  historyRows: [
    { content: '学歴' },
    { year: '2016', month: '4', content: 'サンプル大学 情報工学部 情報科学科 入学' },
    { year: '2020', month: '3', content: 'サンプル大学 情報工学部 情報科学科 卒業' },
    { content: '職歴' },
    { year: '2020', month: '4', content: '株式会社サンプル 入社(正社員 / ソフトウェアエンジニア)' },
    { content: '現在に至る' },
  ],
  certificationRows: [{ year: '2018', month: '6', content: '基本情報技術者試験 (IPA)' }],
  projects: [
    {
      name: 'サンプルプロジェクト',
      organizationName: '株式会社サンプル',
      role: '設計・実装担当',
      startDate: '2021-01',
      endDate: '2021-12',
      summary: '社内向けツールの開発',
      responsibilities: ['要件整理', '実装'],
      achievements: ['手作業を自動化し作業時間を月 10 時間削減'],
      technologies: ['TypeScript', 'Node.js'],
    },
  ],
};

// 新規作成 (ホーム画面の「新規作成」) の初期内容。
//
// 設計判断: 氏名・住所等のサンプル文字列は入れない (空)。
//   - ホーム画面導入の目的が「正体不明のサンプル履歴書をいきなり出さない」ことなので、
//     新規作成でサンプル文字列が入ると本末転倒 (消す手間 / 誤提出リスク)
//   - 記入位置の案内は input の placeholder や WYSIWYG セルのガイド表示で行う
//   - schemaVersion のみ必須。basics は空、配列 section は省略 (renderer が
//     公式罫線の固定行数を空セルで描く)
export const emptyProfileInput = {
  schemaVersion: 1,
  basics: {},
};
