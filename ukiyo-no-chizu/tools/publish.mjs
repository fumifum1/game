// 公開用フォルダ(game/ukiyo-no-chizu)へコピーする。開発用の見本ページ(proposals)などは入れない
// 使い方: node tools/publish.mjs [コピー先]   ※コピーのあと、game フォルダで commit・push する
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dest = path.resolve(process.argv[2] || path.join(root, '../../game/ukiyo-no-chizu'));
const SKIP = new Set(['proposals', '.claude', '.git', 'node_modules', 'android-app', 'apk']);

const version = fs.readFileSync(path.join(root, 'js/version.js'), 'utf8').match(/APP_VERSION = '([^']+)'/)[1];
let count = 0;
(function copy(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const a = path.join(from, e.name), b = path.join(to, e.name);
    if (e.isDirectory()) copy(a, b);
    else { fs.copyFileSync(a, b); count++; }
  }
})(root, dest);
console.log(`浮世ノ地図 v${version} を ${dest} にコピーしました（${count}ファイル）`);
console.log('バージョンを上げ忘れていないか js/version.js を確認してから、game フォルダで commit・push してください。');
