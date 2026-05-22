// CLI の render command 本体 (pure-ish function、bin entry とは分離)。
//
// 役割:
//   - JSON file path を受け取り、内容を CareerProfile として検証する
//   - renderer で履歴書 / 職務経歴書の HTML を生成する
//   - PdfPort (Playwright adapter) で PDF を生成し、output path に書き出す
//
// 設計判断:
//
// - **PdfPort を引数で受け取る (DI)**: test では mock を渡せる、本番では
//   createPlaywrightPdfAdapter() を渡す。bin entry 側で adapter を注入する
// - **fs / path も最小依存**: Node built-in のみ使う
// - **errors は throw**: bin entry で catch して process.exit に変換する。
//   関数自体は process.exit を呼ばない (test 容易性)
// - **kind は明示的に受け取る**: default を関数に持たせない。CLI 側で
//   default を決める
// - **戻り値**: 書き出した PDF bytes 数 (CLI で進捗表示できるように)

import { readFile, writeFile } from 'node:fs/promises';

import { safeParseCareerProfile } from '@jcd-editor/core';
import {
  createDefaultTemplateRegistry,
  renderDocument,
  type DocumentKind,
} from '@jcd-editor/renderer';
import type { PdfPort } from '@jcd-editor/pdf';

export type RenderCommandInput = {
  inputPath: string;
  outputPath: string;
  kind: DocumentKind;
  pdf: PdfPort;
};

export type RenderCommandResult = {
  byteCount: number;
  documentKind: DocumentKind;
};

export class RenderCommandError extends Error {
  public readonly code:
    | 'INPUT_READ_FAILED'
    | 'INVALID_JSON'
    | 'SCHEMA_MISMATCH'
    | 'PDF_RENDER_FAILED'
    | 'OUTPUT_WRITE_FAILED';

  constructor(
    message: string,
    code:
      | 'INPUT_READ_FAILED'
      | 'INVALID_JSON'
      | 'SCHEMA_MISMATCH'
      | 'PDF_RENDER_FAILED'
      | 'OUTPUT_WRITE_FAILED',
  ) {
    super(message);
    this.name = 'RenderCommandError';
    this.code = code;
  }
}

export const renderCommand = async (input: RenderCommandInput): Promise<RenderCommandResult> => {
  let raw: string;
  try {
    raw = await readFile(input.inputPath, 'utf8');
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new RenderCommandError(
      `入力ファイルを読み込めませんでした (${input.inputPath}): ${detail}`,
      'INPUT_READ_FAILED',
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new RenderCommandError(
      `入力ファイルは valid な JSON ではありません: ${detail}`,
      'INVALID_JSON',
    );
  }

  const validated = safeParseCareerProfile(parsed);
  if (!validated.success) {
    const issuesText = validated.issues
      .map((issue) => `  - ${issue.path}: ${issue.message}`)
      .join('\n');
    throw new RenderCommandError(
      `入力 profile が schema を満たしません:\n${issuesText}`,
      'SCHEMA_MISMATCH',
    );
  }

  const registry = createDefaultTemplateRegistry();
  const rendered = renderDocument({ careerProfile: validated.data, kind: input.kind }, registry);

  let pdfResult: Awaited<ReturnType<PdfPort['renderPdf']>>;
  try {
    pdfResult = await input.pdf.renderPdf(rendered);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new RenderCommandError(`PDF 生成に失敗しました: ${detail}`, 'PDF_RENDER_FAILED');
  }

  try {
    await writeFile(input.outputPath, pdfResult.bytes);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new RenderCommandError(
      `出力ファイルを書き込めませんでした (${input.outputPath}): ${detail}`,
      'OUTPUT_WRITE_FAILED',
    );
  }

  return {
    byteCount: pdfResult.bytes.length,
    documentKind: pdfResult.metadata.documentKind,
  };
};
