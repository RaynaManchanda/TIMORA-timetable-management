import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** The college workbook that ships with the project (also the importer's default input). */
export const WORKBOOK = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..', '..', '..', 'data', '2024 Batch V wef 24th Aug 26. Ver III.xlsx'
);
