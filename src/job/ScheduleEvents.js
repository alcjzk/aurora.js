import { Job } from '../job.js';
import Event from '../Event.js';
import * as log from '../log.js';

/**
  * @typedef {import('../Context.js').Context} Context
 **/

export class ScheduleEvents extends Job {
    /**
      * @param {Context} ctx
      * @throws if the parent constructor fails
     **/
    constructor(ctx) {
        const ms_interval = ctx.config.s_interval_schedule_events * 1000;
        super(ScheduleEvents.run, ms_interval, ctx);
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
        log.trac(`scheduling events`);

        const saved_events = await Event.selectAll(ctx.db);

        for (const event of saved_events) {
            await event.schedule(ctx);
        }
    }
}
