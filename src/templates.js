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

export default templates;
