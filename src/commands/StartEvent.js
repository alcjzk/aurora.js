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

const NAME = 'Start Event';

/** @type {ApplicationCommand} */
export const StartEventCommand = {
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
            if (event.attending_ids.length < config.threshold_event_participants) {
                await util.interactionReplyEphemeralText(
                    interaction,
                    `Events with less than ${config.threshold_event_participants} participants can only be started by an admin.`,
                );
                return true;
            }
            if (event.start > util.now() + config.s_min_time_allow_start) {
                await util.interactionReplyEphemeralText(
                    interaction,
                    `Events starting in more than than ${config.s_min_time_allow_start} seconds can only be started by an admin.`,
                );
                return true;
            }
        }

        await event.doStart(config, db, client, true);
        await util.interactionReplyEphemeralText(interaction, 'Event started!');

        return true;
    },
};

