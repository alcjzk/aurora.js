export const EMBED_DESCRIPTION_MAX_LENGTH = 4096;

/** typedef {import('discord.js').Snowflake} Snowflake */

/**
  * @param {Snowflake} guild_id
  * @param {Snowflake} channel_id
  * @param {Snowflake} message_id
  **/
export const messageUrl = (guild_id, channel_id, message_id) => {
    return `https://discord.com/channels/${guild_id}/${channel_id}/${message_id}`;
};
