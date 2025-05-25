import { ApplicationCommandType, InteractionContextType, PermissionFlagsBits } from 'discord.js';
import Event from '../Event.js';
import util from '../util.js';

/**
  * @typedef {import('discord.js').ApplicationCommand} ApplicationCommand
  * @typedef {import('discord.js').MessageContextMenuCommandInteraction} MessageContextMenuCommandInteraction
  * @typedef {import('../Context.js').Context} Context
 **/

const NAME = 'Skip Event';

/** @type {ApplicationCommand} */
export const SkipEventCommand = {
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

        if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
            await util.interactionReplyEphemeralText(
                interaction,
                'Events can only be skipped by an admin.',
            );
            return true;
        }

        if (event.is_skipped) {
            await util.interactionReplyEphemeralText(
                interaction,
                'This event is already skipped.',
            );

            return true;
        }

        if (event.is_started) {
            await util.interactionReplyEphemeralText(
                interaction,
                'Cannot skip an event that was already started.',
            );

            return true;
        }

        if (event.shouldExpire()) {
            await util.interactionReplyEphemeralText(
                interaction,
                'This event has expired.',
            );

            return true;
        }

        await event.skip(ctx);

        await util.interactionReplyEphemeralText(
            interaction,
            `Event '${event.title}' has been skipped.`
        );

        const events = await Event.selectAll(ctx.db);
        await ctx.event_list_message.update(ctx, events);

        return true;
    },
};

