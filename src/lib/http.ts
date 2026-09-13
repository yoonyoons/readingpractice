import type { NextRequest } from "next/server";
import type { z } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function route<Ctx = unknown>(handler: (req: NextRequest, ctx: Ctx) => Promise<Response>) {
  return async (req: NextRequest, ctx: Ctx): Promise<Response> => {
    try {
      return await handler(req, ctx);
    } catch (error) {
      return errorResponse(error);
    }
  };
}

export function errorResponse(error: unknown) {
  if (error instanceof HttpError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  console.error(error);
  const message = error instanceof Error ? error.message : "알 수 없는 오류";
  return Response.json({ error: `서버 오류가 발생했어요. (${message})` }, { status: 500 });
}

export async function readJson<S extends z.ZodType>(req: Request, schema: S): Promise<z.output<S>> {
  let data: unknown;
  try {
    data = await req.json();
  } catch {
    throw new HttpError(400, "요청 형식이 올바르지 않아요.");
  }
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new HttpError(400, parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요.");
  }
  return parsed.data;
}
