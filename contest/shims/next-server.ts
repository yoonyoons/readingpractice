/** next/server 대신 */
export class NextRequest extends Request {
  nextUrl: URL;
  constructor(input: string, init?: RequestInit) {
    super(input, init);
    this.nextUrl = new URL(input);
  }
}

export const NextResponse = Response;

export async function connection() {}

export function after(task: () => unknown) {
  void Promise.resolve().then(task);
}
