import { Embed, MessageContextMenuCommandInteraction, CommandInteraction, MessageFlags, EmbedBuilder } from 'discord.js';
import anydate from 'any-date-parser';
const util = {};

/**
  * @async 
  * @param {MessageContextMenuCommandInteraction | CommandInteraction} interaction
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
