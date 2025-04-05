import { Job } from '../job.js';
import { Context } from '../Context.js';
import Event from '../Event.js';
import util from './util.js';
import * as log from '../log.js';

export class ScheduleEvents extends Job {
    /**
      * @param {Context} ctx
      * @throws if the parent constructor fails
     **/
    constructor(ctx) {
        const ms_interval = ctx.config.s_interval_schedule_events * 1000;
        super(UpdateEventsJob.run, ms_interval, ctx);
    }

    onUpdateConfig() {
        const ms_interval = this.context().config.s_interval_schedule_events * 1000;
        this.msInterval(ms_interval);
        super.onUpdateConfig();
    }

    /**
      * @param {Context} ctx
      * @async
     **/
    static async run(ctx) {
        console.log(`scheduling events`);

        const saved_events = await Event.selectAll(ctx.db);

        for (const event of saved_events) {
            const now = util.now();
            const s_until_end = Math.max(event.end - now, 0);
            const s_until_start = event.start - now;

            if (event.shouldExpire()) {
                log.info(`event '${event.title}' has expired`);
                await event.expire(ctx.config, ctx.db, ctx.client);
                continue;
            }

            // TODO:  If event is already scheduled, skip
            if (s_until_start < 0) {
                log.warn(`start of event '${event.title}' was missed`);
                continue;
            }

            if (event.is_started) {
                continue;
            }

            if (s_until_end <= ctx.config.s_interval_schedule_events) {
                log.info(`event '${event.title}' is scheduled to expire`);
                setTimeout(
                    _ => {
                        log.info(`event '${event.title}' has expired`);
                        event.expire(ctx.config, ctx.db, ctx.client);
                    },
                    s_until_end * 1000,
                );
            }

            if (s_until_start <= ctx.config.s_interval_schedule_events) {
                const timeout = Math.max(0, s_until_start - ctx.config.s_before_announce_event);
                log.info(`event '${event.title}' is scheduled to start in ${timeout} seconds`);

                setTimeout(
                    _ => Event.select(ctx.db, event.id)
                        .then(event => event.tryStart()),
                    timeout * 1000,
                );
            }
        }
    }
}
