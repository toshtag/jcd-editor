import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createPlaywrightPdfAdapter } from '@jcd-editor/pdf';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { renderCommand } from '../render-command';

// 本 test は実際の Playwright (Chromium) を起動して PDF を生成する。
// CI では `pnpm --filter @jcd-editor/pdf exec playwright install chromium` で
// Chromium が install 済み。ローカルで一度実行する場合も同コマンドが必要。

const FIXTURES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');

describe('renderCommand', () => {
  let tmpDir: string;
  const pdf = createPlaywrightPdfAdapter();

  beforeAll(async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), 'jcd-cli-test-'));
  });

  afterAll(async () => {
    if (tmpDir !== undefined) {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('short-profile.json を rirekisho として PDF 化し、output file が valid PDF として書き出される', async () => {
    const inputPath = path.join(FIXTURES_DIR, 'short-profile.json');
    const outputPath = path.join(tmpDir, 'short-profile.pdf');

    const result = await renderCommand({
      inputPath,
      outputPath,
      kind: 'rirekisho',
      pdf,
    });

    expect(result.documentKind).toBe('rirekisho');
    expect(result.byteCount).toBeGreaterThan(1000);

    // output file が存在し、PDF magic header で始まる
    const fileStat = await stat(outputPath);
    expect(fileStat.isFile()).toBe(true);
    expect(fileStat.size).toBe(result.byteCount);

    const first5Bytes = await readFile(outputPath).then((buf) => buf.subarray(0, 5).toString());
    expect(first5Bytes).toBe('%PDF-');
  }, 60_000);

  it('存在しない input path: INPUT_READ_FAILED で RenderCommandError', async () => {
    await expect(
      renderCommand({
        inputPath: path.join(tmpDir, 'does-not-exist.json'),
        outputPath: path.join(tmpDir, 'out.pdf'),
        kind: 'rirekisho',
        pdf,
      }),
    ).rejects.toMatchObject({
      name: 'RenderCommandError',
      code: 'INPUT_READ_FAILED',
    });
  });

  it('malformed JSON: INVALID_JSON で RenderCommandError', async () => {
    // Biome formatter が parse error を出すため fixture file 化せず、test 内で
    // tmp file に書き出す。
    const malformedPath = path.join(tmpDir, 'malformed.json');
    await writeFile(malformedPath, '{ this is not valid json\n');

    await expect(
      renderCommand({
        inputPath: malformedPath,
        outputPath: path.join(tmpDir, 'out.pdf'),
        kind: 'rirekisho',
        pdf,
      }),
    ).rejects.toMatchObject({
      name: 'RenderCommandError',
      code: 'INVALID_JSON',
    });
  });

  it('schema 不一致 (invalid birthDate): SCHEMA_MISMATCH で RenderCommandError', async () => {
    await expect(
      renderCommand({
        inputPath: path.join(FIXTURES_DIR, 'invalid-schema-profile.json'),
        outputPath: path.join(tmpDir, 'out.pdf'),
        kind: 'rirekisho',
        pdf,
      }),
    ).rejects.toMatchObject({
      name: 'RenderCommandError',
      code: 'SCHEMA_MISMATCH',
    });
  });

  it('long-profile.json を rirekisho として PDF 化: 全 section を含む PDF が生成される', async () => {
    const inputPath = path.join(FIXTURES_DIR, 'long-profile.json');
    const outputPath = path.join(tmpDir, 'long-profile-rirekisho.pdf');

    const result = await renderCommand({
      inputPath,
      outputPath,
      kind: 'rirekisho',
      pdf,
    });

    expect(result.documentKind).toBe('rirekisho');
    // short-profile より大きいことを確認 (全 section が描画されている signal)
    expect(result.byteCount).toBeGreaterThan(5000);

    const first5Bytes = await readFile(outputPath).then((buf) => buf.subarray(0, 5).toString());
    expect(first5Bytes).toBe('%PDF-');
  }, 60_000);

  it('long-profile.json を shokumukeirekisho として PDF 化: 異なる template で出力される', async () => {
    const inputPath = path.join(FIXTURES_DIR, 'long-profile.json');
    const outputPath = path.join(tmpDir, 'long-profile-shokumukeirekisho.pdf');

    const result = await renderCommand({
      inputPath,
      outputPath,
      kind: 'shokumukeirekisho',
      pdf,
    });

    expect(result.documentKind).toBe('shokumukeirekisho');
    expect(result.byteCount).toBeGreaterThan(5000);

    const first5Bytes = await readFile(outputPath).then((buf) => buf.subarray(0, 5).toString());
    expect(first5Bytes).toBe('%PDF-');
  }, 60_000);
});
