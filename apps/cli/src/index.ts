// jcd-editor CLI bin entry。
//
// 起動方法 (Node 22 LTS):
//   pnpm --filter @jcd-editor/cli start render <input.json> <output.pdf> [--kind rirekisho|shokumukeirekisho]
//
// もしくは直接:
//   node --experimental-strip-types --no-warnings=ExperimentalWarning apps/cli/src/index.ts render <input.json> <output.pdf>
//
// 設計判断:
//
// - **argv parsing は自前**: yargs / commander 等の dependency を持ち込まない
//   (YAGNI、command が 1 つしかない現状)
// - **command は render のみ**: 将来 validate / inspect / list-templates 等を
//   追加する余地は残す
// - **kind option の default は rirekisho**: 履歴書を一次ユースケースとする
// - **error は stderr、success は stdout**: shell pipeline 互換
// - **process.exit code**:
//   - 0: success
//   - 1: usage error (argv 不足、unknown option)
//   - 2: input file error (read 失敗、JSON parse 失敗、schema 不一致)
//   - 3: PDF 生成 / 書き出し失敗

import { createPlaywrightPdfAdapter } from '@jcd-editor/pdf';
import type { DocumentKind } from '@jcd-editor/renderer';

import { renderCommand, RenderCommandError } from './render-command';

type ParsedRenderArgs = {
  inputPath: string;
  outputPath: string;
  kind: DocumentKind;
};

const USAGE = `Usage:
  jcd-editor-cli render <input.json> <output.pdf> [--kind rirekisho|shokumukeirekisho]

Options:
  --kind <kind>   出力する書類の種別 (default: rirekisho)
  --help, -h      この usage を表示する
`;

const printUsage = (): void => {
  process.stdout.write(USAGE);
};

const parseRenderArgs = (args: readonly string[]): ParsedRenderArgs => {
  let kind: DocumentKind = 'rirekisho';
  const positional: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--kind') {
      const next = args[i + 1];
      if (next === undefined) {
        throw new Error('--kind option requires a value');
      }
      if (next !== 'rirekisho' && next !== 'shokumukeirekisho') {
        throw new Error(`Unknown kind: ${next}. Allowed values: rirekisho | shokumukeirekisho`);
      }
      kind = next;
      i++;
    } else if (arg?.startsWith('--')) {
      throw new Error(`Unknown option: ${arg}`);
    } else if (arg !== undefined) {
      positional.push(arg);
    }
  }

  if (positional.length !== 2) {
    throw new Error(
      `render command requires exactly 2 positional arguments (input.json, output.pdf), got ${positional.length}`,
    );
  }

  const [inputPath, outputPath] = positional;
  if (inputPath === undefined || outputPath === undefined) {
    throw new Error('internal: positional args lost');
  }
  return { inputPath, outputPath, kind };
};

const exitCodeForError = (error: unknown): number => {
  if (error instanceof RenderCommandError) {
    switch (error.code) {
      case 'INPUT_READ_FAILED':
      case 'INVALID_JSON':
      case 'SCHEMA_MISMATCH':
        return 2;
      case 'PDF_RENDER_FAILED':
      case 'OUTPUT_WRITE_FAILED':
        return 3;
    }
  }
  return 1;
};

const main = async (argv: readonly string[]): Promise<number> => {
  // argv[0] = node binary, argv[1] = script path、それ以降が実引数
  const args = argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    printUsage();
    return args.length === 0 ? 1 : 0;
  }

  const command = args[0];
  const rest = args.slice(1);

  if (command !== 'render') {
    process.stderr.write(`Unknown command: ${command ?? '(none)'}\n\n${USAGE}`);
    return 1;
  }

  let parsed: ParsedRenderArgs;
  try {
    parsed = parseRenderArgs(rest);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Error: ${detail}\n\n${USAGE}`);
    return 1;
  }

  const pdf = createPlaywrightPdfAdapter();
  try {
    const result = await renderCommand({ ...parsed, pdf });
    process.stdout.write(
      `Rendered ${result.documentKind} → ${parsed.outputPath} (${result.byteCount} bytes)\n`,
    );
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Error: ${message}\n`);
    return exitCodeForError(error);
  }
};

main(process.argv)
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Fatal: ${message}\n`);
    process.exitCode = 1;
  });
