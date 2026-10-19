CREATE TABLE `eye_report_events` (
	`id` char(36) NOT NULL,
	`video_id` char(36),
	`external_ref` varchar(100) NOT NULL,
	`event` enum('published','rejected','unpublished') NOT NULL,
	`created_at` datetime(3) NOT NULL,
	`attempts` int NOT NULL DEFAULT 0,
	`next_attempt_at` datetime(3) NOT NULL,
	`delivered_at` datetime(3),
	`last_error` text,
	CONSTRAINT `eye_report_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `eye_report_events` ADD CONSTRAINT `eye_report_events_video_id_videos_id_fk` FOREIGN KEY (`video_id`) REFERENCES `videos`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `eye_report_events_due_idx` ON `eye_report_events` (`delivered_at`,`next_attempt_at`);