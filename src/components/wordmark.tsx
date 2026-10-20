import { Anek_Bangla } from "next/font/google";

const anekBangla = Anek_Bangla({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`${anekBangla.className} bg-[linear-gradient(90deg,#FA87A8_0%,#FDAB86_100%)] bg-clip-text text-[32px] leading-6 font-normal text-transparent ${className}`}
    >
      CIRQOO
    </span>
  );
}
