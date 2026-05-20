// DocumentKind は renderer が扱う履歴書系ドキュメントの種類を表す。
// 現時点では日本式の rirekisho / shokumukeirekisho の 2 種に限定する。
// 将来 Western résumé / CV 等への対応が必要になった時点で union を拡張する。

export type DocumentKind = 'rirekisho' | 'shokumukeirekisho';
