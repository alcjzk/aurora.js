import {
    Client,
    ApplicationCommand,
    ApplicationCommandType,
    InteractionContextType,
    PermissionFlagsBits,
    MessageContextMenuCommandInteraction
} from 'discord.js';

import { Database } from 'sqlite';
import { Config } from '../Config.js';
import Event from '../Event.js';
import util from '../util.js';

const NAME = 'Skip Event';

/** @type {ApplicationCommand} */
export const SkipEventCommand = {
    type: ApplicationCommandType.Message,
    name: NAME,
    contexts: [InteractionContextType.Guild],
    defaultMemberPermissions: [PermissionFlagsBits.Administrator],
    /**
      * @param {Config} config
      * @param {Database} db
      * @param {Client} client
      * @param {MessageContextMenuCommandInteraction} interaction
      * @returns {Promise<boolean>} true if interaction was handled by the command
     **/
    onMessageContextMenuCommandInteraction: async (config, db, client, interaction) => {
        if (interaction.commandName !== NAME) {
            return false;
        }

        const event = await Event.selectByMessageId(db, interaction.targetMessage.id);

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

        await event.skip(config, db, client);

        await util.interactionReplyEphemeralText(
            interaction,
            `Event '${event.title}' has been skipped.`
        );

        return true;
    },
};

