/** 개발용 파일 저장소가 쓰는 path 대신 */
const join = (...parts: string[]) => parts.filter(Boolean).join("/").replace(/\/+/g, "/");
const dirname = (p: string) => p.split("/").slice(0, -1).join("/") || "/";
const path = { join, dirname };
export default path;
export { join, dirname };
