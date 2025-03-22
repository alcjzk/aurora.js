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
import { EventData } from '../ctftime.js';
import Event from '../Event.js';
import util from '../util.js';

const NAME = 'testevent';

/** @type {ApplicationCommand} */
export const TestEventCommand = {
    type: ApplicationCommandType.ChatInput,
    name: NAME,
    contexts: [InteractionContextType.Guild],
    defaultMemberPermissions: [PermissionFlagsBits.Administrator],
    description: 'Create a test event.',
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

        const event_data = EventData.test();
        const event = Event.fromData(event_data);
        const message = await event_data.createMessage(client, config.channel_id_event_vote);
        await message.react(config.emoji_vote);
        event.message_id = message.id;
        await event.insert(db);

        console.log('created test event');

        await util.interactionReplyEphemeralText(
            interaction,
            'Test event created!',
        );

        return true;
    },
};

