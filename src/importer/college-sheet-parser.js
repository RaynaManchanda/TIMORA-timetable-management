/**
 * Parser for the college's batch timetable workbook (e.g. "2024 Batch V wef 24th Aug 26. Ver III.xlsx").
 *
 * The workbook is written for humans, so the parser is deliberately tolerant: whatever it cannot
 * understand is reported as an issue instead of aborting the import.
 *
 * Layout of every section sheet ("24-CSE I", "24-ME", ...):
 *   A1       title, e.g. "2024 Batch - V Sem -CSE  I"
 *   B1:J1    the nine teaching hours
 *   A2:A6    MON ... FRI
 *   B2:J6    one cell per hour, e.g. "COA NB 307" or "ADS CSEI+CSEII NB 313 /CE&DHA 314 /BDA 307"
 *   L1:U..   course table (abbreviation, category, code, name, credits, L-T-P, faculty, ...)
 *
 * The parser is pure: it takes plain rows of strings and returns plain objects.
 */

import { TIME_SLOTS } from '../constants/academic.js';

const DAY_CODES = Object.freeze({ MON: 'MONDAY', TUE: 'TUESDAY', WED: 'WEDNESDAY', THU: 'THURSDAY', FRI: 'FRIDAY', SAT: 'SATURDAY' });
const ROMAN = Object.freeze({ I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10 });
const COURSE_CODE = /^[A-Z]{2,4}\d{3,4}$/;
const SECTION_SHEET = /^24-/;

/** Rooms that the lab sheets list explicitly. Rooms outside this set are classrooms unless a lab class uses them. */
const PLACEHOLDER_ROOM_CAPACITY = 70;
const WORKSHOP_ROOM_PATTERN = /workshop|mechatronics|automation/i;

// ---------------------------------------------------------------------------
// Small text helpers
// ---------------------------------------------------------------------------

/**
 * Collapse whitespace (including non-breaking spaces and line breaks).
 *
 * @param {unknown} value Raw cell value.
 * @returns {string}
 */
export function clean(value) {
  return String(value ?? '')
    .replace(/[ \r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Compact room name used as the room identity: "NB 314" -> "NB314", "GA 102 B" -> "GA102B".
 *
 * @param {string} prefix Building prefix, "NB" or "GA".
 * @param {string} number Room number with optional letter.
 * @returns {string}
 */
function roomName(prefix, number) {
  return `${prefix.toUpperCase()}${number.replace(/\s+/g, '').toUpperCase()}`;
}

/**
 * Turn text into an identifier-safe fragment.
 *
 * @param {string} text Any text.
 * @returns {string}
 */
export function slug(text) {
  return clean(text)
    .toUpperCase()
    .replace(/&/g, 'AND')
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Build a pattern that matches an abbreviation at the start of a string, ignoring spacing differences.
 *
 * @param {string} abbreviation Abbreviation such as "PRJ 1" or "AD&ST".
 * @returns {RegExp}
 */
function abbreviationPattern(abbreviation) {
  const body = abbreviation
    .split(/\s+/)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('\\s*');
  // "PRJ 1Mechatronics" has no space after the number, so a trailing digit only forbids more digits.
  const boundary = /\d$/.test(abbreviation) ? '(?!\d)' : '(?![A-Za-z0-9&])';
  return new RegExp(`^${body}${boundary}`, 'i');
}

// ---------------------------------------------------------------------------
// Faculty names
// ---------------------------------------------------------------------------

const TITLES = /^(dr|prof|professor|mr|ms|mrs|er)\b\.?\s*/i;

/**
 * Split the "Course Faculty" text into people, each with the part of the course they teach.
 *
 * @param {string} text Faculty text, e.g. "Dr. Tanvi Jain (LECTUREs) and Prof. Devanjali Relan (LAB)".
 * @returns {{ name: string, role: 'LECTURE' | 'LAB' | null }[]}
 */
export function parseFacultyList(text) {
  const source = clean(text);
  if (!source) return [];
  if (/^vf$/i.test(source)) return [{ name: 'Visiting Faculty', role: null }];

  return source
    .split(/\s+and\s+|\s*\/\s*|\s*&\s*|\s*;\s*|,(?![^()]*\))/i)
    .map((part) => {
      const role = /\((?:[^)]*\b)?lab(?:oratory)?\b/i.test(part)
        ? 'LAB'
        : /\((?:[^)]*\b)?(lecture|theory)/i.test(part)
          ? 'LECTURE'
          : null;
      const name = clean(part.replace(/\([^)]*\)/g, '')).replace(/[.\s]+$/, '');
      return { name, role };
    })
    .filter((person) => person.name);
}

/**
 * Registry that treats "Dr Yogesh Gupta" and "Dr. Yogesh Gupta" (and "Dr. Sukhandeep" / "Dr. Sukhandeep Kaur")
 * as one person.
 */
class FacultyRegistry {
  constructor() {
    this.people = [];
  }

  /**
   * @param {string} name Name as written in the sheet.
   * @returns {{ tokens: string[], name: string, department?: string }} The registered person (their name may be completed later).
   */
  add(name) {
    const tokens = clean(name)
      .replace(TITLES, '')
      .replace(/\./g, ' ')
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    const match = this.people.find((person) => sameFaculty(person.tokens, tokens));

    if (match) {
      if (tokens.length > match.tokens.length) {
        match.tokens = tokens;
        match.name = normaliseFacultyName(name);
      }
      return match;
    }

    const person = { tokens, name: normaliseFacultyName(name), department: undefined };
    this.people.push(person);
    return person;
  }
}

/**
 * Compare two token lists: same first token and (same last token, or one name is only a first name).
 */
function sameFaculty(a, b) {
  if (a.length === 0 || b.length === 0 || a[0] !== b[0]) return false;
  if (a.length === 1 || b.length === 1) return true;
  return a[a.length - 1] === b[b.length - 1];
}

/**
 * "Dr Yogesh Gupta" -> "Dr. Yogesh Gupta".
 */
function normaliseFacultyName(name) {
  const cleaned = clean(name);
  const titled = cleaned.replace(/^(dr|prof|mr|ms|mrs)\b\.?\s*/i, (_, title) => `${title.charAt(0).toUpperCase()}${title.slice(1).toLowerCase()}. `);
  return titled.replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// Workbook reading
// ---------------------------------------------------------------------------

/**
 * Describe a sheet title such as "24-CSE III" as a section.
 *
 * @param {string} sheetName Sheet name.
 * @param {string} title Text of cell A1.
 * @returns {{ id: string, name: string, program: string, semester: number, batch: number | null }}
 */
function describeSection(sheetName, title) {
  const name = clean(sheetName.replace(SECTION_SHEET, '')).replace(/\s+/g, ' ');
  const batch = Number(/(\d{4})\s*Batch/i.exec(title)?.[1]) || null;
  const semesterRoman = /\bBatch\s*-?\s*([IVX]+)\s*Sem/i.exec(title)?.[1]?.toUpperCase();
  const program = /^CSE\b/i.test(name) ? 'B.Tech CSE' : /^ME\b/i.test(name) ? 'B.Tech ME' : `B.Tech ${name.replace(/\s*[IVX]+$/, '')}`;

  return {
    id: `${batch ?? 'X'}_${slug(name)}`,
    name,
    program,
    semester: ROMAN[semesterRoman] ?? 5,
    batch
  };
}

/**
 * Resolve section references inside a class cell ("CSEI+CSEII", "CSE VII +CSEVIII + ECOM") to section ids.
 *
 * @param {string} text Cell text.
 * @param {Map<string, string>} sectionIdByName Section id per normalised name.
 * @returns {string[]} Section ids, possibly empty.
 */
function findReferencedSections(text, sectionIdByName) {
  const found = [];
  const groups = text.match(/CSE\s*[IVX]+(?:\s*\+\s*(?:CSE\s*)?[IVX]+)*(?:\s*\+\s*ECOM)?|ECOM/gi) ?? [];

  for (const group of groups) {
    for (const numeral of group.match(/\b[IVX]+\b|(?<=CSE)[IVX]+/gi) ?? []) {
      const id = sectionIdByName.get(`CSE${numeral.toUpperCase()}`);
      if (id) found.push(id);
    }
    if (/ECOM/i.test(group)) {
      const id = sectionIdByName.get('ECOM');
      if (id) found.push(id);
    }
  }
  return [...new Set(found)];
}

/**
 * Read the course table at the right of a section sheet.
 *
 * @param {string[][]} rows Sheet rows (0-based arrays, row 0 = sheet row 1).
 * @param {string} department Department of the sheet's programme.
 * @returns {object[]} Courses in sheet order.
 */
function readCourseTable(rows, department) {
  const header = (rows[0] ?? []).map((cell) => clean(cell).toLowerCase());
  const column = (label) => header.findIndex((cell) => cell.startsWith(label));
  const index = {
    abbreviation: column('course title'),
    category: header.findIndex((cell) => cell === 'category'),
    subCategory: column('category -') >= 0 ? column('category -') : column('category-'),
    code: column('course code'),
    name: header.findIndex((cell) => cell === 'course'),
    credits: column('credits'),
    ldp: column('ldp'),
    faculty: column('course faculty'),
    schedule: column('schedule')
  };

  if (index.abbreviation < 0 || index.name < 0) return [];

  const courses = [];
  let group = '';

  for (let r = 1; r < rows.length; r += 1) {
    const row = rows[r] ?? [];
    const get = (i) => (i >= 0 ? clean(row[i]) : '');
    const abbreviation = get(index.abbreviation);
    let category = get(index.category).replace(/\s+/g, ' ');
    const subCategory = get(index.subCategory);
    let code = get(index.code);
    const name = get(index.name);

    if (!abbreviation && !code && !name) continue;

    // A basket heading such as "SEC" or "Core Elective" names the courses listed below it.
    if (!abbreviation && !code) {
      if (category) group = category;
      continue;
    }

    // Some rows put the code in the Category column.
    let alternateCode = null;
    if (COURSE_CODE.test(category)) {
      if (code) alternateCode = category;
      else code = category;
      category = '';
    }
    if (!COURSE_CODE.test(code)) code = '';

    courses.push({
      abbreviation,
      code,
      alternateCode,
      name: name.replace(/\s+/g, ' '),
      category: category || group || '',
      subCategory,
      credits: Number.parseInt(get(index.credits), 10) || null,
      ldp: get(index.ldp).replace(/-+/g, '-') || null,
      faculty: parseFacultyList(get(index.faculty)),
      schedule: get(index.schedule),
      department,
      isElective: /elective/i.test(category) || /elective/i.test(group)
    });
  }
  return courses;
}

/**
 * Hours per week from an "L-T-P" string.
 */
function hoursFromLdp(ldp, fallback) {
  const numbers = (ldp ?? '').match(/\d+/g)?.map(Number) ?? [];
  const total = numbers.slice(0, 3).reduce((sum, value) => sum + value, 0);
  return total > 0 ? total : fallback;
}

// ---------------------------------------------------------------------------
// Class cells
// ---------------------------------------------------------------------------

/**
 * Classify a grid cell that is not a teaching class.
 *
 * @param {string} text Cell text.
 * @returns {{ kind: string, label: string } | null}
 */
function classifyBlock(text) {
  if (/^lunch$/i.test(text)) return { kind: 'LUNCH', label: 'Lunch' };
  if (/dsw|mentor/i.test(text)) return { kind: 'MENTORING', label: text };
  if (/industry expert/i.test(text)) return { kind: 'INDUSTRY_EXPERT', label: text };
  if (/^minor\b/i.test(text)) return { kind: 'MINOR', label: text };
  return null;
}

/**
 * Pull a room out of class text.
 *
 * @param {string} text Class text without the course abbreviation.
 * @returns {{ name: string, workshop: boolean } | null}
 */
function findRoom(text) {
  const prefixed = /\b(NB|GA)\s*-?\s*(\d{3}\s?[A-Z]?)\b/i.exec(text);
  if (prefixed) return { name: roomName(prefixed[1], prefixed[2]), workshop: false };

  const bare = /(?<![\d-])(\d{3}[A-Z]?)(?!\d)/.exec(text);
  if (bare) return { name: roomName('NB', bare[1]), workshop: false };

  if (WORKSHOP_ROOM_PATTERN.test(text)) {
    // Workshop areas are large shared facilities where several classes can run at once.
    const name = /mechatronics/i.test(text)
      ? 'Mechatronics Lab (Workshop Area)'
      : /automation/i.test(text)
        ? 'Automation Lab (Workshop Area)'
        : 'Workshop';
    return { name, workshop: true };
  }
  return null;
}

/**
 * The sheet sometimes forgets the "/" between two classes ("ADS CSEI+CSEII NB 313 CE&DHA 314").
 * A room followed directly by another course abbreviation starts a new class.
 *
 * @param {string} segment One slash-separated part of a cell.
 * @param {object[]} courses Courses of the sheet.
 * @returns {string[]} One or more class texts.
 */
function splitMissingSlash(segment, courses) {
  const parts = [];
  let start = 0;
  const roomEnd = /(?:(?:NB|GA)\s*-?\s*\d{3}\s?[A-Z]?|\((?:NB|GA)\d+[A-Z]?\))\s+(?=\S)/gi;

  for (const match of segment.matchAll(roomEnd)) {
    const next = match.index + match[0].length;
    const remainder = segment.slice(next);
    if (courses.some((course) => abbreviationPattern(course.abbreviation).test(remainder))) {
      parts.push(segment.slice(start, next).trim());
      start = next;
    }
  }
  parts.push(segment.slice(start).trim());
  return parts.filter(Boolean);
}

/**
 * Parse one grid cell into teaching classes.
 *
 * @param {string} text Cell text.
 * @param {object} context Course lookup for the sheet.
 * @returns {{ classes: object[], issues: string[] }}
 */
function parseTeachingCell(text, { courses, sectionIdByName }) {
  const issues = [];
  const byLength = [...courses].filter((c) => c.abbreviation).sort((a, b) => b.abbreviation.length - a.abbreviation.length);
  const segments = text
    .split('/')
    .map((segment) => clean(segment))
    .filter(Boolean)
    .flatMap((segment) => splitMissingSlash(segment, byLength));

  const classes = [];

  for (const segment of segments) {
    const normalised = segment.replace(/^PRJ\s*I\b/i, 'PRJ 1');
    const course = byLength.find((candidate) => abbreviationPattern(candidate.abbreviation).test(normalised));

    if (!course) {
      issues.push(`Unrecognised class "${segment}".`);
      continue;
    }

    const rest = normalised.replace(abbreviationPattern(course.abbreviation), ' ').trim();
    classes.push({
      course,
      segment,
      isLab: /\blab\b/i.test(rest) || /\blab\b/i.test(course.abbreviation),
      room: findRoom(rest),
      sectionIds: findReferencedSections(rest, sectionIdByName)
    });
  }

  // "BEVT/D&CS WORKSHOP": a class without its own room shares the only room named in the cell.
  const namedRooms = [...new Set(classes.map((c) => c.room?.name).filter(Boolean))];
  for (const item of classes) {
    if (!item.room && namedRooms.length === 1) {
      item.room = { name: namedRooms[0], workshop: WORKSHOP_ROOM_PATTERN.test(namedRooms[0]) };
      item.inferredRoom = true;
    }
  }

  return { classes, issues };
}

/**
 * Choose who teaches a class when the course lists several people (lecture vs lab).
 */
function pickFaculty(course, isLab) {
  const people = course.faculty;
  if (people.length === 0) return null;
  if (isLab) return people.find((p) => p.role === 'LAB') ?? people.find((p) => p.role !== 'LECTURE') ?? people[0];
  return people.find((p) => p.role === 'LECTURE') ?? people.find((p) => p.role !== 'LAB') ?? people[0];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse the whole workbook.
 *
 * @param {{ name: string, rows: string[][] }[]} sheets Every sheet with its cell text (row 0 = sheet row 1).
 * @returns {{
 *   batch: number | null,
 *   timeSlots: object[], sections: object[], faculty: object[], rooms: object[], subjects: object[],
 *   classes: object[], blocks: object[], issues: object[], stats: object
 * }}
 */
export function parseCollegeWorkbook(sheets) {
  const issues = [];
  const registry = new FacultyRegistry();
  const sectionSheets = sheets.filter((sheet) => SECTION_SHEET.test(sheet.name));

  // Directory of faculty departments, from the "Faculty TT" sheet.
  readFacultyDirectory(sheets.find((s) => /^faculty tt/i.test(s.name)), registry);
  const roomInfo = readRoomDirectory(sheets.filter((s) => /^lab/i.test(s.name)));

  // Pass 1: sections and course tables.
  const sections = [];
  const sectionIdByName = new Map();
  for (const sheet of sectionSheets) {
    const section = describeSection(sheet.name, clean(sheet.rows[0]?.[0]));
    sections.push(section);
    sectionIdByName.set(section.name.replace(/\s+/g, '').toUpperCase(), section.id);
  }

  const subjectsByCode = new Map();
  const rawClasses = [];
  const blocks = new Map();

  sectionSheets.forEach((sheet, sheetIndex) => {
    const section = sections[sheetIndex];
    const department = section.program.replace('B.Tech ', '');
    const courses = readCourseTable(sheet.rows, department);
    const sheetLabel = sheet.name.trim();

    for (const course of courses) {
      course.faculty = course.faculty.map(({ name, role }) => ({ role, person: registry.add(name) }));
      for (const { person } of course.faculty) {
        person.department ??= person.name === 'Visiting Faculty' ? 'Visiting' : department;
      }
      registerSubject(subjectsByCode, course);
    }

    // Time-slot header sanity check: nine hours expected.
    const hours = (sheet.rows[0] ?? []).slice(1, 10).filter((cell) => clean(cell));
    if (hours.length !== TIME_SLOTS.length) {
      issues.push({ sheet: sheetLabel, cell: 'B1:J1', severity: 'warning', message: `Expected ${TIME_SLOTS.length} time slots, found ${hours.length}.` });
    }

    // Grid.
    for (let r = 1; r < sheet.rows.length; r += 1) {
      const row = sheet.rows[r] ?? [];
      const day = DAY_CODES[clean(row[0]).toUpperCase().slice(0, 3)];
      if (!day) continue;

      for (let c = 1; c <= TIME_SLOTS.length; c += 1) {
        const text = clean(row[c]);
        if (!text) continue;

        const slotId = TIME_SLOTS[c - 1].id;
        const cellRef = `${columnLetter(c)}${r + 1}`;
        const block = classifyBlock(text);

        if (block) {
          blocks.set(`${section.id}|${day}|${slotId}|${block.kind}`, { sectionId: section.id, day, slotId, ...block });
          continue;
        }

        const { classes, issues: cellIssues } = parseTeachingCell(text, { courses, sectionIdByName });
        cellIssues.forEach((message) => issues.push({ sheet: sheetLabel, cell: cellRef, severity: 'warning', message, text }));

        for (const item of classes) {
          const label = { sheet: sheetLabel, cell: cellRef, text };
          if (!item.room) {
            issues.push({ ...label, severity: 'warning', message: `No room found for "${item.segment}"; class skipped.` });
            continue;
          }
          if (item.inferredRoom) {
            issues.push({ ...label, severity: 'info', message: `Room for "${item.segment}" taken from the same cell: ${item.room.name}.` });
          }
          const teacher = pickFaculty(item.course, item.isLab);
          if (!teacher) {
            issues.push({ ...label, severity: 'warning', message: `No faculty listed for "${item.course.abbreviation}"; class skipped.` });
            continue;
          }

          const subjectKey = item.course.code || `ABBR_${slug(item.course.abbreviation)}`;
          const isProject = /project/i.test(item.course.category);
          rawClasses.push({
            sectionId: section.id,
            coSectionIds: item.sectionIds.filter((id) => id !== section.id),
            subjectKey,
            faculty: teacher.person,
            roomName: item.room.name,
            roomIsWorkshop: item.room.workshop,
            day,
            slotId,
            sessionType: isProject ? 'PROJECT' : item.isLab ? 'LAB' : 'LECTURE',
            isElective: item.course.isElective,
            sourceCell: `${sheetLabel}!${cellRef}: ${text}`,
            sheetOrder: sheetIndex
          });
        }
      }
    }
  });

  addMinorCourses(sheets.find((s) => /^minor/i.test(s.name)), subjectsByCode, registry);

  const merged = mergeCombinedClasses(rawClasses);
  const { classes, conflicts } = dropConflicts(merged);
  conflicts.forEach((conflict) => issues.push(conflict));

  const rooms = buildRooms(classes, roomInfo);
  const subjects = buildSubjects(subjectsByCode, classes);
  const faculty = buildFaculty(registry);

  return {
    batch: sections.find((s) => s.batch)?.batch ?? null,
    timeSlots: TIME_SLOTS.map(({ id, slotNumber, startTime, endTime, label }) => ({ id, slotNumber, startTime, endTime, label })),
    sections,
    faculty,
    rooms,
    subjects,
    classes,
    blocks: [...blocks.values()],
    issues,
    stats: {
      sheets: sectionSheets.length,
      cellsRead: rawClasses.length,
      classes: classes.length,
      combinedClasses: classes.filter((c) => c.coSectionIds.length > 0).length,
      blocks: blocks.size,
      skipped: issues.filter((i) => i.severity === 'warning' || i.severity === 'conflict').length
    }
  };
}

/**
 * Letter of a 0-based column index.
 */
function columnLetter(index) {
  return String.fromCharCode(65 + index);
}

/**
 * Remember a subject, keeping the first definition of a code.
 */
function registerSubject(subjectsByCode, course) {
  const key = course.code || `ABBR_${slug(course.abbreviation)}`;
  if (!subjectsByCode.has(key)) {
    subjectsByCode.set(key, { key, ...course });
  }
  if (course.alternateCode && !subjectsByCode.has(course.alternateCode)) {
    subjectsByCode.set(course.alternateCode, { key: course.alternateCode, ...course, code: course.alternateCode, isAlternate: true });
  }
}

/**
 * Add the minor-programme courses (listed on the "Minor" sheet) to the subject list.
 */
function addMinorCourses(sheet, subjectsByCode, registry) {
  if (!sheet) return;
  const header = (sheet.rows[0] ?? []).map((cell) => clean(cell).toLowerCase());
  const col = (label) => header.findIndex((cell) => cell.startsWith(label));
  const [codeCol, nameCol, creditsCol, ldpCol, facultyCol, abbrCol] = [col('course code'), col('course'), col('credits'), col('ldp'), col('course faculty'), col('abbreviation')];

  for (const row of sheet.rows.slice(1)) {
    const code = clean(row[codeCol]);
    if (!COURSE_CODE.test(code) || subjectsByCode.has(code)) continue;
    const faculty = parseFacultyList(clean(row[facultyCol])).map(({ name, role }) => ({ role, person: registry.add(name) }));
    faculty.forEach(({ person }) => { person.department ??= 'Minor Programme'; });
    subjectsByCode.set(code, {
      key: code,
      abbreviation: clean(row[abbrCol]),
      code,
      name: clean(row[nameCol]),
      category: 'Minor Programme',
      credits: Number.parseInt(clean(row[creditsCol]), 10) || 3,
      ldp: clean(row[ldpCol]).replace(/-+/g, '-') || null,
      faculty,
      department: 'Minor Programme',
      isElective: true
    });
  }
}

/**
 * Faculty names and departments from the "Faculty TT" sheet.
 */
function readFacultyDirectory(sheet, registry) {
  if (!sheet) return;
  for (const row of sheet.rows.slice(1)) {
    const name = clean(row[0]);
    const department = clean(row[1]);
    if (!name || !department) continue;
    registry.add(name).department = department;
  }
}

/**
 * Room headings of the lab sheets: "Room No.GA101 (Gateway Building Ist Floor)", "NB309".
 */
function readRoomDirectory(sheets) {
  const rooms = new Map();
  for (const sheet of sheets) {
    for (const row of sheet.rows) {
      for (const cell of row) {
        const text = clean(cell);
        const heading = /^(?:Room No\.?\s*)?((?:NB|GA)\s?\d{3}\s?[A-Z]?)\s*(?:\(([^)]*)\))?/i.exec(text);
        if (!heading || text.length > 120 || /LAB\b/.test(text.replace(heading[0], ''))) continue;
        const id = roomName(heading[1].slice(0, 2), heading[1].slice(2));
        if (!rooms.has(id)) rooms.set(id, { building: heading[2] ? clean(heading[2]).replace(/\s*(?:\d+(?:st|nd|rd|th)|ist)\s*floor.*$/i, '').trim() : null });
      }
    }
  }
  return rooms;
}

/**
 * Classes that are identical in everything but the section (an elective, or "ADS CSE V + CSE VI")
 * are one real class attended by several sections.
 */
function mergeCombinedClasses(rawClasses) {
  const merged = new Map();

  for (const item of rawClasses) {
    const key = [item.subjectKey, item.faculty.name, item.roomName, item.day, item.slotId, item.sessionType].join('|');
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, { ...item, sections: new Set([item.sectionId, ...item.coSectionIds]), sourceCells: [item.sourceCell] });
      continue;
    }
    existing.sections.add(item.sectionId);
    item.coSectionIds.forEach((id) => existing.sections.add(id));
    existing.sourceCells.push(item.sourceCell);
    existing.isElective = existing.isElective || item.isElective;
  }

  return [...merged.values()].map((item) => {
    const [primary, ...others] = [...item.sections];
    const { sections, sourceCells, faculty, ...rest } = item;
    return { ...rest, sectionId: primary, coSectionIds: others, facultyName: faculty.name, facultyId: facultyId(faculty), sourceCell: sourceCells.slice(0, 3).join(' | ') };
  });
}

/**
 * Keep the first of two classes that double-book a room, a teacher or a section, and report the other.
 */
function dropConflicts(classes) {
  const taken = { room: new Map(), faculty: new Map(), section: new Map() };
  const kept = [];
  const conflicts = [];

  for (const item of classes) {
    const when = `${item.day}|${item.slotId}`;
    // Shared facilities (workshops) host several classes at once; project guidance is given by a panel.
    const checks = [];
    if (!item.roomIsWorkshop) checks.push(['room', `${item.roomName}|${when}`, `Room ${item.roomName}`]);
    if (item.sessionType !== 'PROJECT') checks.push(['faculty', `${item.facultyName}|${when}`, item.facultyName]);
    if (!item.isElective) checks.push(['section', `${item.sectionId}|${when}`, `Section ${item.sectionId}`]);

    const clash = checks.find(([kind, key]) => taken[kind].has(key));
    if (clash) {
      const [kind, key, label] = clash;
      conflicts.push({
        sheet: item.sourceCell.split('!')[0],
        cell: item.sourceCell.split('!')[1]?.split(':')[0],
        severity: 'conflict',
        message: `${label} is double-booked on ${item.day} ${item.slotId}: ${item.subjectKey} clashes with ${taken[kind].get(key)}. Class skipped.`,
        text: item.sourceCell
      });
      continue;
    }

    for (const [kind, key] of checks) taken[kind].set(key, item.subjectKey);
    kept.push(item);
  }
  return { classes: kept, conflicts };
}

/**
 * Rooms used by the classes, typed and housed using the lab-sheet headings.
 */
function buildRooms(classes, roomInfo) {
  const rooms = new Map();
  for (const item of classes) {
    const room = rooms.get(item.roomName) ?? { name: item.roomName, hasLab: false, workshop: item.roomIsWorkshop };
    room.hasLab = room.hasLab || item.sessionType === 'LAB';
    rooms.set(item.roomName, room);
  }
  for (const name of roomInfo.keys()) {
    if (!rooms.has(name)) rooms.set(name, { name, hasLab: true, workshop: false });
  }

  return [...rooms.values()].map((room) => {
    const isLab = room.hasLab || roomInfo.has(room.name) || room.workshop;
    const prefix = room.name.slice(0, 2);
    const building = roomInfo.get(room.name)?.building || (room.workshop ? 'Workshop' : prefix === 'GA' ? 'Gateway Building' : prefix === 'NB' ? 'NB Block' : 'Campus');
    return {
      id: `R_${slug(room.name)}`,
      name: room.name,
      building,
      type: isLab ? 'LAB' : 'CLASSROOM',
      isShared: room.workshop,
      // The workbook gives no capacities; every room starts with a placeholder to be edited by the admin.
      capacity: PLACEHOLDER_ROOM_CAPACITY
    };
  });
}

/**
 * Subjects that are actually referenced, plus every coded course of the tables.
 */
function buildSubjects(subjectsByCode, classes) {
  const labOnly = (s) => /^0-0-\d/.test(s.ldp ?? '') || /\blab\b/i.test(s.name);
  const used = new Set(classes.map((c) => c.subjectKey));

  return [...subjectsByCode.values()]
    .filter((s) => s.code || used.has(s.key))
    .map((s) => ({
      key: s.key,
      id: `SUB_${slug(s.code || s.key)}`,
      code: s.code || s.key.replace(/^ABBR_/, ''),
      name: s.name || s.abbreviation,
      abbreviation: s.abbreviation || null,
      department: s.department,
      type: labOnly(s) ? 'LAB' : 'LECTURE',
      category: s.category || null,
      ldp: s.ldp,
      credits: s.credits ?? 3,
      requiredHoursPerWeek: hoursFromLdp(s.ldp, s.credits ?? 3)
    }));
}

/**
 * Faculty with a placeholder e-mail (".invalid" can never be delivered) until real addresses are loaded.
 */
function buildFaculty(registry) {
  return registry.people.map((person) => ({
    id: facultyId(person),
    name: person.name,
    email: `${slug(person.name.replace(TITLES, '')).toLowerCase().replace(/_/g, '.')}@faculty.timora.invalid`,
    department: person.department ?? 'Unassigned'
  }));
}

/**
 * Stable faculty id derived from the (completed) name.
 */
function facultyId(person) {
  return `F_${slug(person.name.replace(TITLES, ''))}`;
}
