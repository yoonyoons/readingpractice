import { notFound, redirect } from "next/navigation";
import { TeacherShell } from "@/components/teacher/TeacherShell";
import { WorksheetView } from "@/components/teacher/WorksheetView";
import { getDb } from "@/lib/db";
import { GRADES } from "@/lib/grades";
import { getTeacher } from "@/lib/session";

export default async function WorksheetPage(props: PageProps<"/teacher/classes/[classId]/worksheets/[worksheetId]">) {
  const { classId, worksheetId } = await props.params;
  const teacher = await getTeacher();
  if (!teacher) redirect("/teacher/login");

  const db = getDb();
  const [classRoom, worksheet] = await Promise.all([db.getClass(classId), db.getWorksheet(worksheetId)]);
  if (!classRoom || classRoom.teacherId !== teacher.id || !worksheet || worksheet.classId !== classId) notFound();

  const [students, submissions] = await Promise.all([
    db.listStudents(classId),
    db.listSubmissionsByWorksheet(worksheetId),
  ]);

  return (
    <TeacherShell teacher={teacher}>
      <WorksheetView
        classId={classId}
        classTitle={classRoom.name}
        gradeLabel={GRADES[classRoom.gradeLevel].label}
        worksheet={worksheet}
        students={students.map((s) => ({ id: s.id, number: s.number, name: s.name }))}
        submissions={submissions}
      />
    </TeacherShell>
  );
}
