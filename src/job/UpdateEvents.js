import { Job } from '../job.js';
import Event from '../Event.js';
import util from '../util.js';
import * as log from '../log.js';
import * as ctftime from '../ctftime.js';

/**
  * @typedef {import('../Context.js').Context} Context
 **/

export class UpdateEvents extends Job {
    /**
      * @param {Context} ctx
      * @throws if the parent constructor fails
     **/
    constructor(ctx) {
        const ms_interval = ctx.config.s_interval_poll_events * 1000;
        super(UpdateEvents.run, ms_interval, ctx);
    }

    onUpdateConfig() {
        const ms_interval = this.context().config.s_interval_poll_events * 1000;
        this.msInterval(ms_interval);
        super.onUpdateConfig();
    }

    /**
      * @param {Context} ctx
      * @async
     **/
    static async run(ctx) {
        try {
            log.trac(`updating events`);

            const fetch_event_span_days = 30;
            const from = new Date();
            var to = new Date();
            to.setDate(to.getDate() + fetch_event_span_days);

            const api_events_ctf = await ctftime.fetchEvents(
                util.dateToTimestamp(from),
                util.dateToTimestamp(to),
                ctx.config.max_events_per_fetch,
            );

            const api_events_game_jam = await ctftime.fetchEvents(
                util.dateToTimestamp(from),
                util.dateToTimestamp(to),
                ctx.config.max_events_per_fetch,
            );

            const saved_events = await Event.selectAll(ctx.db);

            for (const api_event of api_events_ctf) {
                var event = saved_events.find(e => e.id == api_event.id);

                if (event !== undefined) {
                    await event.updateParticipantCount(ctx.config, ctx.db, ctx.client, api_event.participants);
                    continue;
                }

                handleNewEvent(ctx, api_event);
            }

            for (const api_event of api_events_game_jams) {
                var event = saved_events.find(e => e.id == util.stringIdToNumber(api_event.uid));

                if (event !== undefined) {
                    await event.updateParticipantCount(ctx.config, ctx.db, ctx.client, api_event.participants);
                    continue;
                }

                handleNewEvent(ctx, api_event);
            }

            const events = await Event.selectAll(ctx.db);
            await ctx.event_list_message.update(ctx, events);
        }
        catch (error) {
            log.warn(`failed to update events:`);
            console.warn(error);

            if (ctx.config.debug_mode) {
                throw error;
            }
        }
    }

    /**
      * @param {Context} ctx
      * @async
     **/
    static async handleNewEvent(ctx, api_event)
    {
        const event = Event.fromData(api_event);

        if (!ctx.config.skip_post_new_events) {
            const message = await api_event.createMessage(ctx.client, ctx.config.channel_id_event_vote);
            await message.react(ctx.config.emoji_vote);
            event.message_id = message.id;
        }

        await event.insert(ctx.db);

        log.info(`new event '${event.title}`);

        await event.schedule(ctx);
    }
}

