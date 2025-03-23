import { Client, Message, ChannelType, TextChannel, ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';
import { Database } from 'sqlite';
import { Config } from './Config.js';
import { EventData } from './ctftime.js';
import util from './util.js';
import templates from './templates.js';

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
    /** @type {string} */
    message_id;
    /** @type {string} */
    channel_id;
    /** @type {string[]} */
    attending_ids;
    /** @type {boolean} */
    is_started;
    /** @type {boolean} */
    is_skipped;
    /** @type {boolean} */
    is_notified;
    /** @type {Number} */
    participant_count;

    shouldExpire() {
        return util.now() > this.end;
    }


    /** @param {Config} config
      * @returns {<ButtonComponent>[]}
      *
     **/
    messageComponents(config) {
        /** @type {ButtonComponent} */
        var join_button = new ButtonBuilder({
            customId: 'join',
            disabled: false,
            label: 'Join',
            style: ButtonStyle.Primary,
            emoji: config.emoji_vote,
        });

        var button_row = new ActionRowBuilder([join_button]);

        return button_row.data();
    }

    /**
      * @async
      * @param {Config} config
      * @param {Database} db
      * @param {Client} client
     **/
    async notifyParticipantThresholdReached(config, db, client) {
        if (this.is_notified) {
            return;
        }

        const message = await this.message(config, client);

        this.is_notified = true;
        await this.update(db);

        for (const id of this.attending_ids) {
            try {
                const dm_channel = await client.users.createDM(id);
                await dm_channel.send(templates.participantThresholdReached(this.title, this.start, message.url));
            }
            catch (error) {
                console.warn(`failed to dm user ${id}`);
                console.warn(error);
            }
        }
    }

    /**
      * Start the event.
      * @async
      * @param {Config} config
      * @param {Database} db
      * @param {Client} client
      * @param {boolean} force - start the event regardless of being skipped
      * @throws If the event was already started or has ended.
     **/
    async doStart(config, db, client, force) {
        if (this.is_started) {
            throw Error('Event was already started');
        }

        if (this.is_skipped && !force) {
            return;
        }

        const channel = await client.guilds.cache.get(config.guild_id).channels.create({
            type: ChannelType.GuildText,
            name: this.title,
        });

        this.channel_id = channel.id;
        this.is_started = true;
        this.is_skipped = false;

        await this.update(db);

        const mentions = this.attending_ids.map(id => `<@${id}>`).join(' ');
        const message_content = `${this.title} is starting soon!\n${mentions}`;
        await channel.send(message_content);

        const message = await this.message(config, client);
        var embed = util.setEmbedFieldByName(message.embeds[0], 'Status', `Started <#${channel.id}>`, false);
        embed = util.setEmbedColor(embed, 0x2FDE5D);
        await message.edit({ embeds: [embed] });
        await message.reactions.removeAll();
    }

    /**
      * Deletes the event and updates or deletes the associated message.
      * @async
      * @param {Config} config
      * @param {Database} db
      * @param {Client} client
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
      * @async
      * @param {Config} config
      * @param {Database} db
      * @param {Client} client
      * @return {Promise<bool>} true if the event was succesfully marked skipped.
     **/
    async skip(config, db, client) {
        if (this.is_skipped | this.is_started | this.shouldExpire()) {
            return false;
        }

        this.is_skipped = true;
        await this.update(db);

        const message = await this.message(config, client);

        if (message === undefined) {
            return true;
        }

        var embed = util.setEmbedFieldByName(message.embeds[0], 'Status', 'Skipped', false);
        embed = util.setEmbedColor(embed, 0x8A8A8A);
        await message.edit({ embeds: [embed] });
        await message.reactions.removeAll();
    }

    /**
      * @async
      * @param {Config} config
      * @param {Database} db
      * @param {Client} client
      * @param {string[]} ids
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
      * @async
      * @param {Config} config
      * @param {Database} db
      * @param {Client} client
      * @param {Number} count
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
            console.warn(`failed to update event message participant count:`);
            console.warn(error);
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
      * @async
      * @param {Database} db
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
                    participant_count
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            const result = await stmt.run(
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
            );

            if (result.changes !== 1) {
                console.error(`unexpected number of changes for event id ${this.id}`);
            }
        }
        catch (error) {
            console.error(`failed to insert event id ${this.id}: ${error}`)
        }
    }

    /**
      * @async 
      * @param {Database} db
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
                    participant_count = ?
                WHERE id = ?
            `);

            const result = await stmt.run(
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
                this.id,
            );

            if (result.changes !== 1) {
                console.error(`unexpected number of changes for event id ${this.id}`);
            }
        }
        catch (error) {
            console.error(`failed to update event id ${this.id}`);
            console.error(error);
        }
    }

    /**
      * @async 
      * @param {Database} db
     **/
    async delete(db) {
        try {
            const stmt = await db.prepare(`
                DELETE FROM events WHERE id = ?
            `);

            const result = await stmt.run(this.id);

            if (result.changes !== 1) {
                console.error(`unexpected number of changes for event id ${this.id}`);
            }
        }
        catch (error) {
            console.error(`failed to delete event id ${this.id}: ${error}`);
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
        return event;
    }

    /**
      * @async 
      * @param {Database} db
     **/
    static async createTable(db) {
        await db.run(`
            CREATE TABLE events(
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
            )
        `);
    }

    /**
      * @param {Database} db
      * @returns {Promise<boolean>} 
     **/
    static async tableExists(db) {
        const name = await db.get(`
            SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'events' LIMIT 1
        `);

        if (name === undefined) {
            return false;
        }
        return true;
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

        return event;
    }
}

export default Event;
