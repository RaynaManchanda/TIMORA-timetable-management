import { readWorkbook } from '../src/importer/workbook-reader.js';
import { parseCollegeWorkbook } from '../src/importer/college-sheet-parser.js';
const { sheets } = await readWorkbook(process.argv[2]);
const r = parseCollegeWorkbook(sheets);
console.log(JSON.stringify(r.stats), 'sections', r.sections.map(s=>s.id).join(','));
console.log('faculty', r.faculty.length, 'rooms', r.rooms.length, 'subjects', r.subjects.length, 'blocks', r.blocks.length);
console.log('ISSUES'); for (const i of r.issues) console.log(i.severity, i.sheet, i.cell, i.message);
if (process.argv[3]) { for (const c of r.classes.filter(c=>c.sectionId===process.argv[3]||c.coSectionIds.includes(process.argv[3])).sort((a,b)=>a.day.localeCompare(b.day)||a.slotId.localeCompare(b.slotId))) console.log(c.day.slice(0,3), c.slotId, c.subjectKey, c.facultyName, c.roomName, c.sessionType, c.isElective?'E':'', c.coSectionIds.join('+')); }
