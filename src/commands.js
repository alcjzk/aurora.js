import { ApplicationCommand, CommandInteraction, MessageContextMenuCommandInteraction } from 'discord.js';
import { StartEventCommand } from './commands/StartEvent.js';
import { SkipEventCommand } from './commands/SkipEvent.js';
import { TestEventCommand } from './commands/TestEvent.js';
import { TestUpdateParticipantCountCommand } from './commands/TestUpdateParticipantCount.js';
import { ConfigCommand } from './commands/Config.js';
import { Context } from './Context.js';
import * as log from './log.js';

export * from './commands/StartEvent.js';
export * from './commands/SkipEvent.js';
export * from './commands/TestEvent.js';
export * from './commands/TestUpdateParticipantCount.js';
export * from './commands/Config.js';

const commands = {};

/** @type {ApplicationCommand[]} */
commands.ALL = [
    StartEventCommand,
    SkipEventCommand,
    TestEventCommand,
    TestUpdateParticipantCountCommand,
    ConfigCommand,
];

/**
  * @param {Context} ctx
  * @param {CommandInteraction} interaction
  * @async
 **/
commands.onChatInputCommandInteraction = async (ctx, interaction) => {
    for (const command of commands.ALL) {
        if (typeof command.onChatInputCommandInteraction !== typeof Function) {
            continue;
        }
        if (await command.onChatInputCommandInteraction(ctx, interaction)) {
            return;
        }
    }
    log.warn(`unhandled interaction:`);
    console.warn(interaction);
};

/**
  * @param {Context} ctx
  * @param {MessageContextMenuCommandInteraction} interaction
  * @async
 **/
commands.onMessageContextMenuCommandInteraction = async (ctx, interaction) => {
    for (const command of commands.ALL) {
        if (typeof command.onMessageContextMenuCommandInteraction !== typeof Function) {
            continue;
        }
        if (await command.onMessageContextMenuCommandInteraction(ctx, interaction)) {
            return;
        }
    }
    log.warn(`unhandled interaction:`);
    console.warn(interaction);
};

/**
  * @param {Context} ctx
  * @param {MessageContextMenuCommandInteraction} interaction
  * @async
 **/
commands.onInteraction = async (ctx, interaction) => {
    if (interaction.isChatInputCommand()) {
        return await commands.onChatInputCommandInteraction(ctx, interaction);
    }
    if (interaction.isMessageContextMenuCommand()) {
        return await commands.onMessageContextMenuCommandInteraction(ctx, interaction);
    }
    log.warn(`unhandled interaction:`);
    console.warn(interaction);
};

export default commands;
