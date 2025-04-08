import {
    ApplicationCommand,
    ApplicationCommandType,
    InteractionContextType,
    CommandInteraction,
    ApplicationCommandOptionType,
    ChannelType,
    MessageFlags,
} from 'discord.js';

import { Context } from '../Context.js';
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
  * @param {Context} ctx
  * @param {CommandInteraction} interaction
 **/
ConfigEventVoteSubCommand.onChatInputCommandInteraction = async (ctx, interaction) => {
    const channel_id = interaction.options.get('channel')?.channel?.id;

    if (!channel_id) {
        await util.interactionReplyEphemeralText(
            interaction,
            `Something went wrong!`,
        );
        return;
    }

    await interaction.deferReply({
        flags: MessageFlags.Ephemeral,
    });

    await ctx.config.set(ctx.db, 'channel_id_event_vote', channel_id);

    await interaction.editReply({
        content: `Event voting channel set to <#${channel_id}>`,
        flags: MessageFlags.Ephemeral,
    });
};

ConfigCommand.name = 'config';
ConfigCommand.type = ApplicationCommandType.ChatInput;
ConfigCommand.contexts = [InteractionContextType.Guild];
ConfigCommand.defaultMemberPermissions = [];
ConfigCommand.description = 'Configure the app';
ConfigCommand.options = [
    ConfigEventVoteSubCommand,
];

/**
  * @param {Context} ctx
  * @param {CommandInteraction} interaction
  * @returns {Promise<boolean>} true if interaction was handled by the command
 **/
ConfigCommand.onChatInputCommandInteraction = async (ctx, interaction) => {
    if (interaction.commandName !== ConfigCommand.name) {
        return false;
    }

    const subcommand = interaction.options.data[0];

    if (subcommand.name === ConfigEventVoteSubCommand.name) {
        await ConfigEventVoteSubCommand.onChatInputCommandInteraction(ctx, interaction);
    }

    return true;
};

