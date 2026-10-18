import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from "react";
import { navigate } from "./router";

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string;
  children?: ReactNode;
  prefetch?: boolean;
  replace?: boolean;
  scroll?: boolean;
};

/** next/link 대신: 앱 안 주소는 # 주소로 바꿔 이동한다 */
export default function Link({ href, replace, onClick, ...props }: Props) {
  // prefetch·scroll은 체험판에서 쓰지 않는다
  const { prefetch, scroll, ...rest } = props;
  void prefetch;
  void scroll;
  const internal = href.startsWith("/");
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (!internal || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    navigate(href, replace);
  };
  return <a href={internal ? `#${href}` : href} onClick={handle} {...rest} />;
}
