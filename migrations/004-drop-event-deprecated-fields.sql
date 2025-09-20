--------------------------------------------------------------------------------
-- Up
--------------------------------------------------------------------------------
ALTER TABLE events RENAME TO events_old;

CREATE TABLE events (
    id PRIMARY KEY NOT NULL,
    title TEXT NOT NULL,
    start INT NOT NULL,
    end INT NOT NULL,
    url TEXT,
    message_id TEXT,
    channel_id TEXT,
    attending_ids TEXT,
    participant_count INT NOT NULL,
    flags INT NOT NULL DEFAULT 0
);

INSERT INTO events (id, title, start, end, url, message_id, channel_id, attending_ids, participant_count, flags)
SELECT id, title, start, end, url, message_id, channel_id, attending_ids, participant_count, flags FROM events_old;

DROP TABLE events_old;
--------------------------------------------------------------------------------
-- Down
--------------------------------------------------------------------------------

