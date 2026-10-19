ALTER TABLE `videos` ADD `external_ref` varchar(100);--> statement-breakpoint
ALTER TABLE `videos` ADD CONSTRAINT `videos_external_ref_uq` UNIQUE(`external_ref`);