import { Client, Message, ChannelType } from 'discord.js';
import { Database } from 'sqlite';
import { Config } from './Config.js';
import util from './util.js';

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
    is_canceled;

    isExpired() {
        return this.start < util.now() && !this.is_started;
    }

    /**
      * @async
      * @param {Config} config
      * @param {Database} db
      * @param {Client} client
     **/
    async doStart(config, db, client) {
        if (this.is_started) {
            throw Error('event was already started');
        }
        if (this.is_canceled) {
            throw Error('cannot start an event that has been canceled');
        }
        if (this.isExpired()) {
            throw Error('event has expired');
        }

        const channel = await client.guilds.cache.get(config.guild_id).channels.create({
            type: ChannelType.GuildText,
            name: this.title,
        });
        this.channel_id = channel.id;
        this.is_started = true;

        await this.update(db);

        const mentions = this.attending_ids.map(id => `<@${id}>`).join(' ');
        const message_content = `${this.title} is starting soon!\n${mentions}`;
        await channel.send(message_content);

        const message = await this.message(config, client);
        const embed = util.setEmbedFieldByName(message.embeds[0], 'Status', `started <#${channel.id}>`, false);
        await message.edit({ embeds: [embed] });
        await message.reactions.removeAll();
    }

    /**
      * @async
      * @param {Config} config
      * @param {Database} db
      * @param {Client} client
     **/
    async cancel(config, db, client) {
        if (this.is_started) {
            throw Error('cannot cancel an event that has already started');
        }
        if (this.is_canceled) {
            throw Error('event is already canceled');
        }
        if (this.isExpired()) {
            throw Error('cannot cancel an event that has expired');
        }

        this.is_canceled = true;
        await this.update(db);

        const message = await this.message(config, client);
        const embed = util.setEmbedFieldByName(message.embeds[0], 'Status', 'canceled', false);
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
      * @param {Config} config
      * @param {Client} client
      * @returns {Promise<Message>}
     **/
    async message(config, client) {
        const message = await client.channels.cache.get(config.channel_id_event_vote)
            .messages.fetch(this.message_id);
        return message;
    }

    /**
      * @param {Client} client
      * @returns {Promise<Channel>}
     **/
    async channel(client) {
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
                    is_canceled
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                this.is_canceled,
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
                    is_canceled = ?
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
                this.is_canceled,
                this.id,
            );

            if (result.changes !== 1) {
                console.error(`unexpected number of changes for event id ${this.id}`);
            }
        }
        catch (error) {
            console.error(`failed to update event id ${this.id}`);
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
      * @param {string} message_id
      * @returns {Promise<Event | undefined>}
     **/
    static async selectByMessageId(db, message_id) {
        const stmt = await db.prepare('SELECT * FROM events WHERE message_id = ?');
        const raw_event = await stmt.get(message_id);
        if (raw_event === undefined) {
            return undefined;
        }
        console.log(raw_event);
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
                is_canceled INT NOT NULL
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
}

export default Event;
