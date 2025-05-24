import { Embed, MessageFlags, EmbedBuilder } from 'discord.js';
import anydate from 'any-date-parser';
const util = {};

/**
  * @typedef {import('discord.js').MessageContextMenuCommandInteraction} MessageContextMenuCommandInteraction
  * @typedef {import('discord.js').CommandInteraction} CommandInteraction
 **/

/**
  * @param {MessageContextMenuCommandInteraction | CommandInteraction} interaction
  * @param {string} text
  * @async
 **/
util.interactionReplyEphemeralText = async (interaction, text) => {
    await interaction.reply({
        content: text,
        flags: MessageFlags.Ephemeral,
        withResponse: true,
    });
};

/**
  * @async
  * @param {MessageContextMenuCommandInteraction} interaction
 **/
util.interactionReplyNoEvent = async (interaction) => {
    await util.interactionReplyEphemeralText(
        interaction,
        'This message has no active event associated with it.',
    );
};

/**
  * @param {Embed} embed
  * @param {string} name
  * @param {string} value
  * @param {boolean | undefined} inline
  * @returns {Embed}
 **/
util.setEmbedFieldByName = (embed, name, value, inline) => {
    const field_index = embed.fields.findIndex(f => f.name == name);
    if (field_index === -1) {
        embed.fields.push({
            name,
            value,
            inline,
        })
        return embed;
    }
    embed.fields[field_index].value = value;
    if (inline !== undefined) {
        embed.fields[field_index].inline = inline;
    }
    return embed;
};

/**
  * @param {Embed} embed
  * @param {Number} color
  * @returns {Embed}
 **/
util.setEmbedColor = (embed, color) => {
    const builder = new EmbedBuilder(embed.data);
    builder.setColor(color);
    return new Embed(builder.data);
};

/**
  * @param {Date} date
 **/
util.formatDate = (date) => {
    return util.formatTimestamp(util.dateToTimestamp(date));
};

/**
  * @param {Number} timestamp
 **/
util.formatTimestamp = (timestamp) => {
    return `<t:${timestamp}:F> (<t:${timestamp}:R>)`;
};

/**
  * @param {Number} timestamp
 **/
util.formatTimestampShort = (timestamp) => {
    return `<t:${timestamp}:R>`;
};

/**
  * @param {Date} date
 **/
util.dateToTimestamp = (date) => {
    return Math.trunc(date.getTime() / 1000);
};

util.stringToTimestamp = (s) => {
    return util.dateToTimestamp(anydate.fromString(s));
};

/**
  * Current unix timestamp.
  * @param {Number} date
 **/
util.now = () => {
    return util.dateToTimestamp(new Date());
};

/**
  * Returns a new string with line breaks and indentations removed.
  * @param {string} str
  * @returns {string}
 **/
util.stripInlineString = (str) => {
    return str.replace(/\n\s*/g, ' ');
};

/**
  * @param {string} str
  * @param {Number} length
  * @returns {string}
 **/
util.truncateToLengthWithEllipsis = (str, length) => {
    if (str.length <= length) {
        return str;
    }

    const ellipsis = '...';

    if (length <= 3) {
        return ellipsis.slice(0, length);
    }

    return str.slice(0, length - ellipsis.length) + ellipsis;
};

export default util;
