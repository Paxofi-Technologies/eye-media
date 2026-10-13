CREATE TABLE `audit_log` (
	`id` char(36) NOT NULL,
	`actor_id` char(36),
	`actor_name` varchar(120) NOT NULL,
	`action` varchar(60) NOT NULL,
	`target_type` varchar(40) NOT NULL,
	`target_id` varchar(64),
	`target_label` varchar(200),
	`notes` text,
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `audit_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `live_stream` (
	`id` int NOT NULL DEFAULT 1,
	`title` varchar(200) NOT NULL DEFAULT 'Eye TV Live',
	`description` text,
	`category_id` char(36),
	`youtube_video_id` varchar(64),
	`status` enum('offline','live') NOT NULL DEFAULT 'offline',
	`started_at` datetime(3),
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `live_stream_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `moderation_reviews` (
	`id` char(36) NOT NULL,
	`video_id` char(36) NOT NULL,
	`reviewer_id` char(36),
	`decision` enum('approved','rejected','flagged','note') NOT NULL,
	`notes` text,
	`checklist` text NOT NULL,
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `moderation_reviews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `schedule_items` (
	`id` char(36) NOT NULL,
	`starts_at` datetime(3) NOT NULL,
	`title` varchar(200) NOT NULL,
	`category_id` char(36),
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `schedule_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` char(64) NOT NULL,
	`user_id` char(36) NOT NULL,
	`expires_at` datetime(3) NOT NULL,
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `submitter_contacts` (
	`video_id` char(36) NOT NULL,
	`reference` varchar(20) NOT NULL,
	`name` varchar(120) NOT NULL,
	`email` varchar(254),
	`phone` varchar(40),
	`ip_hash` char(64),
	`consent_at` datetime(3) NOT NULL,
	CONSTRAINT `submitter_contacts_video_id` PRIMARY KEY(`video_id`),
	CONSTRAINT `submitter_contacts_reference_unique` UNIQUE(`reference`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` char(36) NOT NULL,
	`email` varchar(254) NOT NULL,
	`name` varchar(120) NOT NULL,
	`title` varchar(160),
	`role` enum('admin','editor','moderator','media_manager','reporter') NOT NULL DEFAULT 'reporter',
	`password_hash` varchar(255) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`last_login_at` datetime(3),
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `video_categories` (
	`id` char(36) NOT NULL,
	`slug` varchar(80) NOT NULL,
	`name` varchar(120) NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `video_categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `video_categories_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `videos` (
	`id` char(36) NOT NULL,
	`slug` varchar(160) NOT NULL,
	`title` varchar(200) NOT NULL,
	`summary` varchar(400),
	`description` text,
	`category_id` char(36),
	`source` enum('staff','citizen') NOT NULL DEFAULT 'staff',
	`provider` enum('youtube') NOT NULL DEFAULT 'youtube',
	`provider_ref` varchar(64),
	`submitted_media_url` varchar(500),
	`thumbnail_url` varchar(500),
	`duration_seconds` int,
	`location` varchar(160),
	`tags` text NOT NULL,
	`reporter_name` varchar(120),
	`reporter_id` char(36),
	`status` enum('draft','pending','flagged','published','rejected','unpublished') NOT NULL DEFAULT 'draft',
	`sensitive` boolean NOT NULL DEFAULT false,
	`verified` boolean NOT NULL DEFAULT false,
	`featured` boolean NOT NULL DEFAULT false,
	`editors_pick` boolean NOT NULL DEFAULT false,
	`view_count` int NOT NULL DEFAULT 0,
	`published_at` datetime(3),
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `videos_id` PRIMARY KEY(`id`),
	CONSTRAINT `videos_slug_idx` UNIQUE(`slug`)
);
--> statement-breakpoint
ALTER TABLE `audit_log` ADD CONSTRAINT `audit_log_actor_id_users_id_fk` FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `live_stream` ADD CONSTRAINT `live_stream_category_id_video_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `video_categories`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `moderation_reviews` ADD CONSTRAINT `moderation_reviews_video_id_videos_id_fk` FOREIGN KEY (`video_id`) REFERENCES `videos`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `moderation_reviews` ADD CONSTRAINT `moderation_reviews_reviewer_id_users_id_fk` FOREIGN KEY (`reviewer_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `schedule_items` ADD CONSTRAINT `schedule_items_category_id_video_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `video_categories`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `submitter_contacts` ADD CONSTRAINT `submitter_contacts_video_id_videos_id_fk` FOREIGN KEY (`video_id`) REFERENCES `videos`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `videos` ADD CONSTRAINT `videos_category_id_video_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `video_categories`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `videos` ADD CONSTRAINT `videos_reporter_id_users_id_fk` FOREIGN KEY (`reporter_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `audit_log_created_idx` ON `audit_log` (`created_at`);--> statement-breakpoint
CREATE INDEX `audit_log_action_idx` ON `audit_log` (`action`);--> statement-breakpoint
CREATE INDEX `moderation_reviews_video_idx` ON `moderation_reviews` (`video_id`);--> statement-breakpoint
CREATE INDEX `schedule_items_starts_idx` ON `schedule_items` (`starts_at`);--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `sessions_expires_idx` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE INDEX `videos_status_published_idx` ON `videos` (`status`,`published_at`);--> statement-breakpoint
CREATE INDEX `videos_category_idx` ON `videos` (`category_id`);