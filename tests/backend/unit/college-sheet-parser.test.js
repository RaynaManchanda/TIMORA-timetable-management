import { beforeAll, describe, expect, test } from '@jest/globals';
import { clean, parseCollegeWorkbook, parseFacultyList } from '../../../src/importer/college-sheet-parser.js';
import { readWorkbook } from '../../../src/importer/workbook-reader.js';

import { WORKBOOK } from '../helpers/workbook.js';

describe('parseFacultyList', () => {
  test('splits people and remembers who teaches the lecture and who the lab', () => {
    expect(parseFacultyList('Dr. Tanvi Jain (LECTUREs) and Prof. Devanjali Relan (LAB)')).toEqual([
      { name: 'Dr. Tanvi Jain', role: 'LECTURE' },
      { name: 'Prof. Devanjali Relan', role: 'LAB' }
    ]);
    expect(parseFacultyList('Dr. Shilpa Mahajan (Lecture)/Dr. Sukhandeep Kaur(Lab)')).toEqual([
      { name: 'Dr. Shilpa Mahajan', role: 'LECTURE' },
      { name: 'Dr. Sukhandeep Kaur', role: 'LAB' }
    ]);
    expect(parseFacultyList('Dr. Anubhav Agarwal & Dr. Ranbir Singh').map((p) => p.name)).toEqual(['Dr. Anubhav Agarwal', 'Dr. Ranbir Singh']);
  });

  test('"VF" means visiting faculty and blanks are ignored', () => {
    expect(parseFacultyList('VF')).toEqual([{ name: 'Visiting Faculty', role: null }]);
    expect(parseFacultyList('  ')).toEqual([]);
  });
});

describe('clean', () => {
  test('collapses non-breaking spaces, line breaks and runs of spaces', () => {
    expect(clean('Machine Learning \n  Lab ')).toBe('Machine Learning Lab');
    expect(clean(null)).toBe('');
  });
});

describe('the college workbook "2024 Batch V wef 24th Aug 26. Ver III"', () => {
  let parsed;

  beforeAll(async () => {
    const { sheets } = await readWorkbook(WORKBOOK);
    parsed = parseCollegeWorkbook(sheets);
  });

  const classesOf = (sectionId) => parsed.classes.filter((c) => c.sectionId === sectionId || c.coSectionIds.includes(sectionId));
  const at = (sectionId, day, slotId) => classesOf(sectionId).filter((c) => c.day === day && c.slotId === slotId);

  test('reads the ten section sheets with nine hourly slots', () => {
    expect(parsed.sections.map((s) => s.name)).toEqual(['CSE I', 'CSE II', 'CSE III', 'CSE IV', 'CSE V', 'CSE VI', 'CSE VII', 'CSE VIII', 'ME', 'ECoM']);
    expect(parsed.sections.every((s) => s.semester === 5 && s.batch === 2024)).toBe(true);
    expect(parsed.timeSlots.map((s) => s.label)).toEqual([
      '09:00 - 09:55', '10:00 - 10:55', '11:00 - 11:55', '12:00 - 12:55', '13:00 - 13:55',
      '14:00 - 14:55', '15:00 - 15:55', '16:00 - 16:55', '17:00 - 17:55'
    ]);
    expect(parsed.classes.length).toBeGreaterThan(240);
  });

  test('CSE V Monday morning matches the sheet: project, project, SE lab, SE lab, COA', () => {
    const monday = (slot) => at('2024_CSE_V', 'MONDAY', slot).map((c) => `${c.subjectKey}/${c.roomName}/${c.sessionType}`);

    expect(monday('S1')).toEqual(['PRJ3908/NB314/PROJECT']);
    expect(monday('S2')).toEqual(['PRJ3908/NB314/PROJECT']);
    expect(monday('S3')).toEqual(['CSE3005/NB209/LAB']);
    expect(monday('S4')).toEqual(['CSE3005/NB209/LAB']);
    expect(monday('S5')).toEqual(['CSE2709/NB314/LECTURE']);
  });

  test('uses the lab teacher for a lab cell and the lecture teacher for a lecture cell', () => {
    const [lab] = at('2024_CSE_VIII', 'THURSDAY', 'S5');
    expect(lab).toMatchObject({ subjectKey: 'CSE3005', sessionType: 'LAB', facultyName: 'Dr. Nishtha Phutela' });

    const [lecture] = classesOf('2024_CSE_VIII').filter((c) => c.subjectKey === 'CSE3005' && c.sessionType === 'LECTURE');
    expect(lecture.facultyName).toBe('Dr. Harsh Taneja');
  });

  test('records lunch, mentoring, minor and industry-expert time as blocks, lunch at a different hour per day', () => {
    const blocksOf = (kind) => parsed.blocks.filter((b) => b.sectionId === '2024_CSE_V' && b.kind === kind);

    expect(blocksOf('LUNCH')).toHaveLength(5);
    expect(new Set(blocksOf('LUNCH').map((b) => b.slotId)).size).toBeGreaterThan(1);
    expect(blocksOf('MENTORING').map((b) => b.slotId).sort()).toEqual(['S7', 'S8', 'S9']);
    expect(blocksOf('MINOR').length).toBe(3);
    expect(blocksOf('INDUSTRY_EXPERT').length).toBe(2);
    expect(blocksOf('LUNCH').every((b) => b.label === 'Lunch')).toBe(true);
  });

  test('parallel electives are separate classes in the same slot, shared by several sections', () => {
    const wednesday = at('2024_CSE_V', 'WEDNESDAY', 'S2');

    expect(wednesday.map((c) => c.subjectKey).sort()).toEqual(['CSE3102', 'CSE3103', 'CSE3105', 'CSE3712', 'CSE4001']);
    expect(wednesday.every((c) => c.isElective)).toBe(true);
    const bda = wednesday.find((c) => c.subjectKey === 'CSE3712');
    expect(bda.coSectionIds.length).toBeGreaterThanOrEqual(6);
  });

  test('a combined class ("ADS CSE V + CSE VI") is stored once for both sections', () => {
    const forV = at('2024_CSE_V', 'MONDAY', 'S7').find((c) => c.subjectKey === 'CSE3105');
    const forVI = at('2024_CSE_VI', 'MONDAY', 'S7').find((c) => c.subjectKey === 'CSE3105');

    expect(forV).toBeDefined();
    expect(forV).toBe(forVI);
    expect([forV.sectionId, ...forV.coSectionIds].sort()).toEqual(['2024_CSE_V', '2024_CSE_VI']);
  });

  test('a slash missing between two classes does not lose the second class', () => {
    // CSE I, Wednesday 10:00: "ADS CSEI+CSEII NB 313 CE&DHA 314 /BDA 307 ..."
    const keys = at('2024_CSE_I', 'WEDNESDAY', 'S2').map((c) => c.subjectKey);

    expect(keys).toEqual(expect.arrayContaining(['CSE3105', 'CSE3102', 'CSE3712']));
  });

  test('workshop areas are shared rooms and are typed as labs', () => {
    const workshop = parsed.rooms.find((r) => r.name === 'Workshop');
    expect(workshop).toMatchObject({ isShared: true, type: 'LAB' });
    expect(parsed.rooms.find((r) => r.name === 'NB314')).toMatchObject({ isShared: false, type: 'CLASSROOM' });
    expect(parsed.rooms.find((r) => r.name === 'GA102B').type).toBe('LAB');
  });

  test('faculty are de-duplicated across spellings and carry a department', () => {
    const names = parsed.faculty.map((f) => f.name);
    expect(names.filter((n) => /Yogesh Gupta/.test(n))).toHaveLength(1);
    expect(names.filter((n) => /Sukhandeep/.test(n))).toEqual(['Dr. Sukhandeep Kaur']);
    expect(parsed.faculty.find((f) => f.name === 'Dr. Harsh Taneja').department).toBe('CSE');
    expect(parsed.faculty.every((f) => f.email.endsWith('@faculty.timora.invalid'))).toBe(true);
    expect(new Set(parsed.faculty.map((f) => f.id)).size).toBe(parsed.faculty.length);
  });

  test('reports what it could not load instead of guessing: one real room clash in the sheet, nothing unreadable', () => {
    const problems = parsed.issues.filter((issue) => issue.severity !== 'info');

    expect(problems.map((p) => p.message).join('\n')).not.toMatch(/Unrecognised|No room|No faculty/);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({ severity: 'conflict', sheet: '24-CSE III', cell: 'C6' });
    expect(problems[0].message).toMatch(/Room NB307 is double-booked on FRIDAY S2/);
  });

  test('no two loaded classes double-book a teacher, a non-shared room or a section', () => {
    const seen = { faculty: new Set(), room: new Set(), section: new Set() };
    const sharedRooms = new Set(parsed.rooms.filter((r) => r.isShared).map((r) => r.name));

    for (const c of parsed.classes) {
      const when = `${c.day}|${c.slotId}`;
      if (c.sessionType !== 'PROJECT') {
        expect(seen.faculty.has(`${c.facultyId}|${when}`)).toBe(false);
        seen.faculty.add(`${c.facultyId}|${when}`);
      }
      if (!sharedRooms.has(c.roomName)) {
        expect(seen.room.has(`${c.roomName}|${when}`)).toBe(false);
        seen.room.add(`${c.roomName}|${when}`);
      }
      if (!c.isElective) {
        expect(seen.section.has(`${c.sectionId}|${when}`)).toBe(false);
        seen.section.add(`${c.sectionId}|${when}`);
      }
    }
  });
});
