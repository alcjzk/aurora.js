import anydate_parser from 'any-date-parser';
import util from './util.js';

const templates = {};

templates.eventDescription = ({ description, start, finish, prizes, url }) => `\
⸻	
${description}
⸻	
**Starts:** ${util.formatDate(anydate_parser.fromString(start))}

**Ends:** ${util.formatDate(anydate_parser.fromString(finish))}

**Prizes:** ${prizes}

**Url:** ${url}
⸻	
`;

templates.participantThresholdReached = (title, start, message_url) => `\
An event you voted for has reached the participant threshold and will be started!

Event: ${title}
Starting: ${util.formatTimestamp(start)}
Event info: ${message_url}
`;

export default templates;
