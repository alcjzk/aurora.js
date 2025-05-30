import { UpdateEvents } from './UpdateEvents.js';
import { ScheduleEvents } from './ScheduleEvents.js';
import * as log from '../log.js';

/**
  * @typedef {import('./Job.js').Job} Job
  * @typedef {import('../Context.js').Context} Context
  * @typedef {import('../Config.js').Config} Config
 **/

export class JobManager {
    /** @type {UpdateEvents} */
    update_events;
    /** @type {ScheduleEvents} */
    schedule_events;

    /**
      * @param {Context} ctx
     **/
    init(ctx) {
        this.update_events = new UpdateEvents(ctx);
        this.schedule_events = new ScheduleEvents(ctx);
    }

    onConfigInitialized() {
        this.startAll();
    }

    onConfigUpdated(config) {
        /** @type {Job[]} */
        const jobs = Object.values(this);
        console.log(jobs);
        for (const job of jobs) {
            const was_running = job.isRunning();

            if (was_running) {
                job.stop();
            }

            tryUpdateConfigForJob(config, job);

            if (was_running) {
                job.start();
            }
        }
    }

    startAll() {
        /** @type {Job[]} */
        const jobs = Object.values(this);
        for (const job of jobs) {
            if (!job.isRunning()) {
                job.start();
            }
        }
    }

    stopAll() {
        /** @type {Job[]} */
        const jobs = Object.values(this);
        for (const job of jobs) {
            if (job.isRunning()) {
                job.stop();
            }
        }
    }
}

/**
  * @param {Config} config
  * @param {Job} job
 **/
const tryUpdateConfigForJob = (config, job) => {
    try {
        job.onUpdateConfig();
    }
    catch (error) {
        log.erro(`failed to update config for job`);
        log.erro(error);

        if (config.debug_mode) {
            throw error;
        }
    }
};
