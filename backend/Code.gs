/**
 * 工作管理助手 — Google 試算表同步後端(Apps Script)
 *
 * 裝法:在雲端硬碟新增一張 Google 試算表 → 擴充功能 → Apps Script → 把這整份貼上
 *       → 改下面的 PASSWORD → 部署 → 新增部署作業 → 網頁應用程式
 *       (執行身分:我;誰可以存取:所有人)→ 把網址貼到 app 的「⋯ → 雲端同步」。
 *
 * 手機是主資料,這張表是同步副本(離線優先)。每次同步手機會把「全部」送上來:
 *   - 原始資料寫進隱藏的「_資料」表,一筆一列、照 id 覆蓋,刪掉的留墓碑
 *   - 人看的表(總覽、待辦、治工具、保養…)整張重畫,內容跟 app 匯出的 Excel 一樣
 * 送全部而不是只送改過的,是為了讓這張表永遠等於手機,不會因為哪次漏送就對不起來。
 *
 * 這份程式放在公開的 GitHub 上,所以密碼不寫在這裡——你貼進自己的 Apps Script 之後再改,
 * 改過的那份只在你自己的雲端硬碟裡。
 */
const PASSWORD = '請改成你自己的密碼';

const RAW = '_資料';
const STYLE = {   // 跟 app 匯出 Excel 的底色一致
  h:   { bg: '#16211F', fg: '#FFFFFF', b: true },
  bad: { bg: '#F8D7D3', fg: '#9C1C1C', b: true },
  dbad:{ bg: '#F8D7D3', fg: '#9C1C1C', b: true },
  warn:{ bg: '#FBEFD2' },
  ok:  { bg: '#DCEFE5' },
  info:{ bg: '#DCE6F4' },
  mute:{ fg: '#7A8580' },
  b:   { b: true },
  title:{ b: true },
  w:   {}, d: {}, '': {}
};

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (PASSWORD === '請改成你自己的密碼') return out({ ok: false, error: '後端還沒改密碼:打開 Apps Script,把 PASSWORD 改掉再重新部署' });
    if (body.password !== PASSWORD) return out({ ok: false, error: '密碼不對' });
    if (body.ping) return out({ ok: true, rows: rawCount() });
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);   // 兩次同步撞在一起時排隊,不要互相蓋
    try {
      const n = upsertRaw(body.items || []);
      if (Array.isArray(body.sheets)) writeSheets(body.sheets);
      return out({ ok: true, rows: n });
    } finally { lock.releaseLock(); }
  } catch (err) {
    return out({ ok: false, error: String(err && err.message || err) });
  }
}
function doGet() { return out({ ok: true, hello: '工作管理助手後端在線上' }); }
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function rawSheet() {
  const ss = SpreadsheetApp.getActive();
  let ws = ss.getSheetByName(RAW);
  if (!ws) {
    ws = ss.insertSheet(RAW);
    ws.getRange(1, 1, 1, 7).setValues([['id', 'family', 'cat', 'updated', 'edited', 'deleted', 'json']]);
    ws.setFrozenRows(1);
    ws.hideSheet();
  }
  return ws;
}
function rawCount() { return Math.max(0, rawSheet().getLastRow() - 1); }

/* 照 id 覆蓋。id 是手機產生的(時間戳 + 亂數),不用列號——列號會變 */
function upsertRaw(items) {
  const ws = rawSheet();
  const last = ws.getLastRow();
  const ids = last > 1 ? ws.getRange(2, 1, last - 1, 1).getValues().map(r => String(r[0])) : [];
  const at = new Map(ids.map((id, i) => [id, i]));
  const rows = ids.length ? ws.getRange(2, 1, ids.length, 7).getValues() : [];
  for (const it of items) {
    if (!it || !it.id) continue;
    const row = [it.id, it.family || '', it.cat || '', it.updated || '', it.edited || '', it.deleted ? 1 : 0, JSON.stringify(it)];
    if (at.has(it.id)) rows[at.get(it.id)] = row;
    else { at.set(it.id, rows.length); rows.push(row); }
  }
  if (rows.length) ws.getRange(2, 1, rows.length, 7).setValues(rows);
  return rows.length;
}

/* 人看的表:整張重畫。只動自己畫過的表,你自己另外開的表不會被碰 */
function writeSheets(sheets) {
  const ss = SpreadsheetApp.getActive();
  const props = PropertiesService.getDocumentProperties();
  const before = JSON.parse(props.getProperty('SHEETS') || '[]');
  const names = [];
  sheets.forEach((sh, idx) => {
    const name = String(sh.name).slice(0, 90);
    names.push(name);
    let ws = ss.getSheetByName(name) || ss.insertSheet(name);
    ss.setActiveSheet(ws); ss.moveActiveSheet(idx + 1);
    const ncol = Math.max(1, sh.cols.length);
    const grid = (sh.noHeader ? [] : [sh.cols.map(c => ({ v: c.h, s: 'h' }))]).concat(sh.rows);
    const vals = [], bg = [], fg = [], wt = [], fmt = [], wrap = [];
    grid.forEach(r => {
      const v = [], b = [], f = [], w = [], m = [], wr = [];
      for (let c = 0; c < ncol; c++) {
        const cell = r[c], o = cell == null ? { v: '' } : (typeof cell === 'object' ? cell : { v: cell });
        const st = STYLE[o.s || ''] || {};
        let val = o.date && o.v ? new Date(o.v) : (o.v == null ? '' : o.v);
        if (typeof val === 'string' && /^[=+]/.test(val)) val = "'" + val;   // 「=」開頭的備註不要被當成公式
        v.push(val);
        b.push(st.bg || null); f.push(st.fg || '#16211F'); w.push(st.b ? 'bold' : 'normal');
        // 文字欄設成「純文字」,不然 B-13 這種編號會被當成日期或算式;數字和日期照它本來的樣子
        m.push(o.date ? 'yyyy/mm/dd' : typeof val === 'number' ? (Number.isInteger(val) ? '0' : '0.0##') : '@');
        wr.push(o.s === 'w');
      }
      vals.push(v); bg.push(b); fg.push(f); wt.push(w); fmt.push(m); wr.length && wrap.push(wr);
    });
    if (ws.getFilter()) ws.getFilter().remove();
    ws.clear();
    if (ws.getMaxColumns() < ncol) ws.insertColumnsAfter(ws.getMaxColumns(), ncol - ws.getMaxColumns());
    if (grid.length) {
      const rg = ws.getRange(1, 1, grid.length, ncol);
      // 格式要在填值之前設,文字才不會先被自動轉型
      rg.setNumberFormats(fmt);
      rg.setValues(vals);
      rg.setBackgrounds(bg); rg.setFontColors(fg); rg.setFontWeights(wt);
      rg.setWraps(wrap); rg.setVerticalAlignment('top');
      if (!sh.noHeader) { ws.setFrozenRows(1); if (grid.length > 1) rg.createFilter(); }
      else ws.setFrozenRows(0);
    }
    sh.cols.forEach((c, i) => ws.setColumnWidth(i + 1, Math.round((c.w || 12) * 8)));
  });
  // 以前畫過、這次沒有的表(例如類別被刪了)才拿掉
  before.filter(n => names.indexOf(n) < 0).forEach(n => { const ws = ss.getSheetByName(n); if (ws) ss.deleteSheet(ws); });
  props.setProperty('SHEETS', JSON.stringify(names));
  ss.setActiveSheet(ss.getSheetByName(names[0]));
}
