-- Launch categories (reference data every environment needs). INSERT IGNORE keeps it idempotent
-- and never overwrites names editors may have changed later.
INSERT IGNORE INTO `video_categories` (`id`, `slug`, `name`, `sort_order`) VALUES
  (UUID(), 'traffic-transport', 'Traffic & Transport', 0),
  (UUID(), 'public-safety', 'Public Safety', 1),
  (UUID(), 'community-voices', 'Community Voices', 2),
  (UUID(), 'environment-sanitation', 'Environment & Sanitation', 3),
  (UUID(), 'government-policy', 'Government & Policy', 4);--> statement-breakpoint
-- The live stream settings row always exists, starting off air.
INSERT IGNORE INTO `live_stream` (`id`, `title`, `status`, `updated_at`) VALUES (1, 'Eye TV Live', 'offline', UTC_TIMESTAMP(3));
