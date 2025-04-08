import {
    ApplicationCommand,
    ApplicationCommandType,
    InteractionContextType,
    CommandInteraction
} from 'discord.js';

import { Context } from '../Context.js';
import Event from '../Event.js';
import util from '../util.js';

const NAME = 'testupdateparticipantcount';

/** @type {ApplicationCommand} */
export const TestUpdateParticipantCountCommand = {
    type: ApplicationCommandType.ChatInput,
    name: NAME,
    contexts: [InteractionContextType.Guild],
    defaultMemberPermissions: [],
    description: 'Test update participant count for test event',
    /**
      * @param {Context} ctx
      * @param {CommandInteraction} interaction
      * @returns {Promise<boolean>} true if interaction was handled by the command
     **/
    onChatInputCommandInteraction: async (ctx, interaction) => {
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

        await event.updateParticipantCount(ctx.config, ctx.db, ctx.client, event.participant_count + 1);

        util.interactionReplyEphemeralText(
            interaction,
            `Ran test`,
        );
        return true;
    },
};

