CREATE TABLE `media_uploads` (
	`id` char(36) NOT NULL,
	`purpose` enum('citizen','staff') NOT NULL,
	`status` enum('uploading','complete','attached') NOT NULL DEFAULT 'uploading',
	`token_hash` char(64) NOT NULL,
	`original_name` varchar(200) NOT NULL,
	`mime_type` varchar(60) NOT NULL,
	`size_bytes` bigint NOT NULL,
	`received_bytes` bigint NOT NULL DEFAULT 0,
	`uploaded_by` char(36),
	`ip_hash` char(64),
	`created_at` datetime(3) NOT NULL,
	`completed_at` datetime(3),
	CONSTRAINT `media_uploads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `videos` MODIFY COLUMN `provider` enum('youtube','upload') NOT NULL DEFAULT 'youtube';--> statement-breakpoint
ALTER TABLE `media_uploads` ADD CONSTRAINT `media_uploads_uploaded_by_users_id_fk` FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `media_uploads_status_created_idx` ON `media_uploads` (`status`,`created_at`);