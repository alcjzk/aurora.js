import {
    Client,
    ApplicationCommand,
    ApplicationCommandType,
    InteractionContextType,
    PermissionFlagsBits,
    CommandInteraction
} from 'discord.js';

import { Database } from 'sqlite';
import { Config } from '../Config.js';
import Event from '../Event.js';
import util from '../util.js';

const NAME = 'testupdateparticipantcount';

/** @type {ApplicationCommand} */
export const TestUpdateParticipantCountCommand = {
    type: ApplicationCommandType.ChatInput,
    name: NAME,
    contexts: [InteractionContextType.Guild],
    defaultMemberPermissions: [PermissionFlagsBits.Administrator],
    description: 'Test update participant count for test event',
    /**
      * @param {Config} config
      * @param {Database} db
      * @param {Client} client
      * @param {CommandInteraction} interaction
      * @returns {Promise<boolean>} true if interaction was handled by the command
     **/
    onChatInputCommandInteraction: async (config, db, client, interaction) => {
        if (interaction.commandName !== NAME) {
            return false;
        }

        const events = await Event.selectAll(db);
        const event = events.find(e => e.title === 'Test Event');

        if (event === undefined) {
            util.interactionReplyEphemeralText(
                interaction,
                `No test event was found`,
            );
            return true;
        }

        await event.updateParticipantCount(config, db, client, event.participant_count + 1);

        util.interactionReplyEphemeralText(
            interaction,
            `Ran test`,
        );
        return true;
    },
};

