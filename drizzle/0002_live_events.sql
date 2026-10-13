CREATE TABLE `live_events` (
	`id` char(36) NOT NULL,
	`title` varchar(200) NOT NULL,
	`description` text,
	`category_id` char(36),
	`city` varchar(80),
	`venue` varchar(160),
	`provider` enum('youtube') NOT NULL DEFAULT 'youtube',
	`provider_ref` varchar(64),
	`status` enum('scheduled','live','ended','cancelled') NOT NULL DEFAULT 'scheduled',
	`featured` boolean NOT NULL DEFAULT false,
	`starts_at` datetime(3) NOT NULL,
	`ends_at` datetime(3),
	`started_at` datetime(3),
	`ended_at` datetime(3),
	`replay_video_id` char(36),
	`created_by` char(36),
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `live_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `live_events` ADD CONSTRAINT `live_events_category_id_video_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `video_categories`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `live_events` ADD CONSTRAINT `live_events_replay_video_id_videos_id_fk` FOREIGN KEY (`replay_video_id`) REFERENCES `videos`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `live_events` ADD CONSTRAINT `live_events_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `live_events_starts_idx` ON `live_events` (`starts_at`);--> statement-breakpoint
CREATE INDEX `live_events_status_idx` ON `live_events` (`status`,`starts_at`);