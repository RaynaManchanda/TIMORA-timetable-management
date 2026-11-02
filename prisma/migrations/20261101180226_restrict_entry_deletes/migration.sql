-- DropForeignKey
ALTER TABLE "timetable_entries" DROP CONSTRAINT "timetable_entries_faculty_id_fkey";

-- DropForeignKey
ALTER TABLE "timetable_entries" DROP CONSTRAINT "timetable_entries_room_id_fkey";

-- DropForeignKey
ALTER TABLE "timetable_entries" DROP CONSTRAINT "timetable_entries_section_id_fkey";

-- DropForeignKey
ALTER TABLE "timetable_entries" DROP CONSTRAINT "timetable_entries_subject_id_fkey";

-- AddForeignKey
ALTER TABLE "timetable_entries" ADD CONSTRAINT "timetable_entries_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_entries" ADD CONSTRAINT "timetable_entries_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_entries" ADD CONSTRAINT "timetable_entries_faculty_id_fkey" FOREIGN KEY ("faculty_id") REFERENCES "faculty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_entries" ADD CONSTRAINT "timetable_entries_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
