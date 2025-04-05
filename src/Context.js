import { Client } from 'discord.js';
import { Database } from 'sqlite';
import { JobManager } from './job.js';
import { Config } from './Config.js';

export class Context {
    /** @type {Database} */
    db;
    /** @type {Config} */
    config;
    /** @type {Client} */
    client;
    /** @type {JobManager} */
    jobs;
}
