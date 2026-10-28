// PROTOTYPE — dev-only design-review page: renders the Add record modal on mock data in a fixed state so it can be
// screenshotted headlessly (no login). 404s in production. States: ?state=empty | filled | category | create
import { notFound } from "next/navigation";
import { ModalPreview } from "./ModalPreview";

export default async function ModalPreviewPage({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { state = "empty" } = await searchParams;
  return <ModalPreview state={state} />;
}
