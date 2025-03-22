import { ApplicationCommand, CommandInteraction, MessageContextMenuCommandInteraction } from 'discord.js';
import { StartEventCommand } from './commands/StartEvent.js';
import { SkipEventCommand } from './commands/SkipEvent.js';
import { TestEventCommand } from './commands/TestEvent.js';
import { TestUpdateParticipantCount } from './commands/TestUpdateParticipantCount.js';

export * from './commands/StartEvent.js';
export * from './commands/SkipEvent.js';
export * from './commands/TestEvent.js';
export * from './commands/TestUpdateParticipantCount.js';

const commands = {};

/** @type {ApplicationCommand[]} */
commands.ALL = [
    StartEventCommand,
    SkipEventCommand,
    TestEventCommand,
    TestUpdateParticipantCount,
];

/**
  * @param {Config} config
  * @param {Database} db
  * @param {Client} client
  * @param {CommandInteraction} interaction
  * @async
 **/
commands.onChatInputCommandInteraction = async (config, db, client, interaction) => {
    for (const command of commands.ALL) {
        if (typeof command.onChatInputCommandInteraction !== typeof Function) {
            continue;
        }
        if (await command.onChatInputCommandInteraction(config, db, client, interaction)) {
            return;
        }
    }
    console.warn(`unhandled interaction:`);
    console.warn(interaction);
};

/**
  * @param {Config} config
  * @param {Database} db
  * @param {Client} client
  * @param {MessageContextMenuCommandInteraction} interaction
  * @async
 **/
commands.onMessageContextMenuCommandInteraction = async (config, db, client, interaction) => {
    for (const command of commands.ALL) {
        if (typeof command.onMessageContextMenuCommandInteraction !== typeof Function) {
            continue;
        }
        if (await command.onMessageContextMenuCommandInteraction(config, db, client, interaction)) {
            return;
        }
    }
    console.warn(`unhandled interaction:`);
    console.warn(interaction);
};

/**
  * @param {Config} config
  * @param {Database} db
  * @param {Client} client
  * @param {MessageContextMenuCommandInteraction} interaction
  * @async
 **/
commands.onInteraction = async (config, db, client, interaction) => {
    if (interaction.isChatInputCommand()) {
        return await commands.onChatInputCommandInteraction(config, db, client, interaction);
    }
    if (interaction.isMessageContextMenuCommand()) {
        return await commands.onMessageContextMenuCommandInteraction(config, db, client, interaction);
    }
    console.warn(`unhandled interaction:`);
    console.warn(interaction);
};

export default commands;
