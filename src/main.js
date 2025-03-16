import {
    Client, Events, GatewayIntentBits, MessageReaction, ApplicationCommandType,
    InteractionContextType, MessageContextMenuCommandInteraction, PermissionFlagsBits
} from 'discord.js';

import { Config } from './Config.js';
import { fetchEvents } from './ctftime.js'
import { open as sqliteOpen, Database } from 'sqlite';
import sqlite3 from 'sqlite3';
import Event from './Event.js';
import util from './util.js';

// TODO: Restrict time before an event can be started by non admins
// TODO: Sort incoming events by date
// TODO: Event message colors by status
// TODO: Notify participants when event reaches participant limit for automatic starting
// TODO: Allow configuring admin role
// TODO: Update event message when event ends normally
// TODO: Restore try catches
// TODO: Allow configuring the bot via discord commands
// TODO: How to contribute
// TODO: Licence
// TODO: Contiguous integration and deployment
// TODO: Discord commands for checking status or persitent storage
// TODO: Editorconfig / jslint

const COMMAND_NAME_START_EVENT = 'Start Event';
const COMMAND_NAME_CANCEL_EVENT = 'Cancel Event';

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
        if (saved_events.some(saved => saved.id == event_data.id)) {
            // TODO: Update number of participants
            continue;
        }

        const event = new Event();
        event.id = event_data.id;
        event.title = event_data.title;
        event.start = util.stringToTimestamp(event_data.start);
        event.end = util.stringToTimestamp(event_data.finish);
        event.url = event_data.url;
        event.is_started = false;
        event.is_canceled = false;
        event.attending_ids = [];

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
    const event = await Event.select(event_id);

    if (event.attending_ids.length < config.threshold_event_participants) {
        console.log(`event '${event.title}' does not have enough participants and wont be started`);
        return;
    }

    if (event.is_started) {
        console.log(`event '${event.title}' has already been started`);
        return;
    }

    await event.doStart(config, db, client);
};

/**
  * @async
  * @param {Config} config
  * @param {Database} db
  * @param {Client} client
 **/
const scheduleStartingEvents = async (config, db, client) => {
    const saved_events = await Event.selectAll(db);

    for (const event of saved_events) {
        const s_until = event.start - util.now();

        if (s_until >= 0 && s_until <= config.s_interval_schedule_events) {
            console.log(`event '${event.title}' is scheduled to start`);
            setTimeout(
                () => {
                    onEventWouldStartSoon(db, client, event_id)
                        .catch(console.error);
                },
                (s_until - config.s_before_announce_event) * 1000,
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
    const events = await Event.selectAll(db);
    for (const event of events) {
        const s_until = event.end - util.now();

        if (event.isExpired()) {
            const message = await event.message(config, client);
            await message.delete();
            await event.delete(db);
            return;
        }

        // TODO: Update info for config value
        if (s_until >= 0 && s_until <= config.s_interval_schedule_events) {
            console.log(`event '${event.title}' is scheduled to expire`);
            setTimeout(
                () => {
                    if (!event.is_started) {
                        event.message(config, client)
                            .then(message => message.delete().catch(console.error));
                    }
                    event.delete(db).catch(console.error);
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

        const reaction = await message.reactions.cache.get(config.emoji_vote).fetch();
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

    if (event.isExpired() || event.is_started || event.is_canceled) {
        return;
    }

    const users = await reaction_event.users.fetch();
    const ids = users
        .filter(user => !user.bot)
        .map(user => user.id);
    await event.updateAttendingIds(config, db, client, ids);
};

/**
  * @async
  * @param {Config} config
  * @param {Database} db
  * @param {Client} client
  * @param {MessageContextMenuCommandInteraction} interaction
 **/
const onStartEventInteraction = async (config, db, client, interaction) => {
    const event = await Event.selectByMessageId(db, interaction.targetMessage.id);
    if (event === undefined) {
        return await interactionReplyNoEvent(interaction);
    }
    if (event.is_started) {
        return await util.interactionReplyEphemeralText(interaction, 'This event was already started.');
    }
    if (event.is_canceled) {
        return await util.interactionReplyEphemeralText(
            interaction,
            'Cannot start an event that has been canceled.',
        );
    }
    if (event.isExpired()) {
        return await util.interactionReplyEphemeralText(
            interaction,
            'Cannot start an event that has expired.',
        );
    }
    if (event.attending_ids.length < 2 && !interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
        return await util.interactionReplyEphemeralText(
            interaction,
            'Events with less than 2 participants can only be started by an admin.',
        );
    }
    await event.doStart(config, db, client);
    await util.interactionReplyEphemeralText(interaction, 'Event started!');
};

/**
  * @async
  * @param {Config} config
  * @param {Database} db
  * @param {Client} client
  * @param {MessageContextMenuCommandInteraction} interaction
 **/
const onEventCancelInteraction = async (config, db, client, interaction) => {
    const event = await Event.selectByMessageId(db, interaction.targetMessage.id);
    if (event === undefined) {
        return await interactionReplyNoEvent(interaction);
    }
    if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
        return await util.interactionReplyEphemeralText(
            interaction,
            'Events can only be canceled by an admin.',
        );
    }
    if (event.is_canceled || event.is_started || event.isExpired()) {
        return await util.interactionReplyEphemeralText(
            interaction,
            'Cannot cancel this event.',
        );
    }

    await event.cancel(config, db, client);
    return await util.interactionReplyEphemeralText(
        interaction,
        `Event '${event.title}' has been canceled.`
    );
};

/**
  * @async
  * @param {Config} config
  * @param {Database} db
  * @param {Client} client
  * @param {MessageContextMenuCommandInteraction} interaction
 **/
const onInteraction = async (config, db, client, interaction) => {
    if (interaction.commandName === COMMAND_NAME_START_EVENT) {
        return await onStartEventInteraction(config, db, client, interaction);
    }
    if (interaction.commandName === COMMAND_NAME_CANCEL_EVENT) {
        return await onEventCancelInteraction(config, db, client, interaction);
    }
    console.error(`received unknown interaction:\n${interaction}`);
};

/**
  * @async 
  * @param {MessageContextMenuCommandInteraction} interaction
 **/
const interactionReplyNoEvent = async (interaction) => {
    await util.interactionReplyEphemeralText(
        interaction,
        'This message has no event associated with it.',
    );
};

/**
  * @async
 **/
const onStart = async () => {
    console.info(`starting app`);

    const config = new Config();

    const db = await sqliteOpen({
        filename: 'data.sqlite3',
        driver: sqlite3.Database,
    });

    if (!await Event.tableExists(db)) {
        console.info(`database first time setup`);
        await Event.createTable(db);
    }

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
        interaction => onInteraction(config, db, client, interaction),
    );

    await client.login(config.token);
    await client.guilds.fetch(config.guild_id, { cache: true });
    await client.channels.fetch(config.channel_id_event_vote, { cache: true });

    await client.guilds.cache.get(config.guild_id).commands.set([
        {
            type: ApplicationCommandType.Message,
            name: COMMAND_NAME_START_EVENT,
            contexts: [InteractionContextType.Guild],
        },
        {
            type: ApplicationCommandType.Message,
            name: COMMAND_NAME_CANCEL_EVENT,
            contexts: [InteractionContextType.Guild],
        },
    ]);

    await updateEvents(config, db, client);
    setInterval(
        () => {
            updateEvents(config, db, client).catch(console.error);
        },
        config.s_interval_poll_events * 1000,
    );

    await scheduleStartingEvents(config, db, client);
    setInterval(
        () => {
            scheduleStartingEvents(db, client).catch(console.error);
        },
        config.s_interval_schedule_events * 1000,
    );

    await scheduleExpireEvents(config, db, client);
    setInterval(
        () => {
            scheduleExpireEvents(db, client).catch(console.error);
        },
        config.s_interval_schedule_events * 1000,
    );
};

onStart();//.catch(error => console.error(`app failed to start: ${error}`));
