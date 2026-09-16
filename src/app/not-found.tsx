import { Byline } from "@/components/Byline";
import { EmptyState, LinkButton } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center bg-white px-5">
      <EmptyState
        icon="🧭"
        title="페이지를 찾을 수 없어요"
        description="주소가 바뀌었거나 삭제된 페이지예요."
        action={<LinkButton href="/">처음으로</LinkButton>}
      />
      <p className="mt-10 text-[13px] text-grey-400">
        <Byline />
      </p>
    </main>
  );
}
