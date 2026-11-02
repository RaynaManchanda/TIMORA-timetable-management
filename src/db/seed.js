import { TIME_SLOTS } from '../constants/academic.js';
import { ROLES } from '../constants/roles.js';

const DEMO_PASSWORD = 'Password123!';

/**
 * Make sure the nine teaching hours exist. Safe to run on every start-up.
 *
 * @param {import('@prisma/client').PrismaClient} prisma Prisma client.
 * @returns {Promise<void>}
 */
export async function seedTimeSlots(prisma) {
  await prisma.timeSlot.createMany({
    data: TIME_SLOTS.map(({ id, slotNumber, startTime, endTime, label }) => ({ id, slotNumber, startTime, endTime, label })),
    skipDuplicates: true
  });
}

/**
 * Create demo accounts for local development: a coordinator, a faculty member and a student of
 * the imported "CSE V" section. Existing accounts are kept. Never runs in production.
 *
 * @param {import('@prisma/client').PrismaClient} prisma Prisma client.
 * @param {object} userRepository User repository.
 * @param {{ hash: (password: string) => Promise<string> }} passwordService Password hashing service.
 * @returns {Promise<{ created: number }>}
 */
export async function seedDemoUsers(prisma, userRepository, passwordService) {
  const passwordHash = await passwordService.hash(DEMO_PASSWORD);

  const faculty = await prisma.faculty.findFirst({ where: { name: { contains: 'Shilpa Mahajan' } } });
  const section = await prisma.section.findFirst({ where: { name: 'CSE V' }, orderBy: { id: 'asc' } });

  const accounts = [
    { id: 'USR_ADMIN_01', name: 'Academic Coordinator', email: 'admin@timora.edu', role: ROLES.COORDINATOR, department: 'Computer Science' },
    faculty && { id: 'USR_FAC_DEMO', name: faculty.name, email: 'faculty@timora.edu', role: ROLES.FACULTY, department: faculty.department, facultyId: faculty.id },
    section && { id: 'USR_STU_DEMO', name: 'Demo Student', email: 'student@timora.edu', role: ROLES.STUDENT, sectionId: section.id }
  ].filter(Boolean);

  let created = 0;
  for (const account of accounts) {
    if (await userRepository.createIfMissing({ ...account, passwordHash })) created += 1;
  }
  return { created };
}
