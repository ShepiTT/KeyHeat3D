'use strict';
/**
 * 本地存储：SQLite（sql.js，纯 WebAssembly，不需要编译原生模块）。
 * 表 counts(hour, key, count)：hour 是该小时起点的 Unix 秒，按「小时 × 按键」累计次数。
 * 只保存次数，不保存输入内容、按键顺序或时间戳序列。
 */
const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const HOUR_MS = 3600 * 1000;
const COUNT_COLUMNS = `(
  hour  INTEGER NOT NULL,
  key   TEXT    NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (hour, key)
) WITHOUT ROWID`;

class Store {
  async init(dir) {
    fs.mkdirSync(dir, { recursive: true });
    this.file = path.join(dir, 'keyheat.db');
    // sql.js 的入口就在 dist/ 下，从入口目录找 wasm，避免 package.json 的 exports 限制子路径
    const wasmPath = path.join(path.dirname(require.resolve('sql.js')), 'sql-wasm.wasm');
    const wasmBinary = fs.readFileSync(wasmPath);
    const SQL = await initSqlJs({ wasmBinary });
    this.db = fs.existsSync(this.file)
      ? new SQL.Database(fs.readFileSync(this.file))
      : new SQL.Database();
    this.db.run(`CREATE TABLE IF NOT EXISTS counts ${COUNT_COLUMNS}`);
    this.buffer = new Map(); // "hour|key" -> 次数（尚未写入数据库）
    this.dirty = false;

    const [[schema]] = this._all("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'counts'", []);
    if (!/\bWITHOUT ROWID\b/i.test(schema)) {
      // 旧表的隐式 rowid 会保留各键首次写入的相对顺序。重建表并清理旧页。
      this.db.run(`BEGIN;
        CREATE TABLE counts_new ${COUNT_COLUMNS};
        INSERT INTO counts_new SELECT hour, key, count FROM counts;
        DROP TABLE counts;
        ALTER TABLE counts_new RENAME TO counts;
        COMMIT;
        VACUUM;`);
      this.dirty = true;
      this.save();
    }
  }

  add(key, n = 1) {
    const hour = Math.floor(Date.now() / HOUR_MS) * 3600;
    const k = hour + '|' + key;
    this.buffer.set(k, (this.buffer.get(k) || 0) + n);
  }

  /** 把内存缓冲写进（内存中的）数据库 */
  flush() {
    if (!this.buffer.size) return;
    const stmt = this.db.prepare(
      'INSERT INTO counts (hour, key, count) VALUES (?, ?, ?) ' +
      'ON CONFLICT(hour, key) DO UPDATE SET count = count + excluded.count'
    );
    this.db.run('BEGIN');
    try {
      for (const [k, c] of this.buffer) {
        const i = k.indexOf('|');
        stmt.run([Number(k.slice(0, i)), k.slice(i + 1), c]);
      }
      this.db.run('COMMIT');
    } catch (e) {
      this.db.run('ROLLBACK');
      stmt.free();
      throw e;
    }
    stmt.free();
    this.buffer.clear();
    this.dirty = true;
  }

  /** 落盘：先写临时文件再替换，避免写一半时断电导致数据库损坏 */
  save() {
    this.flush();
    if (!this.dirty) return;
    const data = Buffer.from(this.db.export());
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, data);
    fs.renameSync(tmp, this.file);
    this.dirty = false;
  }

  _range(fromMs, toMs) {
    const hf = Math.floor(fromMs / HOUR_MS) * 3600;
    const ht = Math.ceil(toMs / HOUR_MS) * 3600;
    return [hf, ht];
  }

  _all(sql, params) {
    const st = this.db.prepare(sql);
    st.bind(params);
    const rows = [];
    while (st.step()) rows.push(st.get());
    st.free();
    return rows;
  }

  stats(fromMs, toMs) {
    this.flush();
    const r = this._range(fromMs, toMs);
    const perKey = {};
    for (const [key, c] of this._all(
      'SELECT key, SUM(count) FROM counts WHERE hour >= ? AND hour < ? GROUP BY key', r)) {
      perKey[key] = c;
    }
    // 键盘按键的 24 小时分布（按本地时间的小时）
    const hourOfDay = new Array(24).fill(0);
    for (const [hour, c] of this._all(
      "SELECT hour, SUM(count) FROM counts WHERE hour >= ? AND hour < ? AND key NOT LIKE 'Mouse%' GROUP BY hour", r)) {
      hourOfDay[new Date(hour * 1000).getHours()] += c;
    }
    return { perKey, hourOfDay };
  }

  rows(fromMs, toMs) {
    this.flush();
    return this._all(
      'SELECT hour, key, count FROM counts WHERE hour >= ? AND hour < ? ORDER BY hour, key',
      this._range(fromMs, toMs)
    );
  }
}

module.exports = { Store };
