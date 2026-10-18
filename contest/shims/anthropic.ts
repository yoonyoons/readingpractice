/** @anthropic-ai/sdk 대신: 체험판은 Claude를 직접 부르지 않으므로 이름만 맞춘다 */
class APIError extends Error {}
class NotFoundError extends APIError {}
class APIConnectionError extends APIError {}

export default class Anthropic {
  static APIError = APIError;
  static NotFoundError = NotFoundError;
  static APIConnectionError = APIConnectionError;
}

export function zodOutputFormat() {
  return {};
}
