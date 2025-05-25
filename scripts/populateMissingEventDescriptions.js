import sqlite from 'sqlite';
import * as sqlite3 from 'sqlite3'
import { env } from 'node:process';
import Event from '../src/Event.js';
import * as ctftime from '../src/ctftime.js';
import util from '../src/util.js';

try {
    if (!env.DATABASE_PATH) {
        throw new Error('DATABASE_PATH is not defined');
    }

    const db = sqlite.open({
        driver: sqlite3.Database,
        filename: env.DATABASE_PATH,
    });

    const from = new Date();
    var to = new Date();
    from.setDate(to.getDate() - 7);
    to.setDate(to.getDate() + 30);

    const api_events = await ctftime.fetchEvents(
        util.dateToTimestamp(from),
        util.dateToTimestamp(to),
        500,
    );

    const events = await Event.selectAll(db);

    var updated_count = 0;
    for (const event of events) {
        if (event.description !== null || event.description !== undefined) {
            continue;
        }

        event.description = api_events.find(e => e.id === event.id)?.description;
        await event.update(db);
        updated_count++;
    }

    console.info(`updated ${updated_count} missing event descriptions from the api`);
}
catch (error) {
    console.error('populating missing event descriptions failed with an error:');
    console.error(error);

    process.exit(1);
}
