import { describe, expect, it } from 'vitest';

import { StorageError, type StorageErrorCode } from '../errors';

describe('StorageError', () => {
  it('name が "StorageError"', () => {
    const error = new StorageError('message', 'PROFILE_NOT_FOUND');
    expect(error.name).toBe('StorageError');
  });

  it('message プロパティを保持する', () => {
    const error = new StorageError('something happened', 'PROFILE_NOT_FOUND');
    expect(error.message).toBe('something happened');
  });

  it('code プロパティを保持する', () => {
    const error = new StorageError('message', 'PROFILE_NOT_FOUND');
    expect(error.code).toBe('PROFILE_NOT_FOUND');
  });

  it('instanceof Error が true', () => {
    const error = new StorageError('message', 'PROFILE_NOT_FOUND');
    expect(error).toBeInstanceOf(Error);
  });

  it('instanceof StorageError が true', () => {
    const error = new StorageError('message', 'PROFILE_NOT_FOUND');
    expect(error).toBeInstanceOf(StorageError);
  });

  it('throw / catch で instanceof が安定する', () => {
    try {
      throw new StorageError('thrown', 'PROFILE_NOT_FOUND');
    } catch (e) {
      expect(e).toBeInstanceOf(StorageError);
      expect(e).toBeInstanceOf(Error);
      if (e instanceof StorageError) {
        expect(e.code).toBe('PROFILE_NOT_FOUND');
      }
    }
  });

  it('現状すべての StorageErrorCode を受け付ける', () => {
    // 本 PR では PROFILE_NOT_FOUND 1 つのみ。adapter PR で code が増えた時、
    // テストもここに追加する (例: STORAGE_OPERATION_FAILED / SCHEMA_VERSION_MISMATCH 等)。
    const codes: StorageErrorCode[] = ['PROFILE_NOT_FOUND'];
    for (const code of codes) {
      const error = new StorageError(`message for ${code}`, code);
      expect(error.code).toBe(code);
    }
  });
});
