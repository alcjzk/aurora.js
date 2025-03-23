import {
    Client,
    ApplicationCommand,
    ApplicationCommandType,
    InteractionContextType,
    PermissionFlagsBits,
    CommandInteraction,
    ApplicationCommandOptionType,
    ChannelType,
} from 'discord.js';

import { Database } from 'sqlite';
import { Config } from '../Config.js';
import util from '../util.js';

/** @type {ApplicationCommand} */
export const ConfigCommand = {};

/** @type {ApplicationCommandSubCommand} */
const ConfigEventVoteSubCommand = {
    name: 'event-vote',
    type: ApplicationCommandOptionType.Subcommand,
    description: 'event voting settings',
    options: [
        {
            name: 'channel',
            type: ApplicationCommandOptionType.Channel,
            description: 'channel used for event voting',
            channelTypes: [ChannelType.GuildText],
            required: true,
        }
    ],
};

/**
  * @param {Config} config
  * @param {Database} db
  * @param {Client} client
  * @param {CommandInteraction} interaction
 **/
ConfigEventVoteSubCommand.onChatInputCommandInteraction = async (config, db, client, interaction) => {
    const channel_id = interaction.options.get('channel')?.channel?.id;

    if (!channel_id) {
        await util.interactionReplyEphemeralText(
            interaction,
            `Something went wrong!`,
        );
        return;
    }

    await config.set(db, client, 'channel_id_event_vote', channel_id);

    await util.interactionReplyEphemeralText(
        interaction,
        `Event voting channel set to <#${channel_id}>`,
    );
};

ConfigCommand.name = 'config';
ConfigCommand.type = ApplicationCommandType.ChatInput;
ConfigCommand.contexts = [InteractionContextType.Guild];
ConfigCommand.defaultMemberPermissions = [PermissionFlagsBits.Administrator];
ConfigCommand.description = 'Configure the app';
ConfigCommand.options = [
    ConfigEventVoteSubCommand,
];

/**
  * @param {Config} config
  * @param {Database} db
  * @param {Client} client
  * @param {CommandInteraction} interaction
  * @returns {Promise<boolean>} true if interaction was handled by the command
 **/
ConfigCommand.onChatInputCommandInteraction = async (config, db, client, interaction) => {
    if (interaction.commandName !== ConfigCommand.name) {
        return false;
    }

    const subcommand = interaction.options.data[0];

    if (subcommand.name === ConfigEventVoteSubCommand.name) {
        await ConfigEventVoteSubCommand.onChatInputCommandInteraction(config, db, client, interaction);
    }

    return true;
};

