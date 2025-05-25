--------------------------------------------------------------------------------
-- Up
--------------------------------------------------------------------------------
ALTER TABLE events ADD COLUMN description TEXT;
ALTER TABLE events ADD COLUMN guild_scheduled_event_id TEXT;
--------------------------------------------------------------------------------
-- Down
--------------------------------------------------------------------------------
CREATE TABLE events_backup AS
SELECT
    id,
    title,
    start,
    end,
    url,
    message_id,
    channel_id,
    attending_ids,
    is_started,
    is_skipped,
    is_notified,
    participant_count
FROM events;

DROP TABLE events;

CREATE TABLE events (
    id PRIMARY KEY NOT NULL,
    title TEXT NOT NULL,
    start INT NOT NULL,
    end INT NOT NULL,
    url TEXT,
    message_id TEXT,
    channel_id TEXT,
    attending_ids TEXT,
    is_started INT NOT NULL,
    is_skipped INT NOT NULL,
    is_notified INT NOT NULL,
    participant_count INT NOT NULL
);

INSERT INTO events (
    id,
    title,
    start,
    end,
    url,
    message_id,
    channel_id,
    attending_ids,
    is_started,
    is_skipped,
    is_notified,
    participant_count
)
SELECT
    id,
    title,
    start,
    end,
    url,
    message_id,
    channel_id,
    attending_ids,
    is_started,
    is_skipped,
    is_notified,
    participant_count
FROM events_backup;

DROP TABLE events_backup;
