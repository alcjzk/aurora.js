import dotenv from 'dotenv';
import { GuildEmoji, ReactionEmoji, ApplicationEmoji } from 'discord.js';
import { Database } from 'sqlite';
import { EventEmitter } from 'node:events';
import * as log from './log.js';

export const DEFAULT_S_INTERVAL_POLL_EVENTS = 60 * 60;
export const DEFAULT_S_INTERVAL_SCHEDULE_EVENTS = 60;
export const DEFAULT_S_BEFORE_ANNOUNCE_EVENT = 60 * 60;
export const DEFAULT_SKIP_POST_NEW_EVENTS = true;
export const DEFAULT_THRESHOLD_EVENT_PARTICIPANTS = 1;
export const DEFAULT_MAX_EVENTS_PER_FETCH = 1000;
export const DEFAULT_EMOJI_VOTE = '✅';
export const DEFAULT_S_MIN_TIME_ALLOW_START = 60 * 60 * 12;
export const DEFAULT_THRESHOLD_MANUAL_START_PARTICIPANTS = 2;
export const DEFAULT_DATABASE_PATH = './db.slite3';
export const DEFAULT_DEBUG_MODE = true;

export class Config extends EventEmitter {
    static UPDATED = Object.freeze('Config.UPDATED');
    static INITIALIZED = Object.freeze('Config.INITIALIZED');
    /**
      * Discord bot token.
      * @type {string}
     **/
    token;
    /**
      * GuildId for the bot.
      * @type {string}
     **/
    guild_id;
    /**
      * ChannelId where to post new events.
      * @type {string | undefined}
     **/
    channel_id_event_vote;
    /**
      * Interval in seconds for polling events.
      * @type {Number}
     **/
    s_interval_poll_events;
    /**
      * Interval in seconds for scheduling events.
      * If an event is created within this time before starting, the event may get skipped.
      * @type {Number}
     **/
    s_interval_schedule_events;
    /**
      * Time in seconds before event start to create channel and announce.
      * @type {Number}
     **/
    s_before_announce_event;
    /**
      * Skip posting messages for new events on startup.
      * Can be used for testing purposes.
      * @type {boolean}
     **/
    skip_post_new_events;
    /**
      * Minimum number of participants before a channel is created for an event.
      * @type {Number}
     **/
    threshold_event_participants;
    /**
      * Maximum number of elements fetched when polling.
      * @type {Number}
     **/
    max_events_per_fetch;
    /**
      * Emoji used for event voting.
      * @type {string | GuildEmoji | ReactionEmoji | ApplicationEmoji}
     **/
    emoji_vote;
    /**
      * Minimum time in seconds before the beginning of an event to allow manual start
      * by non-admin.
      * @type {Number}
     **/
    s_min_time_allow_start;
    /**
      * Minimum number of participants on an event to allow manual start by non-admins.
      * @type {Number}
     **/
    threshold_manual_start_participants;
    /**
      * Debug mode. Causes normally infallible functions to throw errors for easier debugging.
      * @type {boolean}
     **/
    debug_mode;
    /**
      * Path to the database file
      * @type {string}
     **/
    database_path;
    /**
      * Callback triggered when config is updated.
      * @type {function}
     **/
    on_update;

    constructor() {
        super();
        const result = dotenv.config();
        if (result.error !== undefined) {
            console.warn(result.error);
        }

        const env = process.env;

        this.token = env.TOKEN;
        if (this.token === undefined) {
            new Error('no token in config');
        }

        this.guild_id = env.GUILD_ID
        if (this.guild_id === undefined) {
            new Error('no guild_id in config');
        }

        this.s_interval_poll_events = DEFAULT_S_INTERVAL_POLL_EVENTS;
        this.s_interval_schedule_events = DEFAULT_S_INTERVAL_SCHEDULE_EVENTS;
        this.s_before_announce_event = DEFAULT_S_BEFORE_ANNOUNCE_EVENT;
        this.skip_post_new_events = DEFAULT_SKIP_POST_NEW_EVENTS;
        this.threshold_event_participants = DEFAULT_THRESHOLD_EVENT_PARTICIPANTS;
        this.max_events_per_fetch = DEFAULT_MAX_EVENTS_PER_FETCH;
        this.emoji_vote = DEFAULT_EMOJI_VOTE;
        this.s_min_time_allow_start = DEFAULT_S_MIN_TIME_ALLOW_START;
        this.threshold_manual_start_participants = DEFAULT_THRESHOLD_MANUAL_START_PARTICIPANTS;
        this.database_path = env.DATABASE_PATH ?? DEFAULT_DATABASE_PATH;
        this.debug_mode = DEFAULT_DEBUG_MODE;
    }

    /**
      * @param {Database} db 
      * @async
     **/
    async load(db) {
        const map = await db.all('SELECT key, value FROM config');

        this.channel_id_event_vote = map.find(e => e.key == 'channel_id_event_vote')?.value;

        this.on_update = () => this.emit(Config.UPDATED, this);
        if (this.channel_id_event_vote === undefined) {
            this.on_update = () => this.trySetInitialized();
        }

        if (this.debug_mode) {
            log.trac(`config:`);
            console.debug(this);
        }
    }

    trySetInitialized() {
        if (this.channel_id_event_vote === undefined) {
            return;
        }
        this.on_update = () => this.emit(Config.UPDATED, this);
        this.emit(Config.INITIALIZED, this);
    }

    /**
      * @param {Database} db 
      * @param {string} key 
      * @param {string} value 
      * @async
     **/
    async set(db, key, value) {
        this[key] = value;
        const stmt = await db.prepare(
            `INSERT OR REPLACE INTO config (key, value)
             VALUES (?, ?)`
        );
        const result = await stmt.run(key, value);

        if (result.changes !== 1) {
            throw Error('unexpected number of changes in config set');
        }

        this.on_update();
    }
}

