/**
  * @typedef {import('sqlite').Database} Database
  * @typedef {import('discord.js').Client} Client
  * @typedef {import('discord.js').Guild} Guild
  * @typedef {import('./Config.js').Config} Config
  * @typedef {import('./EventListMessage.js').EventListMessage} EventListMessage
 **/

export class Context {
    /** @type {Database} */
    db;
    /** @type {Config} */
    config;
    /** @type {Client} */
    client;
    /** @type {JobManager} */
    jobs;
    /** @type {EventListMessage} */
    event_list_message;

    /**
      * @returns {Guild}
      * @throws on failure
     **/
    guild() {
        if (this.config.guild_id === undefined) {
            throw new Error('missing guild in config');
        }

        const guild = this.client.guilds.cache.get(this.config.guild_id);

        if (guild === undefined) {
            throw new Error('guild not found in cache');
        }

        return guild;
    }
}
