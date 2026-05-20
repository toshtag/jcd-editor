import { describe, expect, it } from 'vitest';

import {
  renderItemList,
  renderListItem,
  renderSection,
  renderTextList,
} from '../_internal/html-renderer';

describe('renderSection', () => {
  it('正常: bodyHtml がある場合に section markup を返す', () => {
    const result = renderSection({
      baseClass: 'jcd-rirekisho',
      variant: 'skills',
      heading: 'スキル',
      bodyHtml: '<ul><li>TypeScript</li></ul>',
    });
    expect(result).toBe(
      '<section class="jcd-rirekisho__section jcd-rirekisho__section--skills"><h2>スキル</h2><ul><li>TypeScript</li></ul></section>',
    );
  });

  it('bodyHtml === "" なら "" を返す (early return)', () => {
    const result = renderSection({
      baseClass: 'jcd-rirekisho',
      variant: 'skills',
      heading: 'スキル',
      bodyHtml: '',
    });
    expect(result).toBe('');
  });

  it('固定 Japanese phrase の heading は escape されても同じ文字列が出る (出力不変)', () => {
    const result = renderSection({
      baseClass: 'jcd-rirekisho',
      variant: 'history',
      heading: '学歴・職歴',
      bodyHtml: '<table></table>',
    });
    expect(result).toContain('<h2>学歴・職歴</h2>');
  });

  it('heading に escape 必須文字 (& / < / ") が含まれると escape される (defensive)', () => {
    const result = renderSection({
      baseClass: 'jcd-rirekisho',
      variant: 'x',
      heading: 'A & <B> "C"',
      bodyHtml: '<div></div>',
    });
    expect(result).toContain('<h2>A &amp; &lt;B&gt; &quot;C&quot;</h2>');
  });

  it('baseClass / variant が class 属性に正しく展開される', () => {
    const result = renderSection({
      baseClass: 'jcd-shokumukeirekisho',
      variant: 'work',
      heading: '職務経歴',
      bodyHtml: '<ul></ul>',
    });
    expect(result).toContain(
      '<section class="jcd-shokumukeirekisho__section jcd-shokumukeirekisho__section--work">',
    );
  });
});

describe('renderItemList', () => {
  it('正常: 非空 items を <ul> でラップして連結する', () => {
    const result = renderItemList(['<li>a</li>', '<li>b</li>']);
    expect(result).toBe('<ul><li>a</li><li>b</li></ul>');
  });

  it('空配列なら "" を返す', () => {
    expect(renderItemList([])).toBe('');
  });

  it('全 item が空文字列なら "" を返す (filter)', () => {
    expect(renderItemList(['', ''])).toBe('');
  });

  it('一部 item が空文字列なら filter、残りを join', () => {
    const result = renderItemList(['<li>a</li>', '', '<li>b</li>']);
    expect(result).toBe('<ul><li>a</li><li>b</li></ul>');
  });

  it('items 内の HTML fragment を再 escape しない (already-safe HTML として扱う)', () => {
    // caller が既に escape 済み safe HTML を渡す前提
    const result = renderItemList(['<li>株式会社サンプル &amp; co.</li>']);
    expect(result).toBe('<ul><li>株式会社サンプル &amp; co.</li></ul>');
    // 再 escape されていない (&amp; が &amp;amp; になっていない)
    expect(result).not.toContain('&amp;amp;');
  });
});

describe('renderListItem', () => {
  it('正常: head と detail を連結して <li> を返す', () => {
    const result = renderListItem(
      ['2020年4月', '株式会社サンプル 入社'],
      ['<div class="x__detail">概要</div>'],
    );
    expect(result).toBe(
      '<li>2020年4月 株式会社サンプル 入社<div class="x__detail">概要</div></li>',
    );
  });

  it('head のみ (detail 空) の場合', () => {
    const result = renderListItem(['A', 'B'], []);
    expect(result).toBe('<li>A B</li>');
  });

  it('detail のみ (head 空) の場合', () => {
    const result = renderListItem([], ['<div>x</div>']);
    expect(result).toBe('<li><div>x</div></li>');
  });

  it('両方空 → "" を返す', () => {
    expect(renderListItem([], [])).toBe('');
  });

  it('head は半角スペースで結合、detail は区切りなしで結合', () => {
    const result = renderListItem(['a', 'b', 'c'], ['<x>', '<y>']);
    expect(result).toBe('<li>a b c<x><y></li>');
  });

  it('helper 内で head / detail を filter しない (caller の filter を信頼)', () => {
    // helper が filter したら ['', 'foo'].join(' ') === ' foo' が
    // 'foo' になってしまう。caller は通常空要素を入れないが、helper が
    // 出力を勝手に変えないことを構造的に保証する。
    const result = renderListItem(['', 'foo'], []);
    expect(result).toBe('<li> foo</li>'); // head 先頭の空要素により leading space が残る
  });
});

describe('renderTextList', () => {
  it('正常: raw items を <ul><li>escaped</li>...</ul> に変換 (caller は再 escape しない)', () => {
    const result = renderTextList(['設計', '実装', 'レビュー']);
    expect(result).toBe('<ul><li>設計</li><li>実装</li><li>レビュー</li></ul>');
  });

  it('undefined なら "" を返す', () => {
    expect(renderTextList(undefined)).toBe('');
  });

  it('空配列なら "" を返す', () => {
    expect(renderTextList([])).toBe('');
  });

  it('全要素が空文字列なら "" を返す (isNonEmpty で filter)', () => {
    expect(renderTextList(['', ''])).toBe('');
  });

  it('一部 item が空文字列なら filter、残りを escape して join', () => {
    expect(renderTextList(['a', '', 'b'])).toBe('<ul><li>a</li><li>b</li></ul>');
  });

  it('escapeHtml が適用される (<script> が &lt;script&gt; に)', () => {
    const result = renderTextList(['<script>alert("x")</script>']);
    expect(result).toContain('&lt;script&gt;');
    expect(result).toContain('&lt;/script&gt;');
    expect(result).not.toContain('<script>');
  });

  it('& / quote / 日本語文字を含む item を正しく escape する', () => {
    const result = renderTextList(['A & B', `"quoted"`, '日本語テキスト']);
    expect(result).toContain('A &amp; B');
    expect(result).toContain('&quot;quoted&quot;');
    expect(result).toContain('日本語テキスト');
  });
});
