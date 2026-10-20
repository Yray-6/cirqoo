import { Wordmark } from "@/components/wordmark";

export function SiteHeader() {
  return (
    <header className="flex items-center justify-between gap-3 px-5 py-6 min-[1100px]:px-[72px]">
      <a href="/" aria-label="Cirqoo home">
        <Wordmark />
      </a>
      <a
        href="/checkout"
        className="shrink-0 rounded-lg bg-brand px-4 py-2.5 text-base leading-6 text-white hover:bg-[#e4572c] min-[1100px]:px-6"
      >
        Get My Ticket
      </a>
    </header>
  );
}
