CREATE TYPE "ProfilePhotoProvider" AS ENUM ('LOCAL', 'CLOUDINARY');

CREATE TABLE "ProfilePhoto" (
    "userId" UUID NOT NULL,
    "provider" "ProfilePhotoProvider" NOT NULL,
    "storageKey" VARCHAR(180) NOT NULL,
    "mime" VARCHAR(40) NOT NULL DEFAULT 'image/webp',
    "bytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfilePhoto_pkey" PRIMARY KEY ("userId")
);

CREATE UNIQUE INDEX "ProfilePhoto_storageKey_key" ON "ProfilePhoto"("storageKey");

ALTER TABLE "ProfilePhoto" ADD CONSTRAINT "ProfilePhoto_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
