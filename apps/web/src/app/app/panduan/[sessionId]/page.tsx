import { TutorialWorkspace } from '@/features/tutorials/workspace';
export default async function Page({ params }: { params: Promise<{ sessionId: string }> }) { const { sessionId } = await params; return <TutorialWorkspace sessionId={sessionId} />; }
