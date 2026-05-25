import { safeParse } from 'valibot';
import { describe, expect, it } from 'vitest';

import { safeParseCareerProfile } from '../domain/operations';
import { profilePhotoSchema } from '../domain/profile-photo';

const wrapProfilePhoto = (profilePhoto: unknown) =>
  safeParseCareerProfile({
    schemaVersion: 1,
    basics: { profilePhoto },
  });

describe('profilePhotoSchema (internal)', () => {
  describe('全フィールド省略 / 基本構造', () => {
    it('全フィールド省略を受理する (draft tolerance)', () => {
      expect(safeParse(profilePhotoSchema, {}).success).toBe(true);
    });

    it('altText のみを受理する', () => {
      expect(safeParse(profilePhotoSchema, { altText: '証明写真' }).success).toBe(true);
    });
  });

  describe('dataUri source', () => {
    it('image/jpeg の dataUri を受理する', () => {
      expect(
        safeParse(profilePhotoSchema, {
          source: { kind: 'dataUri', dataUri: 'data:image/jpeg;base64,XXXXX' },
        }).success,
      ).toBe(true);
    });

    it('image/png の dataUri を受理する', () => {
      expect(
        safeParse(profilePhotoSchema, {
          source: { kind: 'dataUri', dataUri: 'data:image/png;base64,XXXXX' },
        }).success,
      ).toBe(true);
    });

    it('payload 1 文字でも受理する', () => {
      expect(
        safeParse(profilePhotoSchema, {
          source: { kind: 'dataUri', dataUri: 'data:image/jpeg;base64,X' },
        }).success,
      ).toBe(true);
    });

    it.each([
      'data:image/jpeg;base64,',
      'data:image/png;base64,',
    ])('payload が空 (%s) なら拒否する', (dataUri) => {
      expect(safeParse(profilePhotoSchema, { source: { kind: 'dataUri', dataUri } }).success).toBe(
        false,
      );
    });

    it('image/webp prefix は拒否する', () => {
      expect(
        safeParse(profilePhotoSchema, {
          source: { kind: 'dataUri', dataUri: 'data:image/webp;base64,XXXXX' },
        }).success,
      ).toBe(false);
    });

    it('空文字の dataUri を拒否する', () => {
      expect(
        safeParse(profilePhotoSchema, { source: { kind: 'dataUri', dataUri: '' } }).success,
      ).toBe(false);
    });

    it('空白のみの dataUri を拒否する', () => {
      expect(
        safeParse(profilePhotoSchema, { source: { kind: 'dataUri', dataUri: '   ' } }).success,
      ).toBe(false);
    });

    it('prefix のない値を拒否する', () => {
      expect(
        safeParse(profilePhotoSchema, { source: { kind: 'dataUri', dataUri: 'XXXXX' } }).success,
      ).toBe(false);
    });

    it('5,000,001 文字を拒否する', () => {
      const overlong = `data:image/jpeg;base64,${'X'.repeat(5_000_000)}`;
      expect(
        safeParse(profilePhotoSchema, { source: { kind: 'dataUri', dataUri: overlong } }).success,
      ).toBe(false);
    });

    it('mediaType: image/jpeg を受理する', () => {
      expect(
        safeParse(profilePhotoSchema, {
          source: { kind: 'dataUri', dataUri: 'data:image/jpeg;base64,X', mediaType: 'image/jpeg' },
        }).success,
      ).toBe(true);
    });

    it('mediaType: image/webp を拒否する (literal union 違反)', () => {
      expect(
        safeParse(profilePhotoSchema, {
          source: { kind: 'dataUri', dataUri: 'data:image/jpeg;base64,X', mediaType: 'image/webp' },
        }).success,
      ).toBe(false);
    });
  });

  describe('relativePath source - 正常系', () => {
    it.each([
      'photos/profile.jpg',
      './profile.jpg',
      'subdir/photo.png',
    ])('%s を受理する', (path) => {
      expect(
        safeParse(profilePhotoSchema, { source: { kind: 'relativePath', path } }).success,
      ).toBe(true);
    });
  });

  describe('relativePath source - 異常系', () => {
    it('空文字を拒否する', () => {
      expect(
        safeParse(profilePhotoSchema, { source: { kind: 'relativePath', path: '' } }).success,
      ).toBe(false);
    });

    it('空白のみを拒否する', () => {
      expect(
        safeParse(profilePhotoSchema, { source: { kind: 'relativePath', path: '   ' } }).success,
      ).toBe(false);
    });

    it('1001 文字を拒否する', () => {
      expect(
        safeParse(profilePhotoSchema, {
          source: { kind: 'relativePath', path: 'x'.repeat(1001) },
        }).success,
      ).toBe(false);
    });

    it.each([
      ['POSIX 絶対パス', '/Users/foo/photo.jpg'],
      ['Windows ドライブ (バックスラッシュ)', 'C:\\photos\\me.jpg'],
      ['Windows ドライブ (スラッシュ)', 'D:/photos/me.jpg'],
      ['Windows root', '\\Users\\foo\\photo.jpg'],
      ['UNC path', '\\\\server\\share\\photo.jpg'],
      ['file:// URL', 'file:///Users/foo/photo.jpg'],
    ])('絶対パス系 (%s) を拒否する', (_label, path) => {
      expect(
        safeParse(profilePhotoSchema, { source: { kind: 'relativePath', path } }).success,
      ).toBe(false);
    });

    it.each([
      ['http URL', 'http://example.com/photo.jpg'],
      ['https URL', 'https://example.com/photo.jpg'],
      ['ftp URL', 'ftp://example.com/photo.jpg'],
      ['data URI を relativePath に渡す', 'data:image/jpeg;base64,XXX'],
    ])('外部 URL 系 (%s) を拒否する', (_label, path) => {
      expect(
        safeParse(profilePhotoSchema, { source: { kind: 'relativePath', path } }).success,
      ).toBe(false);
    });

    it.each([
      ['単独 ..', '..'],
      ['先頭 traversal', '../photos/photo.jpg'],
      ['中間 traversal', 'photos/../photo.jpg'],
      ['末尾 traversal', 'photos/..'],
      ['バックスラッシュ traversal', '..\\photos\\me.jpg'],
    ])('parent traversal (%s) を拒否する', (_label, path) => {
      expect(
        safeParse(profilePhotoSchema, { source: { kind: 'relativePath', path } }).success,
      ).toBe(false);
    });
  });

  describe('source 全体', () => {
    it('source: {} (kind なし) を拒否する', () => {
      expect(safeParse(profilePhotoSchema, { source: {} }).success).toBe(false);
    });

    it('未知の kind を拒否する', () => {
      expect(safeParse(profilePhotoSchema, { source: { kind: 'unknown' } }).success).toBe(false);
    });

    it('kind: dataUri で dataUri フィールド無しなら拒否する', () => {
      expect(safeParse(profilePhotoSchema, { source: { kind: 'dataUri' } }).success).toBe(false);
    });

    it('kind: relativePath で path フィールド無しなら拒否する', () => {
      expect(safeParse(profilePhotoSchema, { source: { kind: 'relativePath' } }).success).toBe(
        false,
      );
    });
  });

  describe('altText', () => {
    it('通常テキストを受理する', () => {
      expect(safeParse(profilePhotoSchema, { altText: '山田太郎の証明写真' }).success).toBe(true);
    });

    it('空文字を拒否する', () => {
      expect(safeParse(profilePhotoSchema, { altText: '' }).success).toBe(false);
    });

    it('空白のみを拒否する', () => {
      expect(safeParse(profilePhotoSchema, { altText: '   ' }).success).toBe(false);
    });

    it('201 文字を拒否する', () => {
      expect(safeParse(profilePhotoSchema, { altText: 'あ'.repeat(201) }).success).toBe(false);
    });
  });

  describe('transform.zoom', () => {
    it('未指定 (transform 自体を省略) を受理する', () => {
      expect(safeParse(profilePhotoSchema, {}).success).toBe(true);
    });

    it('transform: {} (zoom 未指定) を受理する', () => {
      expect(safeParse(profilePhotoSchema, { transform: {} }).success).toBe(true);
    });

    it('zoom = 1 (cover 等倍) を受理する', () => {
      expect(safeParse(profilePhotoSchema, { transform: { zoom: 1 } }).success).toBe(true);
    });

    it('zoom = 1.5 を受理する', () => {
      expect(safeParse(profilePhotoSchema, { transform: { zoom: 1.5 } }).success).toBe(true);
    });

    it('zoom = 3 (上限) を受理する', () => {
      expect(safeParse(profilePhotoSchema, { transform: { zoom: 3 } }).success).toBe(true);
    });

    it('zoom < 1 を拒否する (cover 以下にすると白余白が出る)', () => {
      expect(safeParse(profilePhotoSchema, { transform: { zoom: 0.5 } }).success).toBe(false);
    });

    it('zoom > 3 を拒否する (拡大しすぎは画質劣化)', () => {
      expect(safeParse(profilePhotoSchema, { transform: { zoom: 3.5 } }).success).toBe(false);
    });

    it('zoom が string を拒否する', () => {
      expect(
        safeParse(profilePhotoSchema, { transform: { zoom: '1.5' as unknown as number } }).success,
      ).toBe(false);
    });
  });

  describe('transform.offsetX / offsetY', () => {
    it('offsetX = 50 / offsetY = 50 (中央) を受理する', () => {
      expect(
        safeParse(profilePhotoSchema, { transform: { offsetX: 50, offsetY: 50 } }).success,
      ).toBe(true);
    });

    it('offsetX = 0 (左端) を受理する', () => {
      expect(safeParse(profilePhotoSchema, { transform: { offsetX: 0 } }).success).toBe(true);
    });

    it('offsetY = 100 (下端) を受理する', () => {
      expect(safeParse(profilePhotoSchema, { transform: { offsetY: 100 } }).success).toBe(true);
    });

    it('zoom + offset を組み合わせて受理する', () => {
      expect(
        safeParse(profilePhotoSchema, { transform: { zoom: 2, offsetX: 30, offsetY: 70 } }).success,
      ).toBe(true);
    });

    it('offsetX < 0 を拒否する', () => {
      expect(safeParse(profilePhotoSchema, { transform: { offsetX: -1 } }).success).toBe(false);
    });

    it('offsetY > 100 を拒否する', () => {
      expect(safeParse(profilePhotoSchema, { transform: { offsetY: 101 } }).success).toBe(false);
    });

    it('offsetX が string を拒否する', () => {
      expect(
        safeParse(profilePhotoSchema, { transform: { offsetX: '50' as unknown as number } })
          .success,
      ).toBe(false);
    });
  });
});

describe('ProfilePhoto via safeParseCareerProfile (public API)', () => {
  it('dataUri を含む完全な ProfilePhoto を受理する', () => {
    const result = safeParseCareerProfile({
      schemaVersion: 1,
      basics: {
        profilePhoto: {
          source: {
            kind: 'dataUri',
            dataUri: 'data:image/jpeg;base64,XXXXX',
            mediaType: 'image/jpeg',
          },
          altText: '山田太郎の証明写真',
        },
      },
    });
    expect(result.success).toBe(true);
  });

  it('relativePath を含む完全な ProfilePhoto を受理する', () => {
    const result = safeParseCareerProfile({
      schemaVersion: 1,
      basics: {
        profilePhoto: {
          source: {
            kind: 'relativePath',
            path: 'photos/profile.jpg',
            mediaType: 'image/jpeg',
          },
          altText: '山田太郎の証明写真',
        },
      },
    });
    expect(result.success).toBe(true);
  });

  it('basics.profilePhoto: {} (draft) を受理する', () => {
    const result = safeParseCareerProfile({
      schemaVersion: 1,
      basics: { profilePhoto: {} },
    });
    expect(result.success).toBe(true);
  });

  it('不正な dataUri で basics.profilePhoto.source.dataUri の dot path を含む', () => {
    const result = wrapProfilePhoto({ source: { kind: 'dataUri', dataUri: '' } });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.issues.find((i) => i.path === 'basics.profilePhoto.source.dataUri');
      expect(issue).toBeDefined();
    }
  });

  it('絶対パスで basics.profilePhoto.source.path の dot path を含む', () => {
    const result = wrapProfilePhoto({
      source: { kind: 'relativePath', path: '/Users/foo/photo.jpg' },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.issues.find((i) => i.path === 'basics.profilePhoto.source.path');
      expect(issue).toBeDefined();
    }
  });

  it('不正な altText で basics.profilePhoto.altText の dot path を含む', () => {
    const result = wrapProfilePhoto({ altText: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.issues.find((i) => i.path === 'basics.profilePhoto.altText');
      expect(issue).toBeDefined();
    }
  });
});
