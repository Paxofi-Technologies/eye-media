-- Copy the pre-multi-stream data into live_events so nothing on existing installs is lost.
-- Old schedule slots: past ones (2h+ ago) become 'ended', the rest stay 'scheduled'.
INSERT INTO `live_events` (`id`, `title`, `category_id`, `status`, `starts_at`, `created_at`, `updated_at`)
SELECT `id`, `title`, `category_id`,
       IF(`starts_at` < UTC_TIMESTAMP(3) - INTERVAL 2 HOUR, 'ended', 'scheduled'),
       `starts_at`, `created_at`, UTC_TIMESTAMP(3)
FROM `schedule_items`;--> statement-breakpoint
-- The old single live slot: carried over only if it was actually on air with a video attached.
INSERT INTO `live_events` (`id`, `title`, `description`, `category_id`, `provider_ref`, `status`, `featured`,
                           `starts_at`, `started_at`, `created_at`, `updated_at`)
SELECT UUID(), `title`, `description`, `category_id`, `youtube_video_id`, 'live', true,
       COALESCE(`started_at`, UTC_TIMESTAMP(3)), `started_at`, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3)
FROM `live_stream`
WHERE `id` = 1 AND `status` = 'live' AND `youtube_video_id` IS NOT NULL;
