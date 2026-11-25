/**
 * 인증 메일이 안 올 때 안내. 교육청 메일 서버가 외부(Gmail 등) 메일을
 * 스팸함·차단메일함으로 보내는 경우가 있어, 확인할 곳과 보내는 주소를 알려 준다.
 */
export function MailHelp({ sender }: { sender?: string }) {
  return (
    <div className="rounded-xl bg-warning-weak px-4 py-3 text-[13px] leading-relaxed text-[#8a5300]">
      <p className="font-semibold">메일이 1~2분 안에 오지 않나요?</p>
      <p className="mt-1">
        교육청 메일은 바깥에서 온 메일을 <b>스팸메일함</b>이나 <b>차단메일함</b>으로 옮기기도 해요. 두 곳을 확인해 주세요.
        {sender ? (
          <>
            {" "}
            보내는 주소 <b className="break-all">{sender}</b> 를 수신 허용(안전한 보낸 사람)에 넣은 뒤 다시 보내기를 누르면 더
            잘 받을 수 있어요.
          </>
        ) : null}
      </p>
    </div>
  );
}
