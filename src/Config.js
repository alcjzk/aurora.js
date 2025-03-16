import dotenv from 'dotenv';
import { GuildEmoji, ReactionEmoji, ApplicationEmoji } from 'discord.js';

export const DEFAULT_S_INTERVAL_POLL_EVENTS = 60 * 60;
export const DEFAULT_S_INTERVAL_SCHEDULE_EVENTS = 60 * 60 * 24;
export const DEFAULT_S_BEFORE_ANNOUNCE_EVENT = 60 * 60 * 2;
export const DEFAULT_SKIP_POST_NEW_EVENTS = false;
export const DEFAULT_THRESHOLD_EVENT_PARTICIPANTS = 4;
export const DEFAULT_MAX_EVENTS_PER_FETCH = 4;
export const DEFAULT_EMOJI_VOTE = '✅';

export class Config {
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
      * @type {string}
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

    constructor() {
        const result = dotenv.config();
        if (result.error !== undefined) {
            console.warn(error);
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

        this.channel_id_event_vote = env.CHANNEL_ID_EVENT_VOTE;
        if (this.channel_id_event_vote === undefined) {
            new Error('no channel_id in config');
        }

        this.s_interval_poll_events = env.S_INTERVAL_POLL_EVENTS ?? DEFAULT_S_INTERVAL_POLL_EVENTS;
        this.s_interval_schedule_events = env.S_INTERVAL_SCHEDULE_EVENTS ?? DEFAULT_S_INTERVAL_SCHEDULE_EVENTS;
        this.s_before_announce_event = env.S_BEFORE_ANNOUNCE_EVENT ?? DEFAULT_S_BEFORE_ANNOUNCE_EVENT;
        this.skip_post_new_events = env.SKIP_POST_NEW_EVENTS ?? DEFAULT_SKIP_POST_NEW_EVENTS;
        this.threshold_event_participants = env.TRESHOLD_EVENT_PARTICIPANTS ?? DEFAULT_THRESHOLD_EVENT_PARTICIPANTS;
        this.max_events_per_fetch = env.MAX_EVENTS_PER_FETCH ?? DEFAULT_MAX_EVENTS_PER_FETCH;
        this.emoji_vote = env.EMOJI_VOTE ?? DEFAULT_EMOJI_VOTE;
    }
}

