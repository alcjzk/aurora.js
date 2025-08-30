import templates from './templates.js';
import util from './util.js';
import * as log from './log.js';
import * as discord from './discord.js';

/**
  * @typedef {import('discord.js').Embed} Embed
  * @typedef {import('discord.js').Client} Client
  * @typedef {import('discord.js').Message} Message
  * @typedef {import('discord.js').Snowflake} Snowflake
 **/

export class Organizer {
    /** @type {Number} */
    id;
    /** @type {string} */
    name;
}

export class Duration {
    /** @type {Number} */
    days;
    /** @type {Number} */
    hours;
}

export class EventData {
    /** @type {string} */
    dtstart;
    /** @type {string} */
    dtend;
    /** @type {string} */
    dtstamp;
    /** @type {string} */
    uid;
    /** @type {string} */
    created;
    /** @type {string} */
    description;
    /** @type {string} */
    last_modified;
    /** @type {string} */
    sequence;
    /** @type {string} */
    status;
    /** @type {string} */
    summary;
    /** @type {string} */
    transp;


    /**
      * @param {EventData} event
      * @returns {Embed}
     **/
    toEmbed() {
        const description = templates.eventDescription(this);
        return {
            title: this.title,
            url: this.ctftime_url,
            description: util.truncateToLengthWithEllipsis(description, discord.EMBED_DESCRIPTION_MAX_LENGTH),
            color: 0x2061F7,
            fields: [
                {
                    name: 'Teams',
                    value: this.participants,
                    inline: true,
                },
                {
                    name: 'Onsite',
                    value: this.onsite ? 'yes' : 'no',
                    inline: true,
                },
                {
                    name: 'Restrictions',
                    value: this.restrictions,
                    inline: true,
                },
                {
                    name: 'Format',
                    value: this.format,
                    inline: true,
                },
                {
                    name: 'Organizers',
                    value: this.organizers.map(o => o.name).join(', '),
                    inline: true,
                },
                {
                    name: 'Would Join',
                    value: '-',
                    inline: true,
                },
            ],
        }
    }
    /**
      * @param {Client} client
      * @param {Snowflake} channel_id
      * @returns {Promise<Message>}
     **/
    async createMessage(client, channel_id) {
        const embed = this.toEmbed();
        return await client.channels.cache.get(channel_id).send({ embeds: [embed] });
    }
    /**
      * @returns {EventData}
     **/
    static test() {
        const start = new Date();
        start.setSeconds(start.getSeconds() + 15);
        const end = new Date();
        end.setSeconds(end.getSeconds() + 60);

        return Object.assign(new EventData(), {
            title: 'Test Event',
            description: 'winnable',
            participants: 0,
            format: 'fake',
            organizers: [{
                id: -1,
                name: 'nobody',
            }],
            onsite: true,
            restrictions: 'not joinable',
            start: start.toString(),
            finish: end.toString(),
            id: util.now(),
        });
    }
}
/**
  * @returns {Promise<EventData[]>}
 **/
export const fetchEvents = async () => {
    try {
        const url = "https://indiegamejams.com/calfeed/";
        const response = await fetch(url);
        const json = await response.json();

        /** @type {EventData[]} */
        const events = json.map(data => {
            const event = Object.assign(new EventData(), data);
            if (event.dtstart === undefined) {
                const key = Object.keys(data).find(k => k.startsWith("dtstart"));
                event.dtstart = data[key];
            }
            if (event.dtend === undefined) {
                const key = Object.keys(data).find(k => k.startsWith("dtend"));
                event.dtend = data[key];
            }
            return event;
        });
        events.sort((a, b) => a.dtstart.localeCompare(b.dtstart));
        console.log(events);

        return events;
    }
    catch (error) {
        log.erro(`failed to fetch upcoming events:`);
        console.error(error);
        return [];
    }
}
