

export interface PassportTimelineEntry { id: string; type: string; origin: string; occurredAt: string; recordedAt: string; correctionOfId: string | null; summary: string; assessment?: { status: string; score: number | null; label: string | null; ruleVersion: string; historical: boolean; valid: boolean }; repair?: { summary: string; afterCondition: string; status: string; outcome: string } }

export interface PassportShareDto { url: string; access: 'PUBLIC' | 'LIMITED' | 'UNAVAILABLE' }

export interface PassportDto { itemId: string; categoryCode: string; visibility: string; version: number; projection: 'PUBLIC' | 'OWNER'; title: string | null; description: string | null; media: { id: string; url: string }[]; timeline: PassportTimelineEntry[]; share: PassportShareDto }
