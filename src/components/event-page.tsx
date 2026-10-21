import Image from "next/image";

const about = [
  "Somewhere between the first drink and that one song you swore you’d never sing in public, the night gets interesting.",
  "Welcome to Cirqoo After Hours — our inaugural night of karaoke, good drinks, questionable song choices, and even better company.",
  "We’re bringing people together for a night to let loose, sing their hearts out, meet new people, and make memories worth talking about the next morning.",
  "Whether you’re the friend who never misses a high note, the one who knows every lyric but prefers the background, or simply here for the drinks and vibes, there’s a place for you here.",
  "No pressure to sound good. No need to play cool. Just good music, good people, and a night that deserves to be a little unserious.",
  "What to expect:\n• Music, visual and pop-culture questions\n• Mini-games and surprise moments\n• Prizes for winning teams\n• Food and drinks\n• Music, laughter and room-wide moments",
  "📅 Friday, November 6, 2026\n🚪 Doors Open: 6:00 PM\n🧠 Dancing Starts: 11:00 PM",
  "🎟️ Important: Tickets are non-refundable and valid only for this edition of Cirqoo After Hours - Karaoke & Games\nCapacity is limited, and tickets may not be available at the door. Please confirm your availability before purchasing.",
];

const details = [
  {
    icon: "/calendar.svg",
    label: "Date",
    text: "Friday, November 6, 2026",
  },
  {
    icon: "/clock.svg",
    label: "Time",
    text: "6:00 PM - 11:00 PM UTC",
  },
  {
    icon: "/location.svg",
    label: "Location",
    text: "Halo Lagos, Lekki",
  },
];

const venue =
  "Halo Lagos (Gothic Restaurant), 11b Hakeem Dickson Link Rd, Lekki";
const mapLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue)}`;

export function EventPage({ soldOut = false }: { soldOut?: boolean }) {
  return (
    <main className="px-5 pt-3 pb-12 min-[1100px]:px-[72px] min-[1100px]:pt-2 min-[1100px]:pb-20">
      <nav
        aria-label="Breadcrumb"
        className="mb-2.5 text-sm leading-6 text-[#61646C] min-[1100px]:mb-8 min-[1100px]:text-sm min-[1100px]:leading-5 min-[1100px]:text-muted"
      >
        <ol className="flex flex-wrap items-center gap-2">
          <li>Event</li>
          <li aria-hidden="true">/</li>
          <li className="min-[1100px]:text-ink">Cirqoo After Hours</li>
        </ol>
      </nav>

      <div className="flex flex-col gap-2.5 min-[1100px]:flex-row min-[1100px]:items-start min-[1100px]:gap-14">
        <div className="contents min-[1100px]:flex min-[1100px]:w-[480px] min-[1100px]:shrink-0 min-[1100px]:flex-col min-[1100px]:gap-8">
          <div className="order-1 min-[1100px]:order-none">
            <Image
              src="/flyer-mobile.png"
              alt="Cirqoo After Hours flyer. Ticket price ₦15k, Friday, November 6th, 2026 at Halo Lagos, Lekki."
              width={696}
              height={870}
              priority
              className="h-auto w-full rounded-[10px] min-[1100px]:rounded-none"
            />
          </div>
          {soldOut ? (
            <span className="order-2 flex h-12 items-center justify-center rounded-lg bg-[#CECECE] text-base font-semibold text-white min-[1100px]:order-none min-[1100px]:h-auto min-[1100px]:px-6 min-[1100px]:py-6 min-[1100px]:font-normal min-[1100px]:leading-5">
              Sold out
            </span>
          ) : (
            <a
              id="get-ticket"
              href="/checkout"
              className="order-2 flex h-12 items-center justify-center rounded-lg bg-[#3F3F3F] text-base font-semibold text-white hover:bg-[#2c2c2c] min-[1100px]:order-none min-[1100px]:h-auto min-[1100px]:bg-brand min-[1100px]:px-6 min-[1100px]:py-6 min-[1100px]:font-normal min-[1100px]:leading-5 min-[1100px]:hover:bg-[#e4572c]"
            >
              Get a Ticket
            </a>
          )}
          <section className="order-4 flex items-center justify-between gap-4 border-b-2 border-line py-2.5 min-[1100px]:order-none min-[1100px]:flex-col min-[1100px]:items-stretch min-[1100px]:py-0 min-[1100px]:pb-10">
            <h2 className="text-base font-black leading-6 text-ink min-[1100px]:text-base min-[1100px]:text-black">
              Hosted by
            </h2>
            <div className="flex items-center gap-4 min-[1100px]:mt-[18px]">
              <Image
                src="/cirqoo-mark.svg"
                alt=""
                width={54}
                height={42}
                className="h-7 w-[35px] object-contain min-[1100px]:h-14 min-[1100px]:w-[67px]"
              />
              <div>
                <p className="text-base font-extrabold text-black min-[1100px]:leading-5">
                  Cirqoo
                </p>
                <p className="text-sm text-muted min-[1100px]:text-sm min-[1100px]:leading-[21px]">
                  @cirqoo
                </p>
              </div>
            </div>
          </section>
        </div>

        <div className="contents min-[1100px]:flex min-[1100px]:min-w-0 min-[1100px]:flex-1 min-[1100px]:flex-col min-[1100px]:gap-10">
          <section className="order-3 flex flex-col gap-2.5 border-b-2 border-line pb-7 min-[1100px]:order-none min-[1100px]:block min-[1100px]:pb-10">
            <h1 className="text-xl font-bold leading-8 text-ink min-[1100px]:max-w-[592px] min-[1100px]:text-[30px] min-[1100px]:font-black min-[1100px]:leading-[38px] min-[1100px]:text-black">
              Cirqoo After Hours - Karaoke & Games
            </h1>
            <ul className="flex flex-col min-[1100px]:mt-[22px]">
              {details.map((item) => (
                <li
                  key={item.label}
                  className="flex items-center gap-3.5 min-[1100px]:gap-4 min-[1100px]:pt-2.5"
                >
                  <Image
                    src={item.icon}
                    alt=""
                    width={24}
                    height={24}
                    className="size-6"
                  />
                  <span className="text-sm leading-6 text-ink min-[1100px]:text-base">
                    {item.text}
                  </span>
                </li>
              ))}
            </ul>
            <p className="rounded-lg bg-[rgba(252,100,53,0.1)] p-4 text-sm leading-6 text-ink min-[1100px]:mt-[22px] min-[1100px]:max-w-[500px] min-[1100px]:leading-5">
              For a smooth experience, we recommend purchasing tickets in
              advance, as they may not be available at the door. Capacity is
              limited!
            </p>
          </section>

          <section className="order-5 flex flex-col gap-2.5 border-b-2 border-line py-2.5 pb-7 min-[1100px]:order-none min-[1100px]:block min-[1100px]:py-0 min-[1100px]:pb-10">
            <h2 className="text-base font-black leading-6 text-ink min-[1100px]:text-base min-[1100px]:text-black">
              About this event
            </h2>
            <div className="flex max-w-[921px] flex-col gap-2.5 text-sm leading-6 text-ink min-[1100px]:mt-[18px] min-[1100px]:gap-6 min-[1100px]:text-base">
              {about.map((paragraph) => (
                <p key={paragraph} className="whitespace-pre-line">
                  {paragraph}
                </p>
              ))}
            </div>
          </section>

          <section className="order-6 flex flex-col gap-[18px] border-b-2 border-line py-2.5 pb-7 min-[1100px]:order-none min-[1100px]:block min-[1100px]:py-0 min-[1100px]:pb-10">
            <h2 className="text-base font-black leading-6 text-ink min-[1100px]:text-base min-[1100px]:text-black">
              Directions
            </h2>
            <div className="relative min-[1100px]:mt-[18px] min-[1100px]:max-w-[564px]">
              <Image
                src="/map-mobile-38603e.png"
                alt="Map of Hakeem Dickson Link Road, Lekki"
                width={1024}
                height={976}
                className="h-[334px] w-full rounded-[10px] object-cover min-[1100px]:hidden"
              />
              <div className="absolute top-4 left-2 w-[min(300px,calc(100%-16px))] rounded-lg bg-white p-3 shadow-[0_1px_4px_rgba(0,0,0,0.19)] min-[1100px]:hidden">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-black">Halo Lagos</p>
                  <a href={mapLink} aria-label="Get directions">
                    <Image src="/directions.svg" alt="" width={20} height={20} />
                  </a>
                </div>
                <p className="mt-1 text-xs leading-4 text-[#5E5E5E]">
                  11b Hakeem Dickson Link Rd, Eti-Osa, Lekki 106104, Lagos
                </p>
                <p className="mt-1 text-xs text-[#5E5E5E]">4.1 ★ (704)</p>
              </div>
              <a href={mapLink} className="hidden min-[1100px]:block">
                <Image
                  src="/venue-map.png"
                  alt="Map of Hakeem Dickson Road, Lekki, with Halo Lagos marked"
                  width={1128}
                  height={720}
                  className="h-[360px] w-full object-cover"
                />
              </a>
            </div>
            <p className="hidden max-w-[564px] text-sm leading-5 text-ink min-[1100px]:block">
              {venue}.{" "}
              <a
                href={mapLink}
                className="whitespace-nowrap text-brand underline underline-offset-2"
              >
                Open in Google Maps
              </a>
            </p>
            <p className="hidden max-w-[564px] text-xs leading-4 text-muted min-[1100px]:mt-1 min-[1100px]:block">
              Map data ©{" "}
              <a
                href="https://www.openstreetmap.org/copyright"
                className="underline underline-offset-2"
              >
                OpenStreetMap
              </a>{" "}
              contributors
            </p>
          </section>

          <section className="order-7 hidden min-[1100px]:block">
            <h2 className="text-base font-black leading-6 text-black">
              Contact Us
            </h2>
            <div className="mt-[18px] flex items-center gap-6">
              <a
                href="https://tix.africa"
                aria-label="Instagram"
                className="inline-flex h-5 items-center"
              >
                <Image src="/instagram.svg" alt="" width={20} height={20} />
              </a>
              <a
                href="https://tix.africa"
                aria-label="X"
                className="inline-flex h-5 items-center"
              >
                <Image src="/x-twitter.svg" alt="" width={23} height={20} />
              </a>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
