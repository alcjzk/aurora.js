import { ApplicationCommandType, InteractionContextType, PermissionFlagsBits } from 'discord.js';
import Event from '../Event.js';
import util from '../util.js';

/**
  * @typedef {import('discord.js').ApplicationCommand} ApplicationCommand
  * @typedef {import('discord.js').MessageContextMenuCommandInteraction} MessageContextMenuCommandInteraction
  * @typedef {import('../Context.js').Context} Context
 **/

const NAME = 'Start Event';

/** @type {ApplicationCommand} */
export const StartEventCommand = {
    type: ApplicationCommandType.Message,
    name: NAME,
    contexts: [InteractionContextType.Guild],
    defaultMemberPermissions: [PermissionFlagsBits.Administrator],
    /**
      * @param {Context} ctx
      * @param {MessageContextMenuCommandInteraction} interaction
      * @returns {Promise<boolean>} true if interaction was handled by the command
     **/
    onMessageContextMenuCommandInteraction: async (ctx, interaction) => {
        if (interaction.commandName !== NAME) {
            return false;
        }

        const event = await Event.selectByMessageId(ctx.db, interaction.targetMessage.id);

        if (event === undefined) {
            await util.interactionReplyNoEvent(interaction);
            return true;
        }

        if (event.is_started) {
            await util.interactionReplyEphemeralText(interaction, 'This event was already started.');
            return true;
        }

        if (event.shouldExpire()) {
            await util.interactionReplyEphemeralText(
                interaction,
                'Cannot start an event that has ended.',
            );
            return true;
        }

        if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
            if (event.attending_ids.length < ctx.config.threshold_event_participants) {
                await util.interactionReplyEphemeralText(
                    interaction,
                    `Events with less than ${ctx.config.threshold_event_participants} participants can only be started by an admin.`,
                );
                return true;
            }
            if (event.start > util.now() + ctx.config.s_min_time_allow_start) {
                await util.interactionReplyEphemeralText(
                    interaction,
                    `Events starting in more than than ${ctx.config.s_min_time_allow_start} seconds can only be started by an admin.`,
                );
                return true;
            }
        }

        await event.doStart(ctx, true);
        await util.interactionReplyEphemeralText(interaction, 'Event started!');

        return true;
    },
};

