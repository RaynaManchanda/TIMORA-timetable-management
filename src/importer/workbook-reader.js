import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import ExcelJS from 'exceljs';

const MAX_COLUMNS = 40;
const MAX_ROWS = 600;

/**
 * Read an .xlsx file into plain rows of text, which is all the parser needs.
 *
 * Only cells that hold a value are visited: the college sheets are formatted down to row 1000,
 * and walking those empty styled cells would be slow for no benefit.
 *
 * @param {string} filePath Path of the workbook.
 * @returns {Promise<{ sheets: { name: string, rows: string[][] }[], sha256: string }>}
 */
export async function readWorkbook(filePath) {
  const buffer = await readFile(filePath);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const sheets = workbook.worksheets.map((worksheet) => {
    const rows = [];

    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber > MAX_ROWS) return;

      const cells = (rows[rowNumber - 1] = []);
      row.eachCell({ includeEmpty: false }, (cell, columnNumber) => {
        if (columnNumber > MAX_COLUMNS) return;
        cells[columnNumber - 1] = cellText(cell.value);
      });
    });

    // Empty rows and empty cells are holes in the sparse arrays; make every row a dense list of text.
    for (let r = 0; r < rows.length; r += 1) rows[r] = Array.from(rows[r] ?? [], (text) => text ?? '');
    return { name: worksheet.name, rows };
  });

  return { sheets, sha256: createHash('sha256').update(buffer).digest('hex') };
}

/**
 * Text shown in a cell, whatever its internal type (rich text, formula, hyperlink, date, number).
 *
 * @param {unknown} value ExcelJS cell value.
 * @returns {string}
 */
function cellText(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    if ('richText' in value) return value.richText.map((part) => part.text).join('');
    if ('result' in value) return String(value.result ?? '');
    if ('text' in value) return String(value.text ?? '');
    if ('error' in value) return '';
  }
  return String(value);
}
