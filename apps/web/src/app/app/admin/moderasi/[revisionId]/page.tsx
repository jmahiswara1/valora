import { ModerationReviewPage } from '@/features/admin/moderation/detail';

export default async function Page({ params }: { params: Promise<{ revisionId: string }> }) {
  const { revisionId } = await params;
  return <ModerationReviewPage revisionId={revisionId} />;
}
