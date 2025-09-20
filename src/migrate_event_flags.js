/**
  * @typedef {import('sqlite').Database} Database
 **/

import Event from '../src/Event.js';
import { EventFlag } from '../src/EventFlag.js';
import * as log from '../src/log.js';

/**
  * @param {Database} db
  * @returns {Promise<boolean>} true if the migration succeeded, false otherwise
 **/
export const migrate_event_flags = async (db) => {
    try {
        log.info(`starting flags migration`);

        const events = await Event.selectAll(db);

        for (const event of events) {
            if (event.flags.toNumber() != 0) {
                log.erro('flags field already contained bits!');
                return false;
            }

            if (event.is_started) {
                event.flags.set(EventFlag.IsStarted);
            }

            if (event.is_skipped) {
                event.flags.set(EventFlag.IsSkipped);
            }

            if (event.is_notified) {
                event.flags.set(EventFlag.IsNotified);
            }

            log.info(`migrated flags for event id ${event.id}`);
        }

        log.info(`saving migrations to db`);

        for (const event of events) {
            await event.update(db);
        }

        log.info(`flags migration was completed successfully`);

        return true;
    }
    catch (error) {
        log.erro(`unexpected error during flags migration:`);
        console.error(error);
        return false;
    }
};

