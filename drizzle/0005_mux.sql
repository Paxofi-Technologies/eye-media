CREATE TABLE `mux_events` (
	`id` varchar(64) NOT NULL,
	`type` varchar(80) NOT NULL,
	`object_id` varchar(64),
	`received_at` datetime(3) NOT NULL,
	`processed_at` datetime(3),
	`error` text,
	CONSTRAINT `mux_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `live_events` MODIFY COLUMN `provider` enum('youtube','upload','mux') NOT NULL DEFAULT 'mux';--> statement-breakpoint
ALTER TABLE `videos` MODIFY COLUMN `provider` enum('youtube','upload','mux') NOT NULL DEFAULT 'youtube';--> statement-breakpoint
ALTER TABLE `live_events` ADD `mux_live_stream_id` varchar(64);--> statement-breakpoint
ALTER TABLE `live_events` ADD `mux_private_playback_id` varchar(64);--> statement-breakpoint
ALTER TABLE `live_events` ADD `mux_public_playback_id` varchar(64);--> statement-breakpoint
ALTER TABLE `live_events` ADD `recording_asset_id` varchar(64);--> statement-breakpoint
ALTER TABLE `live_events` ADD `auto_live` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `media_uploads` ADD `mux_upload_id` varchar(64);--> statement-breakpoint
ALTER TABLE `media_uploads` ADD `mux_asset_id` varchar(64);--> statement-breakpoint
ALTER TABLE `videos` ADD `mux_asset_id` varchar(64);--> statement-breakpoint
ALTER TABLE `videos` ADD `mux_private_playback_id` varchar(64);--> statement-breakpoint
ALTER TABLE `videos` ADD `mux_public_playback_id` varchar(64);--> statement-breakpoint
ALTER TABLE `videos` ADD `media_status` enum('ready','processing','errored') DEFAULT 'ready' NOT NULL;--> statement-breakpoint
CREATE INDEX `mux_events_received_idx` ON `mux_events` (`received_at`);--> statement-breakpoint
CREATE INDEX `live_events_mux_stream_idx` ON `live_events` (`mux_live_stream_id`);--> statement-breakpoint
CREATE INDEX `videos_mux_asset_idx` ON `videos` (`mux_asset_id`);