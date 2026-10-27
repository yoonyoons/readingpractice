import { z } from "zod";
import { checkBlank, ensureKeywordSummary, keywordAnswers, toPublicKeywordSummary, usesKeywordSummary } from "@/lib/keyword-summary";
import { HttpError, readJson, route } from "@/lib/http";
import { requireStudentArticle } from "@/lib/student-access";

export const maxDuration = 60;

const Body = z.object({
  worksheetId: z.string().min(1),
  articleId: z.string().min(1),
  /** 없으면 빈칸 자료를 돌려주고, 있으면 빈칸 하나를 확인한다 */
  check: z
    .object({
      id: z.string().min(1).max(20),
      value: z.string().max(40),
      /** 이번 시도를 포함한 횟수 */
      tries: z.number().int().min(1).max(20),
    })
    .optional(),
});

/** 초3~4 키워드 요약: 문단별 중심 문장·전체 요약의 빈칸 자료를 주고, 학생이 쓴 낱말이 맞는지 확인한다 (정답은 화면에 보내지 않는다) */
export const POST = route(async (req) => {
  const body = await readJson(req, Body);
  const { classRoom, worksheet, article, submission } = await requireStudentArticle(body.worksheetId, body.articleId);
  if (!usesKeywordSummary(classRoom.gradeLevel)) throw new HttpError(400, "이 학년은 스스로 요약하기를 해요.");
  if (!article.quiz.every((q) => submission.quizAnswers[q.id])) {
    throw new HttpError(400, "어휘 퀴즈를 먼저 끝내 주세요.");
  }

  const ks = await ensureKeywordSummary(worksheet, article, classRoom.gradeLevel);
  if (!body.check) return Response.json({ keywordSummary: toPublicKeywordSummary(ks) });

  const answer = keywordAnswers(ks).get(body.check.id);
  if (answer === undefined) throw new HttpError(404, "빈칸을 찾을 수 없어요. 화면을 새로 고쳐 주세요.");
  return Response.json(checkBlank(answer, body.check.value, body.check.tries));
});
