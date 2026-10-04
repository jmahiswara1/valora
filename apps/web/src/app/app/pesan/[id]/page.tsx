import { ConversationThread } from '@/features/conversations/thread';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ConversationThread id={id} />;
}
