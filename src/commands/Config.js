import {
    ApplicationCommand,
    ApplicationCommandType,
    InteractionContextType,
    CommandInteraction,
    ApplicationCommandOptionType,
    ChannelType,
    MessageFlags,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageComponentInteraction,
} from 'discord.js';

import { Context } from '../Context.js';
import util from '../util.js';
import * as log from '../log.js';

/** @type {ApplicationCommand} */
export const ConfigCommand = {};

const pending = [];

/** @extends {ApplicationCommandSubCommand} */
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

/** @type {InteractionButtonComponentData} */
ConfigEventVoteSubCommand.ConfirmButton = {
    custom_id: `button_confirm`,
    style: ButtonStyle.Danger,
    label: `Yes I'm sure`,
};

/** @type {InteractionButtonComponentData} */
ConfigEventVoteSubCommand.CancelButton = {
    custom_id: `button_cancel`,
    style: ButtonStyle.Secondary,
    label: `No, cancel`,
};

/**
  * @param {Snowflake} channel_id
  * @returns {MessagePayload}
 **/
ConfigEventVoteSubCommand.successResponse = channel_id => {
    return {
        content: `Event voting channel set to <#${channel_id}>`,
        flags: MessageFlags.Ephemeral,
        components: [],
    };
};

/**
  * @param {Context} ctx
  * @param {CommandInteraction} interaction
  * @async
 **/
ConfigEventVoteSubCommand.onChatInputCommandInteraction = async (ctx, interaction) => {
    const channel_id = interaction.options.get('channel', true).channel.id;

    await interaction.deferReply({
        flags: MessageFlags.Ephemeral,
    });

    if (ctx.config.isInitialized()) {
        await interaction.editReply({
            content: util.stripInlineString(`
            Event voting is already configured. Changing the voting channel will cause any messages in
            the original channel to become ignored, and only new events will be posted to the new
            channel. Are you sure you want to change this config value?
            `),
            components: [new ActionRowBuilder({
                components: [
                    new ButtonBuilder(ConfigEventVoteSubCommand.ConfirmButton),
                    new ButtonBuilder(ConfigEventVoteSubCommand.CancelButton),
                ],
            })],
            flags: MessageFlags.Ephemeral,
        });
        pending.push(interaction);
        return;
    }

    await ctx.config.set(ctx.db, 'channel_id_event_vote', channel_id);
    await interaction.editReply(ConfigEventVoteSubCommand.successResponse(channel_id));
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

/**
  * @param {Context} _ctx
  * @param {MessageComponentInteraction} interaction
  * @returns {Promise<boolean>} true if interaction was handled by the command
 **/
ConfigCommand.onMessageComponentInteraction = async (_ctx, interaction) => {
    if (interaction.customId === ConfigEventVoteSubCommand.ConfirmButton.custom_id) {
        await interaction.deferUpdate();
        /** @type {CommandInteraction} */
        const original_interaction = pending.find(i => i.id == interaction.message.interactionMetadata.id);
        log.info(`event vote channel was overriden by ${interaction.user.displayName} ${interaction.user.id}`);
        const channel_id = original_interaction.options.get('channel', true).channel.id;
        await original_interaction.editReply(ConfigEventVoteSubCommand.successResponse(channel_id));
        return true;
    }
    if (interaction.customId === ConfigEventVoteSubCommand.CancelButton.custom_id) {
        await interaction.deferUpdate();
        /** @type {CommandInteraction} */
        const original_interaction = pending.find(i => i.id == interaction.message.interactionMetadata.id);
        await original_interaction.deleteReply();
        return true;
    }

    return false;
};
