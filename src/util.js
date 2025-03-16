import { Embed } from 'discord.js';
import anydate from 'any-date-parser';
const util = {};

/**
  * @async 
  * @param {MessageContextMenuCommandInteraction} interaction
  * @param {string} text
 **/
util.interactionReplyEphemeralText = async (interaction, text) => {
    await interaction.reply({
        content: text,
        flags: MessageFlags.Ephemeral,
        withResponse: true,
    });
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
  * @param {Date} date
 **/
util.formatDate = (date) => {
    const timestamp = date.getTime() / 1000;

    return `<t:${timestamp}:F> (<t:${timestamp}:R>)`;
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

export default util;
