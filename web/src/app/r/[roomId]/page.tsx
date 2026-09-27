import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isValidRoomId } from "@/lib/room-id";
import { Meeting } from "@/components/meeting/Meeting";

export const metadata: Metadata = {
  title: "Meeting · Meet",
  robots: { index: false }, // meeting links are private
};

export default async function RoomPage(props: PageProps<"/r/[roomId]">) {
  const { roomId } = await props.params;
  if (!isValidRoomId(roomId)) notFound();
  return <Meeting roomId={roomId} />;
}
