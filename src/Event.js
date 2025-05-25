import { ChannelType, GuildScheduledEventPrivacyLevel, GuildScheduledEventEntityType } from 'discord.js';
import util from './util.js';
import templates from './templates.js';
import * as log from './log.js';
import * as discord from './discord.js';

/**
  * @typedef {import('discord.js').Message} Message
  * @typedef {import('discord.js').Client} Client
  * @typedef {import('discord.js').TextChannel} TextChannel
  * @typedef {import('discord.js').Snowflake} Snowflake
  * @typedef {import('discord.js').GuildScheduledEvent} GuildScheduledEvent
  * @typedef {import('sqlite').Database} Database
  * @typedef {import('./Config.js').Config} Config
  * @typedef {import('./Context.js').Context} Context
  * @typedef {import('./ctftime.js').EventData} EventData
 **/

class Event {
    /** @type {Number} */
    id;
    /** @type {string} */
    title;
    /** @type {Number} - unix time */
    start;
    /** @type {Number} - unix time */
    end;
    /** @type {string} */
    url;
    /** @type {Snowflake | undefined} */
    message_id;
    /** @type {Snowflake | undefined} */
    channel_id;
    /** @type {Snowflake[]} */
    attending_ids;
    /** @type {boolean} */
    is_started;
    /** @type {boolean} */
    is_skipped;
    /** @type {boolean} */
    is_notified;
    /** @type {Number} */
    participant_count;
    /** @type {Snowflake | undefined} */
    guild_scheduled_event_id;
    /** @type {string | undefined} */
    description;

    /**
      * @param {Context} ctx
      * @returns {Promise<GuildScheduledEvent>}
      * @throws
     **/
    async createGuildScheduledEvent(ctx) {
        log.trac(`creating guild scheduled event for event '${this.title}'`);

        const guild = ctx.guild();

        const GUILD_SCHEDULED_EVENT_MAX_DESCRIPTION_LENGTH = 1000;

        /** @type {import('discord.js').GuildScheduledEventCreateOptions)} */
        const create_options = {};
        create_options.name = this.title;
        create_options.privacyLevel = GuildScheduledEventPrivacyLevel.GuildOnly;
        create_options.scheduledStartTime = this.start * 1000;
        create_options.scheduledEndTime = this.end * 1000;
        create_options.entityType = GuildScheduledEventEntityType.External;
        create_options.entityMetadata = { location: this.messageUrl(ctx.config) };
        create_options.description = this.description === undefined ? undefined :
            util.truncateToLengthWithEllipsis(this.description, GUILD_SCHEDULED_EVENT_MAX_DESCRIPTION_LENGTH);

        const scheduled_event = await guild.scheduledEvents.create(create_options);

        this.guild_scheduled_event_id = scheduled_event.id;
        await this.update(ctx.db);

        return scheduled_event;
    }
    /**
      * @param {Context} ctx
      * @throws
      * @returns {Promise<GuildScheduledEvent | undefined>}
     **/
    async guildScheduledEvent(ctx) {
        log.trac(`fetching guild scheduled event with id '${this.guild_scheduled_event_id}'`);

        const guild = ctx.guild();

        if (this.guild_scheduled_event_id === undefined) {
            return undefined;
        }

        return await guild.scheduledEvents.fetch(this.guild_scheduled_event_id);
    }
    /**
      * @param {Context} ctx
      * @throws
      * @async
     **/
    async deleteGuildScheduledEvent(ctx) {
        log.trac(`deleting guild scheduled event for event '${this.title}'`);
        const scheduled_event = await this.guildScheduledEvent(ctx);
        await scheduled_event?.delete();
    }
    /**
      * @returns {boolean}
     **/
    shouldExpire() {
        return util.now() > this.end;
    }
    /**
      * @param {Context} ctx
      * @throws
      * @async
     **/
    async notifyParticipantThresholdReached(ctx) {
        if (this.is_notified) {
            return;
        }

        const message = await this.message(ctx.config, ctx.client);

        this.is_notified = true;
        await this.update(ctx.db);

        for (const id of this.attending_ids) {
            try {
                const dm_channel = await ctx.client.users.createDM(id);
                await dm_channel.send(templates.participantThresholdReached(this.title, this.start, message.url));
            }
            catch (error) {
                console.warn(`failed to dm user ${id}`);
                console.warn(error);
            }
        }

        await this.createGuildScheduledEvent(ctx);
    }
    /**
      * @param {Context} ctx
      * @async
     **/
    async tryStart(ctx) {
        if (this.is_skipped) {
            log.info(`event '${this.title}' is marked as skipped and wont be started automatically`);
            return;
        }

        if (this.attending_ids.length < ctx.config.threshold_event_participants) {
            log.info(`event '${this.title}' does not have enough participants and wont be started automatically`);
            await this.skip(ctx);
            return;
        }

        if (this.is_started) {
            log.warn(`event '${this.title}' has already been started`);
            return;
        }

        log.info(`starting event '${this.title}'`);

        await this.doStart(ctx, false);
    }
    /**
      * Start the event.
      *
      * @param {Context} ctx
      * @param {boolean} force - start the event regardless of being skipped
      * @throws If the event was already started or has ended.
      * @async
     **/
    async doStart(ctx, force) {
        if (this.is_started) {
            throw Error('Event was already started');
        }

        if (this.is_skipped && !force) {
            return;
        }

        const guild = ctx.guild();

        const channel = await guild.channels.create({
            type: ChannelType.GuildText,
            name: this.title,
        });

        this.channel_id = channel.id;
        this.is_started = true;
        this.is_skipped = false;

        await this.update(ctx.db);

        const mentions = this.attending_ids.map(id => `<@${id}>`).join(' ');
        const message_content = `${this.title} is starting soon!\n${mentions}`;
        await channel.send(message_content);

        const message = await this.message(ctx.config, ctx.client);
        var embed = util.setEmbedFieldByName(message.embeds[0], 'Status', `Started <#${channel.id}>`, false);
        embed = util.setEmbedColor(embed, 0x2FDE5D);
        await message.edit({ embeds: [embed] });
        await message.reactions.removeAll();

        const guild_scheduled_event = this.guild_scheduled_event_id === undefined
            ? await this.createGuildScheduledEvent(ctx)
            : await this.guildScheduledEvent(ctx);

        await guild_scheduled_event?.setLocation(`<#${channel.id}>`);
    }
    /**
      * Deletes the event and updates or deletes the associated message.
      *
      * @param {Config} config
      * @param {Database} db
      * @param {Client} client
      * @async
     **/
    async expire(config, db, client) {
        await this.delete(db);

        const message = await this.message(config, client);

        if (message === undefined) {
            return;
        }

        if (!this.is_started) {
            await message.delete();
            return;
        }

        var embed = util.setEmbedFieldByName(message.embeds[0], 'Status', `Ended <#${this.channel_id}>`, false);
        embed = util.setEmbedColor(embed, 0x3B6961);
        await message.edit({ embeds: [embed] });
        await message.reactions.removeAll();
    }
    /**
      * Disable voting for the event and prevent automatic start.
      *
      * @param {Context} ctx
      * @return {Promise<bool>} true if the event was succesfully marked skipped.
     **/
    async skip(ctx) {
        if (this.is_skipped | this.is_started | this.shouldExpire()) {
            return false;
        }

        this.is_skipped = true;
        await this.update(ctx.db);

        const message = await this.message(ctx.config, ctx.client);

        if (message === undefined) {
            return true;
        }

        var embed = util.setEmbedFieldByName(message.embeds[0], 'Status', 'Skipped', false);
        embed = util.setEmbedColor(embed, 0x8A8A8A);
        await message.edit({ embeds: [embed] });
        await message.reactions.removeAll();
        await this.deleteGuildScheduledEvent(ctx);
    }
    /**
      * @param {Config} config
      * @param {Database} db
      * @param {Client} client
      * @param {string[]} ids
      * @async
     **/
    async updateAttendingIds(config, db, client, ids) {
        this.attending_ids = ids;

        await this.update(db);

        const mentions = this.attending_ids.map(id => `<@${id}>`).join(' ');
        const message = await this.message(config, client);
        const embed = util.setEmbedFieldByName(message.embeds[0], 'Would Join', mentions);
        await message.edit({ embeds: [embed] });
    }
    /**
      * @param {Config} config
      * @param {Database} db
      * @param {Client} client
      * @param {Number} count
      * @async
     **/
    async updateParticipantCount(config, db, client, count) {
        if (count === this.participant_count) {
            return;
        }

        try {
            this.participant_count = count;
            await this.update(db);
            const message = await this.message(config, client);

            if (message === undefined) {
                return;
            }

            const embed = util.setEmbedFieldByName(message.embeds[0], 'Teams', count);
            await message.edit({ embeds: [embed] });
        }
        catch (error) {
            log.warn(`failed to update participant count for event id ${this.id}:`)
            log.warn(error);
        }
    }
    /**
      * @param {Context} ctx
      * @async
     **/
    async schedule(ctx) {
        const now = util.now();
        const s_until_end = Math.max(this.end - now, 0);
        const s_until_start = this.start - now;

        if (this.shouldExpire()) {
            log.info(`event '${this.title}' has expired`);
            await this.expire(ctx.config, ctx.db, ctx.client);
            return;
        }

        // TODO:  If event is already scheduled, skip
        if (s_until_start < 0 && s_until_end > 0 && !this.is_skipped) {
            log.warn(`start of event '${this.title}' was missed`);
        }

        if (this.is_started) {
            return;
        }

        if (s_until_end <= ctx.config.s_interval_schedule_events) {
            log.info(`event '${this.title}' is scheduled to expire`);
            setTimeout(
                () => {
                    log.info(`event '${this.title}' has expired`);
                    this.expire(ctx.config, ctx.db, ctx.client);
                },
                s_until_end * 1000,
            );
        }

        if (s_until_start <= ctx.config.s_interval_schedule_events && !this.is_skipped) {
            const timeout = Math.max(0, s_until_start - ctx.config.s_before_announce_event);
            log.info(`event '${this.title}' is scheduled to start in ${timeout} seconds`);

            setTimeout(
                () => Event.select(ctx.db, this.id)
                    .then(event => event.tryStart(ctx)),
                timeout * 1000,
            );
        }
    }
    /**
      * @param {Config} config
      * @param {Client} client
      * @returns {Promise<Message | undefined>}
     **/
    async message(config, client) {
        if (this.message_id === undefined || this.message_id === null) {
            return undefined;
        }

        if (!config.channel_id_event_vote) {
            return undefined;
        }

        /** @type {TextChannel} */
        const channel = client.channels.cache.get(config.channel_id_event_vote);
        const message = await channel?.messages.fetch(this.message_id);

        return message;
    }
    /**
      * @param {Config} config
      * @returns {Snowflake | undefined}
      **/
    messageUrl(config) {
        if (!this.message_id) {
            return undefined;
        }
        return discord.messageUrl(config.guild_id, config.channel_id_event_vote, this.message_id);
    }
    /**
      * @param {Client} client
      * @returns {Promise<Channel | undefined>}
     **/
    async channel(client) {
        if (this.channel_id === undefined || this.channel_id === null) {
            return undefined;
        }

        return await client.channels.fetch(this.channel_id);
    }
    /**
      * @param {Database} db
      * @async
     **/
    async insert(db) {
        try {
            const stmt = await db.prepare(`
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
                    participant_count,
                    guild_scheduled_event_id,
                    description
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            const { changes } = await stmt.run(
                this.id,
                this.title,
                this.start,
                this.end,
                this.url,
                this.message_id,
                this.channel_id,
                JSON.stringify(this.attending_ids),
                this.is_started,
                this.is_skipped,
                this.is_notified,
                this.participant_count,
                this.guild_scheduled_event_id,
                this.description,
            );

            if (changes !== 1) {
                log.erro(`unexpected number of changes '${changes}' inserting event id ${this.id}`);
            }
        }
        catch (error) {
            console.error(`failed to insert event id ${this.id}: ${error}`)
        }
    }
    /**
      * @param {Database} db
      * @async
     **/
    async update(db) {
        try {
            const stmt = await db.prepare(`
                UPDATE events
                SET
                    title = ?,
                    start = ?,
                    end = ?,
                    url = ?,
                    message_id = ?,
                    channel_id = ?,
                    attending_ids = ?,
                    is_started = ?,
                    is_skipped = ?,
                    is_notified = ?,
                    participant_count = ?,
                    guild_scheduled_event_id = ?,
                    description = ?
                WHERE id = ?
            `);

            const { changes } = await stmt.run(
                this.title,
                this.start,
                this.end,
                this.url,
                this.message_id,
                this.channel_id,
                JSON.stringify(this.attending_ids),
                this.is_started,
                this.is_skipped,
                this.is_notified,
                this.participant_count,
                this.guild_scheduled_event_id,
                this.description,
                this.id,
            );

            if (changes !== 1) {
                log.erro(`unexpected number of changes '${changes}' updating event id ${this.id}`);
            }
        }
        catch (error) {
            log.erro(`failed to update event id ${this.id}`);
            console.error(error);
        }
    }
    /**
      * @param {Database} db
      * @async
     **/
    async delete(db) {
        try {
            const stmt = await db.prepare(`
                DELETE FROM events WHERE id = ?
            `);

            const { changes } = await stmt.run(this.id);

            if (changes === undefined || changes > 1) {
                log.erro(`unexpected number of changes '${changes}' deleting event id ${this.id}`);
            }
        }
        catch (error) {
            log.erro(`failed to delete event id ${this.id}:`);
            console.error(error);
        }
    }
    /**
      * @param {Database} db
      * @returns {Promise<Event[]>}
     **/
    static async selectAll(db) {
        const raw_events = await db.all('SELECT * FROM events');
        return raw_events.map(r => {
            const event = Object.assign(new Event, r);
            event.attending_ids = JSON.parse(event.attending_ids);
            event.guild_scheduled_event_id = event.guild_scheduled_event_id === null ? undefined : event.guild_scheduled_event_id;
            event.description = event.description === null ? undefined : event.description;
            return event;
        });
    }

    /**
      * @param {Database} db
      * @param {Number} id
      * @returns {Promise<Event | undefined>}
     **/
    static async select(db, id) {
        const stmt = await db.prepare('SELECT * FROM events WHERE id = ?');
        const raw_event = await stmt.get(id);
        if (raw_event === undefined) {
            return undefined;
        }
        const event = Object.assign(new Event, raw_event);
        event.attending_ids = JSON.parse(event.attending_ids);
        event.guild_scheduled_event_id = event.guild_scheduled_event_id === null ? undefined : event.guild_scheduled_event_id;
        event.description = event.description === null ? undefined : event.description;
        return event;
    }

    /**
      * @param {Database} db
      * @returns {Promise<Number>}
     **/
    static async count(db) {
        const result = await db.get('SELECT COUNT(*) FROM events');

        return result['COUNT(*)'];
    }

    /**
      * @param {Database} db
      * @param {string} message_id
      * @returns {Promise<Event | undefined>}
     **/
    static async selectByMessageId(db, message_id) {
        const stmt = await db.prepare('SELECT * FROM events WHERE message_id = ?');
        const raw_event = await stmt.get(message_id);
        if (raw_event === undefined) {
            return undefined;
        }
        const event = Object.assign(new Event(), raw_event);
        event.attending_ids = JSON.parse(event.attending_ids);
        event.guild_scheduled_event_id = event.guild_scheduled_event_id === null ? undefined : event.guild_scheduled_event_id;
        event.description = event.description === null ? undefined : event.description;
        return event;
    }

    /**
      * @param {Database} db
      * @param {EventData} data
      * @returns {Event}
     **/
    static fromData(data) {
        const event = new Event();

        event.id = data.id;
        event.title = data.title;
        event.start = util.stringToTimestamp(data.start);
        event.end = util.stringToTimestamp(data.finish);
        event.url = data.url;
        event.is_started = false;
        event.is_skipped = false;
        event.is_notified = false;
        event.participant_count = data.participants;
        event.attending_ids = [];
        event.description = data.description;

        return event;
    }
}

export default Event;
