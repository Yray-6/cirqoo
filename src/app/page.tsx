import { EventPage } from "@/components/event-page";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <EventPage />
      <SiteFooter />
    </>
  );
}
