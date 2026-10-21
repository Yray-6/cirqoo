import { EventForm } from "@/components/admin/event-form";

export const instant = false;

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EventForm key={id} eventId={id} />;
}
