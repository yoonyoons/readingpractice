/* 체험판에서 쓰는 실제 앱의 페이지와 API (src/app 그대로, 몇 개만 overrides로 바뀐다) */
import Home from "@/app/page";
import JoinPage from "@/app/join/page";
import NotFound from "@/app/not-found";
import PolicyPage from "@/app/policy/page";
import StudentHome from "@/app/s/page";
import LessonPage from "@/app/s/[worksheetId]/[articleId]/page";
import TeacherHome from "@/app/teacher/page";
import BetaPage from "@/app/teacher/beta/page";
import ClassPage from "@/app/teacher/classes/[classId]/page";
import ReportPage from "@/app/teacher/classes/[classId]/report/page";
import WorksheetPage from "@/app/teacher/classes/[classId]/worksheets/[worksheetId]/page";
import FindPage from "@/app/teacher/find/page";
import LoginPage from "@/app/teacher/login/page";
import SignupPage from "@/app/teacher/signup/page";

import * as classes from "@/app/api/classes/route";
import * as classOne from "@/app/api/classes/[classId]/route";
import * as reportComments from "@/app/api/classes/[classId]/report/comments/route";
import * as classStudent from "@/app/api/classes/[classId]/students/[studentId]/route";
import * as classWeekly from "@/app/api/classes/[classId]/weekly/route";
import * as studentClass from "@/app/api/student/class/route";
import * as studentLogin from "@/app/api/student/login/route";
import * as studentLogout from "@/app/api/student/logout/route";
import * as studentOpinion from "@/app/api/student/opinion/route";
import * as studentQuiz from "@/app/api/student/quiz/route";
import * as studentRead from "@/app/api/student/read/route";
import * as studentSummary from "@/app/api/student/summary/route";
import * as teacherDemo from "@/app/api/teacher/demo/route";
import * as teacherFind from "@/app/api/teacher/find/route";
import * as teacherLogin from "@/app/api/teacher/login/route";
import * as teacherLogout from "@/app/api/teacher/logout/route";
import * as teacherReset from "@/app/api/teacher/reset/route";
import * as teacherResetRequest from "@/app/api/teacher/reset/request/route";
import * as teacherSignup from "@/app/api/teacher/signup/route";
import * as teacherSignupRequest from "@/app/api/teacher/signup/request/route";
import * as worksheet from "@/app/api/worksheets/[worksheetId]/route";
import * as worksheetArticles from "@/app/api/worksheets/[worksheetId]/articles/route";
import * as worksheetRegenerate from "@/app/api/worksheets/[worksheetId]/articles/[articleId]/regenerate/route";
import * as worksheetOpinions from "@/app/api/worksheets/[worksheetId]/opinions/route";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PageFn = (props: any) => unknown;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handler = (req: any, ctx: any) => Promise<Response>;
/** route.ts 모듈: GET·POST 같은 처리 함수와 maxDuration 같은 설정이 섞여 있다 */
type RouteModule = Record<string, Handler | unknown>;

export const PAGES: [string, PageFn][] = [
  ["/", Home],
  ["/join", JoinPage],
  ["/policy", PolicyPage],
  ["/s", StudentHome],
  ["/s/:worksheetId/:articleId", LessonPage],
  ["/teacher", TeacherHome],
  ["/teacher/beta", BetaPage],
  ["/teacher/login", LoginPage],
  ["/teacher/signup", SignupPage],
  ["/teacher/find", FindPage],
  ["/teacher/classes/:classId", ClassPage],
  ["/teacher/classes/:classId/report", ReportPage],
  ["/teacher/classes/:classId/worksheets/:worksheetId", WorksheetPage],
];

export const NOT_FOUND: PageFn = NotFound;

export const API: [string, RouteModule][] = [
  ["/api/classes", classes],
  ["/api/classes/:classId", classOne],
  ["/api/classes/:classId/report/comments", reportComments],
  ["/api/classes/:classId/students/:studentId", classStudent],
  ["/api/classes/:classId/weekly", classWeekly],
  ["/api/student/class", studentClass],
  ["/api/student/login", studentLogin],
  ["/api/student/logout", studentLogout],
  ["/api/student/opinion", studentOpinion],
  ["/api/student/quiz", studentQuiz],
  ["/api/student/read", studentRead],
  ["/api/student/summary", studentSummary],
  ["/api/teacher/demo", teacherDemo],
  ["/api/teacher/find", teacherFind],
  ["/api/teacher/login", teacherLogin],
  ["/api/teacher/logout", teacherLogout],
  ["/api/teacher/reset", teacherReset],
  ["/api/teacher/reset/request", teacherResetRequest],
  ["/api/teacher/signup", teacherSignup],
  ["/api/teacher/signup/request", teacherSignupRequest],
  ["/api/worksheets/:worksheetId", worksheet],
  ["/api/worksheets/:worksheetId/articles", worksheetArticles],
  ["/api/worksheets/:worksheetId/articles/:articleId/regenerate", worksheetRegenerate],
  ["/api/worksheets/:worksheetId/opinions", worksheetOpinions],
];

/** "/teacher/classes/:classId" 같은 패턴에 주소를 맞춰 본다 */
export function matchPath<T>(table: [string, T][], pathname: string): { value: T; params: Record<string, string> } | null {
  const parts = pathname.replace(/\/+$/, "").split("/");
  for (const [pattern, value] of table) {
    const keys = pattern.replace(/\/+$/, "").split("/");
    if (keys.length !== parts.length) continue;
    const params: Record<string, string> = {};
    if (keys.every((k, i) => (k.startsWith(":") ? ((params[k.slice(1)] = decodeURIComponent(parts[i])), parts[i] !== "") : k === parts[i]))) {
      return { value, params };
    }
  }
  return null;
}
