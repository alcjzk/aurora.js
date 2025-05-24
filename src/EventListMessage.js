import { EmbedBuilder } from 'discord.js';
import util from './util.js';
import * as log from './log.js';
import * as discord from './discord.js';

/**
  * @typedef {import('discord.js').Message} Message
  * @typedef {import('discord.js').TextChannel} TextChannel
  * @typedef {import('./Context.js').Context} Context
  * @typedef {import('./Config.js').Config} Config
  * @typedef {import('./Event.js').default} Event
 **/

export class EventListMessage {
    /** @type {Message | undefined} */
    message;
    /** @type {string | undefined} */
    channel_id;
    /**
      * @param {Context}
      * @throws on errors
      * @async
     **/
    async tryFetch({ client, config }) {
        log.trac('trying to fetch existing event list message');
        /** @type {TextChannel} */
        const channel_id = config.channel_id_event_list;
        const channel = client.channels.cache.get(channel_id);

        /** @type {Message[]} */
        const messages = await channel.messages.fetch({ limit: 100 });
        const message = messages.find(m => m.author.id == client.user.id);
        if (message === undefined) {
            log.trac('event list message was not found');
            return false;
        }

        log.trac('found existing event list message');

        this.channel_id = channel_id;
        this.message = message;

        return true;
    }
    /**
      * @param {Context}
      * @param {Event[]} events
      * @returns {Promise<EventListMessage>}
      * @throws on errors
      * @async
     **/
    async send({ client, config }, events) {
        /** @type {TextChannel} */
        this.channel_id = config.channel_id_event_list;
        const channel = client.channels.cache.get(this.channel_id);
        this.message = await channel.send({
            embeds: [EventListMessage.embed(config, events)],
        });
        log.trac('created event list message');
    }
    /**
      * @param {Context}
      * @param {Event[]} events
      * @returns {Promise<EventListMessage>}
      * @throws on errors
      * @async
     **/
    async update({ config }, events) {
        /** @type {TextChannel} */
        await this.message.edit({
            embeds: [EventListMessage.embed(config, events)],
        });
        log.trac('updated event list message');
    }
    /**
      * @param {Config} config
      * @param {Event[]} events
      * @returns {Promise<EventListMessage>}
      * @throws on errors
      * @async
     **/
    static embed(config, events) {
        var description_header = '';

        description_header += '⚪ - No voters\n';
        description_header += '🔵 - Not enough voters\n';
        description_header += '🟢 - Threshold reached!\n';
        description_header += '⚫ - Skipped\n\n';

        var description = '';

        events = events.sort((a, b) => b.start - a.start); // TODO: Already sorted?
        for (const event of events) {
            const message_url = ` https://discord.com/channels/${config.guild_id}/${config.channel_id_event_vote}/${event.message_id}`;
            const min = config.threshold_event_participants;
            const count = event.attending_ids.length;

            var status = '⚪';
            if (count > 0) {
                status = '🔵';
            }
            if (count > config.threshold_event_participants) {
                status = '🟢';
            }
            if (event.is_skipped) {
                status = '⚫';
            }

            const teams = event.participant_count;

            const time = util.formatTimestampShort(event.start);
            description += `${status} [${count}/${min}] [${event.title}](${message_url}) ** - ${teams} teams - ${time}**\n`;
        }

        while (description_header.length + description.length > discord.EMBED_DESCRIPTION_MAX_LENGTH) {
            description = description.slice(description.indexOf('\n') + 1);
            log.trac('trimming oversized embed description');
        }

        return new EmbedBuilder({
            title: 'Upcoming Events',
            url: `https://discord.com/channels/${config.guild_id}/${config.channel_id_event_vote}`,
            description: description_header + description,
        });
    }
};

