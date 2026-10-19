-- Eye TV no longer takes public submissions; the owner confirmed no earlier citizen data is needed.
UPDATE `live_events` SET `replay_video_id` = NULL WHERE `replay_video_id` IN (SELECT `id` FROM `videos` WHERE `source` = 'citizen');--> statement-breakpoint
DELETE FROM `moderation_reviews` WHERE `video_id` IN (SELECT `id` FROM `videos` WHERE `source` = 'citizen');--> statement-breakpoint
DELETE FROM `videos` WHERE `source` = 'citizen';--> statement-breakpoint
DELETE FROM `media_uploads` WHERE `purpose` = 'citizen';--> statement-breakpoint
DROP TABLE `submitter_contacts`;--> statement-breakpoint
ALTER TABLE `media_uploads` MODIFY COLUMN `purpose` enum('staff') NOT NULL;--> statement-breakpoint
ALTER TABLE `videos` MODIFY COLUMN `source` enum('staff','eye_report') NOT NULL DEFAULT 'staff';--> statement-breakpoint
ALTER TABLE `videos` DROP COLUMN `submitted_media_url`;