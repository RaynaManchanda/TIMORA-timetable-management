/**
 * TIMORA - Academic Data Management Routes
 * Subjects, faculty, rooms, sections, time slots and reserved section blocks, stored in PostgreSQL.
 */

import express from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import { ADMIN_ROLES } from '../constants/roles.js';
import { validateFaculty, validateIdParam, validateRoom, validateSection, validateSubject } from '../validation/academic-validator.js';

/**
 * Hide contact details from people who do not manage the timetable.
 *
 * @param {object} person Faculty record.
 * @param {{ role: string }} user Requesting user.
 * @returns {object}
 */
export function presentFaculty(person, user) {
  if (ADMIN_ROLES.includes(user.role)) return person;
  const { email, maxHoursPerWeek, ...publicFields } = person;
  return publicFields;
}

/**
 * Academic data routes, mounted at /api/academic. Reading needs a valid token (except the public section list
 * used by the sign-up form); writing needs an administrator.
 *
 * @param {{ auth: { authenticate: Function, requireAdmin: Function }, academicRepository: object }} dependencies Collaborators.
 * @returns {import('express').Router}
 */
export function createAcademicRoutes({ auth, academicRepository }) {
  const router = express.Router();

  // The create-account form needs the section list before anybody is signed in, so this one
  // read is public. It only exposes what a visitor must pick from: no class sizes, no staff.
  router.get('/sections', asyncHandler(async (req, res) => {
    const sections = (await academicRepository.listSections()).map(({ id, name, program, semester, batch }) => ({ id, name, program, semester, batch }));
    res.json({ success: true, count: sections.length, sections });
  }));

  router.use(auth.authenticate);

  // Subjects
  router.get('/subjects', asyncHandler(async (req, res) => {
    const subjects = await academicRepository.listSubjects();
    res.json({ success: true, count: subjects.length, subjects });
  }));

  router.post('/subjects', auth.requireAdmin, asyncHandler(async (req, res) => {
    const subject = await academicRepository.createSubject(validateSubject(req.body));
    res.status(201).json({ success: true, subject, message: 'Subject added successfully.' });
  }));

  router.delete('/subjects/:id', auth.requireAdmin, asyncHandler(async (req, res) => {
    const subject = await academicRepository.deleteSubject(validateIdParam(req.params.id));
    res.json({ success: true, message: `Subject ${subject.name} deleted.`, subject });
  }));

  // Faculty
  router.get('/faculty', asyncHandler(async (req, res) => {
    const faculty = (await academicRepository.listFaculty()).map((person) => presentFaculty(person, req.user));
    res.json({ success: true, count: faculty.length, faculty });
  }));

  router.post('/faculty', auth.requireAdmin, asyncHandler(async (req, res) => {
    const faculty = await academicRepository.createFaculty(validateFaculty(req.body));
    res.status(201).json({ success: true, faculty, message: 'Faculty added successfully.' });
  }));

  router.delete('/faculty/:id', auth.requireAdmin, asyncHandler(async (req, res) => {
    const faculty = await academicRepository.deleteFaculty(validateIdParam(req.params.id));
    res.json({ success: true, message: `Faculty ${faculty.name} deleted.`, faculty });
  }));

  // Rooms
  router.get('/rooms', asyncHandler(async (req, res) => {
    const rooms = await academicRepository.listRooms();
    res.json({ success: true, count: rooms.length, rooms });
  }));

  router.post('/rooms', auth.requireAdmin, asyncHandler(async (req, res) => {
    const room = await academicRepository.createRoom(validateRoom(req.body));
    res.status(201).json({ success: true, room, message: 'Room added successfully.' });
  }));

  router.delete('/rooms/:id', auth.requireAdmin, asyncHandler(async (req, res) => {
    const room = await academicRepository.deleteRoom(validateIdParam(req.params.id));
    res.json({ success: true, message: `Room ${room.name} deleted.`, room });
  }));

  // Sections (the public list is declared above)
  router.post('/sections', auth.requireAdmin, asyncHandler(async (req, res) => {
    const section = await academicRepository.createSection(validateSection(req.body));
    res.status(201).json({ success: true, section, message: 'Section added successfully.' });
  }));

  router.delete('/sections/:id', auth.requireAdmin, asyncHandler(async (req, res) => {
    const section = await academicRepository.deleteSection(validateIdParam(req.params.id));
    res.json({ success: true, message: `Section ${section.name} deleted.`, section });
  }));

  // Teaching hours and reserved time (lunch, mentoring, minor programme)
  router.get('/time-slots', asyncHandler(async (req, res) => {
    const timeSlots = await academicRepository.listTimeSlots();
    res.json({ success: true, count: timeSlots.length, timeSlots });
  }));

  router.get('/blocks', asyncHandler(async (req, res) => {
    const sectionId = typeof req.query.section === 'string' ? validateIdParam(req.query.section) : undefined;
    const blocks = await academicRepository.listBlocks({ sectionId });
    res.json({ success: true, count: blocks.length, blocks });
  }));

  return router;
}
