import { Context } from '../Context.js';
import * as log from '../log.js';

export class Job {
    /** @type {Number} */
    #interval_id;
    /** @type {Number} */
    #ms_interval;
    /** @type {Function} */
    #func;
    /** @type {Object} */
    #context;

    /**
      * @param {Function} func
      * @param {Number} ms_interval
      * @param {Context} context
      * @throws if an invalid parameter is given
     **/
    constructor(func, ms_interval, context) {
        this.#interval_id = undefined;
        this.msInterval(ms_interval);
        this.func(func);
        this.context(context);
        log.trac(`created job '${this.constructor.name}', ms_interval: ${this.msInterval()}`);
    }

    start() {
        if (this.interval_id !== undefined) {
            log.warn(`replacing already running job`);
        }
        this.interval_id = setInterval(() => this.func()(this.context()), this.msInterval());
        this.func()(this.context())
        log.trac(`started job '${this.constructor.name}'`);
    }

    stop() {
        if (this.#interval_id === undefined) {
            log.warn(`attempted to stop a job that was not running`);
        }

        clearInterval(this.#interval_id);
        this.#interval_id = undefined;
        log.trac(`stopped job '${this.constructor.name}'`);
    }

    onUpdateConfig() {
        log.trac(`updated config for job ${this.constructor.name}, ms_interval: ${this.msInterval()}`);
    }

    /**
      * @returns {boolean} 
     **/
    isRunning() {
        if (this.#interval_id === undefined) {
            return false;
        }
        return true;
    }

    /**
      * @param {Context} context
      * @returns {Context} 
      * @throws if context is given and is invalid
     **/
    context(context) {
        if (context === undefined) {
            return this.#context;
        }

        if (!context instanceof Context) {
            throw Error(`invalid type for job context`);
        }
        this.#context = context;
    }

    /**
      * @param {Number} ms_interval
      * @return {Number}
      * @throws if ms_interval is given and is invalid
     **/
    msInterval(ms_interval) {
        if (ms_interval === undefined) {
            return this.#ms_interval;
        }

        if (typeof (ms_interval) !== 'number') {
            throw Error(`'${ms_interval}' (${typeof (ms_interval)}) is not a number`);
        }
        if (ms_interval < 0) {
            throw Error(`'${ms_interval}' is not less than zero`);
        }
        this.#ms_interval = ms_interval;
    }

    /**
      * @param {Function} func
      * @returns {Function} 
      * @throws if func is given and is invalid
     **/
    func(func) {
        if (func === undefined) {
            return this.#func;
        }

        if (typeof (func) != 'function') {
            throw Error(`func is not a function`);
        }
        this.#func = func;
    }
}

