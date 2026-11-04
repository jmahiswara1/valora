import type { DatabaseService } from '../infrastructure/database.service.js';
import { StorageService } from '../infrastructure/storage.service.js';
import { MaintenanceService } from '../infrastructure/jobs/maintenance.service.js';
import { MediaService } from '../modules/media/service.js';
import { ProfilePhotoService } from '../modules/profile/photo.service.js';
import { RetentionService } from '../modules/retention/service.js';
import { TransactionsService } from '../modules/transactions/service.js';
import { TutorialRetentionService } from '../modules/tutorials/retention.js';

// Compiled with the API so dependency changes also validate smoke-test wiring.
export function createMaintenanceServices(db: DatabaseService, storage = new StorageService(), transactions = new TransactionsService(db)) {
  const photos = new ProfilePhotoService(db, storage);
  const retention = new RetentionService(db, storage, photos);
  const tutorials = new TutorialRetentionService(db, retention);
  const media = new MediaService(db, storage);
  return { storage, retention, maintenance: new MaintenanceService(db, media, transactions, retention, tutorials) };
}
