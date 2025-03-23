import { Client, Events, GatewayIntentBits, MessageReaction } from 'discord.js';
import { Config } from './Config.js';
import { fetchEvents } from './ctftime.js'
import { open as sqliteOpen, Database } from 'sqlite';
import sqlite3 from 'sqlite3';
import Event from './Event.js';
import util from './util.js';
import commands from './commands.js';

// TODO: Make use of partials?
// TODO: Allow configuring admin role
// TODO: Restore try catches
// TODO: How to contribute
// TODO: Contiguous integration and deployment
// TODO: Discord commands for checking status or persitent storage
// TODO: Editorconfig / jslint

/**
  * @async
  * @param {Config} config
  * @param {Database} db
  * @param {Client} client
 **/
const updateEvents = async (config, db, client) => {
    console.log('updating events');

    const saved_events = await Event.selectAll(db);

    const fetch_event_span_days = 30;
    const from = new Date();
    var to = new Date();
    to.setDate(to.getDate() + fetch_event_span_days);

    const events = await fetchEvents(
        util.dateToTimestamp(from),
        util.dateToTimestamp(to),
        config.max_events_per_fetch,
    );

    for (const event_data of events) {
        var event = saved_events.find(e => e.id == event_data.id);

        if (event !== undefined) {
            await event.updateParticipantCount(config, db, client, event_data.participants);
            continue;
        }

        event = Event.fromData(event_data);

        if (!config.skip_post_new_events) {
            const message = await event_data.createMessage(client, config.channel_id_event_vote);
            await message.react(config.emoji_vote);
            event.message_id = message.id;
        }

        await event.insert(db);

        console.log(`new event '${event.title}`);
    }
}

/**
  * @async
  * @param {Config} config
  * @param {Database} db
  * @param {Client} client
  * @param {string} event_id
 **/
const onEventWouldStartSoon = async (config, db, client, event_id) => {
    const event = await Event.select(db, event_id);

    if (event.attending_ids.length < config.threshold_event_participants) {
        console.log(`event '${event.title}' does not have enough participants and wont be started automatically`);
        await event.skip(config, db, client);
        return;
    }

    if (event.is_started) {
        console.log(`event '${event.title}' has already been started`);
        return;
    }

    console.log(`starting event '${event.title}'`);

    await event.doStart(config, db, client, false);
};

/**
  * @async
  * @param {Config} config
  * @param {Database} db
  * @param {Client} client
 **/
const scheduleStartingEvents = async (config, db, client) => {
    console.log(`checking starting events`);
    const saved_events = await Event.selectAll(db);

    for (const event of saved_events) {
        if (event.is_started || event.is_skipped) {
            continue;
        }

        const s_until = event.start - util.now();

        if (s_until < 0) {
            console.warn(`start of event '${event.title}' was missed`);
            continue;
        }

        if (s_until <= config.s_interval_schedule_events) {
            const timeout = Math.max(0, s_until - config.s_before_announce_event);
            console.log(`event '${event.title}' is scheduled to start in ${timeout} seconds`);

            setTimeout(
                () => {
                    onEventWouldStartSoon(config, db, client, event.id)
                        .catch(console.error);
                },
                timeout * 1000,
            );
        }
    }
};

/**
  * @async
  * @param {Config} config
  * @param {Database} db
  * @param {Client} client
 **/
const scheduleExpireEvents = async (config, db, client) => {
    console.log(`checking expiring events`);
    const events = await Event.selectAll(db);

    for (const event of events) {
        const s_until = event.end - util.now();

        if (event.shouldExpire()) {
            console.log(`event '${event.title}' has expired`)
            await event.expire(config, db, client);
            return;
        }

        // TODO: Update info for config value
        if (s_until >= 0 && s_until <= config.s_interval_schedule_events) {
            console.log(`event '${event.title}' is scheduled to expire`);
            setTimeout(
                () => {
                    console.log(`event '${event.title}' has expired`)
                    event.expire(config, db, client).catch(console.error);
                },
                s_until * 1000,
            );
        }
    }
};

/**
  * @param {Config} config
  * @param {Database} db
  * @param {Client} client
  * @param {MessageReaction} reaction_event
 **/
const onClientReady = async (config, db, client) => {
    console.info(`logged in as ${client.user.tag}`);

    //    try {
    const events = await Event.selectAll(db);
    for (const event of events) {
        const message = await event.message(config, client);

        if (message === undefined) {
            continue;
        }


        const reaction = await message.reactions.cache.get(config.emoji_vote)?.fetch();
        if (reaction === undefined) {
            continue;
        }

        const users = await reaction.users.fetch();
        const ids = users.filter(user => !user.bot)
            .map(user => user.id);
        await event.updateAttendingIds(config, db, client, ids);
    }
    //    }
    //    catch (error) {
    //        console.warn(`error refreshing events: ${error}`);
    //    }
}

/**
  * @param {Config} config
  * @param {Database} db
  * @param {Client} client
  * @param {MessageReaction} reaction_event
 **/
const onReaction = async (config, db, client, reaction_event) => {
    if (reaction_event.emoji.name != config.emoji_vote) {
        return;
    }

    if (reaction_event.message.channelId != config.channel_id_event_vote) {
        return;
    }

    const event = await Event.selectByMessageId(db, reaction_event.message.id);

    if (event === undefined) {
        return;
    }

    if (event.is_started || event.is_skipped || event.shouldExpire()) {
        return;
    }

    const users = await reaction_event.users.fetch();
    const ids = users
        .filter(user => !user.bot)
        .map(user => user.id);

    await event.updateAttendingIds(config, db, client, ids);
    if (ids.length === config.threshold_event_participants) {
        await event.notifyParticipantThresholdReached(config, db, client);
    }
};

var update_events_interval = undefined;
var start_events_interval = undefined;
var expire_events_interval = undefined;

/**
  * @param {Config} config
  * @param {Database} db
  * @param {Client} client
 **/
export const onUpdateConfig = async (config, db, client) => {
    if (!config.channel_id_event_vote) {
        console.warn('event voting channel is not configured, wont start schedulers');
        return;
    }

    await client.channels.fetch(config.channel_id_event_vote, { cache: true });

    clearInterval(update_events_interval);
    clearInterval(start_events_interval);
    clearInterval(expire_events_interval);

    await updateEvents(config, db, client);
    update_events_interval = setInterval(
        () => {
            updateEvents(config, db, client).catch(console.error);
        },
        config.s_interval_poll_events * 1000,
    );

    await scheduleStartingEvents(config, db, client);
    start_events_interval = setInterval(
        () => {
            scheduleStartingEvents(config, db, client).catch(console.error);
        },
        config.s_interval_schedule_events * 1000,
    );

    await scheduleExpireEvents(config, db, client);
    expire_events_interval = setInterval(
        () => {
            scheduleExpireEvents(config, db, client).catch(console.error);
        },
        config.s_interval_schedule_events * 1000,
    );
};

/**
  * @async
 **/
const onStart = async () => {
    console.info(`starting app`);

    const db = await sqliteOpen({
        filename: 'data.sqlite3',
        driver: sqlite3.Database,
    });
    await db.migrate();

    const config = new Config();
    await config.load(db);

    const count = await Event.count(db);
    console.info(`database contains ${count} events`);

    if (config.skip_post_new_events) {
        console.warn(`SKIP_POST_NEW_EVENTS is enabled`);
    }

    const intents =
        GatewayIntentBits.Guilds |
        GatewayIntentBits.GuildMessages |
        GatewayIntentBits.GuildIntegrations |
        GatewayIntentBits.GuildMessageReactions;

    const client = new Client({ intents: intents });

    client.on(
        Events.ClientReady,
        client => onClientReady(config, db, client)
            .catch(console.error)
    );
    client.on(
        Events.MessageReactionAdd,
        reaction_event => onReaction(config, db, client, reaction_event)
            .catch(console.error)
    );
    client.on(
        Events.MessageReactionRemove,
        reaction_event => onReaction(config, db, client, reaction_event)
            .catch(console.error)
    );
    client.on(
        Events.ShardDisconnect,
        e => console.warn(`client disconnected: code ${e.code}`)
    );
    client.on(
        Events.InteractionCreate,
        interaction => commands.onInteraction(config, db, client, interaction),
    );

    await client.login(config.token);
    await client.guilds.fetch(config.guild_id, { cache: true });
    await client.guilds.cache.get(config.guild_id).commands.set(commands.ALL);

    await onUpdateConfig(config, db, client);
};

try {
    await onStart();
}
catch (error) {
    console.error('app failed to start');
    console.error(error);
}

