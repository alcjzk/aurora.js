import { Client, Events, GatewayIntentBits } from 'discord.js';
import { Config } from './Config.js';
import { JobManager } from './job.js';
import { Context } from './Context.js';
import { EventListMessage } from './EventListMessage.js';
import { open as sqliteOpen } from 'sqlite';
import Event from './Event.js';
import sqlite3 from 'sqlite3';
import commands from './commands.js';
import process from 'node:process';
import fs from 'fs/promises';
import * as log from './log.js';

// TODO: Make use of partials?
// TODO: Allow configuring admin role
// TODO: How to contribute
// TODO: Discord commands for checking status or persitent storage
// TODO: Try catch for unexpected errors in interactions

/**
  * @param {Context} ctx
 **/
const onClientReady = async (ctx) => {
    log.info(`logged in as ${ctx.client.user.tag}`);

    try {
        const events = await Event.selectAll(ctx.db);
        for (const event of events) {
            const message = await event.message(ctx.config, ctx.client);

            if (message === undefined) {
                continue;
            }

            const reaction = await message.reactions.cache.get(ctx.config.emoji_vote)?.fetch();
            if (reaction === undefined) {
                continue;
            }

            const users = await reaction.users.fetch();
            const ids = users.filter(user => !user.bot)
                .map(user => user.id);
            await event.updateAttendingIds(ctx.config, ctx.db, ctx.client, ids);
        }
    }
    catch (error) {
        log.warn(`error refreshing events: ${error}`);
        console.warn(error);

        if (ctx.config.debug_mode) {
            throw error;
        }
    }
}

/**
  * @param {Context} ctx
  * @param {MessageReaction} reaction_event
 **/
const onReaction = async (ctx, reaction_event) => {
    if (reaction_event.message.guildId !== ctx.config.guild_id) {
        return;
    }
    if (reaction_event.emoji.name != ctx.config.emoji_vote) {
        return;
    }
    if (reaction_event.message.channelId != ctx.config.channel_id_event_vote) {
        return;
    }

    const event = await Event.selectByMessageId(ctx.db, reaction_event.message.id);

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

    await event.updateAttendingIds(ctx.config, ctx.db, ctx.client, ids);
    if (ids.length === ctx.config.threshold_event_participants) {
        await event.notifyParticipantThresholdReached(ctx.config, ctx.db, ctx.client);
    }

    const events = await Event.selectAll(ctx.db);
    await ctx.event_list_message.update(ctx, events);
};

const onError = (config, error) => {
    log.erro(`unhandled error:`);
    console.error(error);

    if (config.debug_mode) {
        console.error(error.stack);
        throw error;
    }
};

const onStop = ctx => {
    log.info('stopping app');
    ctx.jobs.stopAll();
    process.exit(0);
};

const onConfigInitialized = async ctx => {
    log.trac('config initialized');
    ctx.client.channels.fetch(ctx.config.channel_id_event_vote, { cache: true });
    ctx.client.channels.fetch(ctx.config.channel_id_event_list, { cache: true });
    if (!await ctx.event_list_message.tryFetch(ctx)) {
        const events = await Event.selectAll(ctx.db)
        await ctx.event_list_message.send(ctx, events);
    }
    ctx.jobs.onConfigInitialized(ctx.config);
};

/**
  * @async
 **/
const onStart = async () => {
    const pkg_file = await fs.readFile('package.json');
    const pkg = JSON.parse(pkg_file);

    log.info(`starting ${pkg.name} version ${pkg.version}`);

    const config = new Config();
    const db = await sqliteOpen({
        filename: config.database_path,
        driver: sqlite3.Database,
    });
    await db.migrate();
    await config.load(db);

    const count = await Event.count(db);

    log.info(`loaded ${count} events from db`);

    if (config.skip_post_new_events) {
        log.warn(`SKIP_POST_NEW_EVENTS is enabled`);
    }

    const intents =
        GatewayIntentBits.Guilds |
        GatewayIntentBits.GuildMessages |
        GatewayIntentBits.GuildIntegrations |
        GatewayIntentBits.GuildMessageReactions;

    const client = new Client({ intents: intents });

    const ctx = Object.assign(new Context, {
        db,
        config,
        client,
        jobs: new JobManager(),
        event_list_message: new EventListMessage(),
    });

    ctx.client.on(
        Events.ClientReady,
        () => onClientReady(ctx)
            .catch(error => onError(ctx.config, error))
    );
    ctx.client.on(
        Events.MessageReactionAdd,
        reaction_event => onReaction(ctx, reaction_event)
            .catch(error => onError(ctx.config, error))
    );
    ctx.client.on(
        Events.MessageReactionRemove,
        reaction_event => onReaction(ctx, reaction_event)
            .catch(error => onError(ctx.config, error))
    );
    ctx.client.on(
        Events.InteractionCreate,
        interaction => commands.onInteraction(ctx, interaction)
            .catch(error => onError(ctx.config, error))
    );
    ctx.client.on(
        Events.ShardDisconnect,
        error => {
            log.warn(`client disconnected:`);
            console.warn(error);
        }
    );
    ctx.client.on(
        Events.Error,
        error => onError(ctx.config, error),
    )

    await ctx.client.login(process.env.TOKEN);
    await ctx.client.guilds.fetch(ctx.config.guild_id, { cache: true });
    await ctx.client.guilds.cache.get(ctx.config.guild_id).commands.set(commands.ALL);

    ctx.jobs.init(ctx);

    ctx.config.on(
        Config.INITIALIZED,
        () => onConfigInitialized(ctx),
    );
    ctx.config.on(
        Config.UPDATED,
        () => {
            ctx.client.channels.fetch(ctx.config.channel_id_event_vote, { cache: true });
            log.trac('config updated');
        }
    );

    ctx.config.trySetInitialized();

    process.on('SIGTERM', () => onStop(ctx));
    process.on('SIGINT', () => onStop(ctx));
};

const tryStart = async (s_retry_timeout) => {
    try {
        await onStart();
    }
    catch (error) {
        s_retry_timeout ??= 15;
        log.erro(`failed to start app!`);
        console.error(error);
        log.erro(`trying again in ${s_retry_timeout} seconds`);
        s_retry_timeout = Math.min(s_retry_timeout * 2, 300);

        setTimeout(() => tryStart(s_retry_timeout), s_retry_timeout * 1000);
    }
};

await tryStart();
