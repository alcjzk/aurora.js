/**
  * @typedef {import('sqlite').Database} Database
  * @typedef {import('discord.js').Client} Client
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
}
