'use client';

import type { PublicListingDto } from '@valora/contracts';

export type ActiveListing = Extract<PublicListingDto, { status: 'ACTIVE' }>;
