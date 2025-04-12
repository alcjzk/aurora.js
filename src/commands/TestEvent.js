import { ApplicationCommandType, InteractionContextType, } from 'discord.js';
import { EventData } from '../ctftime.js';
import Event from '../Event.js';
import util from '../util.js';
import * as log from '../log.js';

/**
  * @typedef {import('discord.js').ApplicationCommand} ApplicationCommand
  * @typedef {import('discord.js').CommandInteraction} CommandInteraction
  * @typedef {import('../Context.js').Context} Context
 **/

const NAME = 'testevent';

/** @type {ApplicationCommand} */
export const TestEventCommand = {
    type: ApplicationCommandType.ChatInput,
    name: NAME,
    contexts: [InteractionContextType.Guild],
    defaultMemberPermissions: [],
    description: 'Create a test event.',
    /**
      * @param {Context} ctx
      * @param {CommandInteraction} interaction
      * @returns {Promise<boolean>} true if interaction was handled by the command
     **/
    onChatInputCommandInteraction: async (ctx, interaction) => {
        if (interaction.commandName !== NAME) {
            return false;
        }

        if (!ctx.config.channel_id_event_vote) {
            await util.interactionReplyEphemeralText(
                interaction,
                'Event voting channel is not configured!',
            );
            return true;
        }

        const event_data = EventData.test();
        const event = Event.fromData(event_data);
        const message = await event_data.createMessage(ctx.client, ctx.config.channel_id_event_vote);
        await message.react(ctx.config.emoji_vote);
        event.message_id = message.id;
        await event.insert(ctx.db);

        log.info('created test event');

        await event.schedule(ctx);

        await util.interactionReplyEphemeralText(
            interaction,
            'Test event created!',
        );

        return true;
    },
};

