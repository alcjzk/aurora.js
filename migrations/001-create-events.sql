--------------------------------------------------------------------------------
-- Up
--------------------------------------------------------------------------------
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
--------------------------------------------------------------------------------
-- Down
--------------------------------------------------------------------------------
DROP TABLE events;
