import { connection } from "next/server";
import { Suspense } from "react";
import { EventPage } from "@/components/event-page";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getCatalog } from "@/server/catalog";

async function LiveEvent() {
  await connection();
  const catalog = await getCatalog();
  return <EventPage soldOut={!catalog || catalog.soldOut} />;
}

export default function Home() {
  return (
    <>
      <SiteHeader />
      <Suspense fallback={<EventPage />}>
        <LiveEvent />
      </Suspense>
      <SiteFooter />
    </>
  );
}
