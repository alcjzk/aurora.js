import process from 'node:process';

export const LogLevel = Object.freeze({
    NONE: 0,
    ERRO: 1,
    WARN: 2,
    INFO: 3,
    TRAC: 4,
});

const LOG_LEVEL_DEFAULT = LogLevel.TRAC;

const level = (() => {
    switch (process.env.LOG_LEVEL) {
        case 'ERRO':
            return LogLevel.ERRO;
        case 'WARN':
            return LogLevel.WARN;
        case 'INFO':
            return LogLevel.INFO;
        case 'TRAC':
            return LogLevel.TRAC;
        default:
            return LOG_LEVEL_DEFAULT;
    }
})();

const time = () => {
    const date = new Date();

    var sec = date.getSeconds();
    sec = sec < 10 ? `0${sec}` : `${sec}`;

    var min = date.getMinutes();
    min = min < 10 ? `0${min}` : `${min}`;

    var hour = date.getHours();
    hour = hour < 10 ? `0${hour}` : `${hour}`;

    var day = date.getDate();
    day = day < 10 ? `0${day}` : `${day}`;

    var month = date.getMonth();
    month = month < 10 ? `0${month}` : `${month}`;

    return `[${date.getFullYear()}-${month}-${day}][${hour}:${min}:${sec}]`;
}

export const trac = (message) => {
    if (level < LogLevel.TRAC) {
        return;
    }

    console.warn(`${time()}[TRAC] ${message}`);
};

export const info = (message) => {
    if (level < LogLevel.INFO) {
        return;
    }

    console.warn(`${time()}[INFO] ${message}`);
};

export const warn = (message) => {
    if (level < LogLevel.WARN) {
        return;
    }

    console.warn(`${time()}[WARN] ${message}`);
};

export const erro = (message) => {
    if (level < LogLevel.ERRO) {
        return;
    }

    console.warn(`${time()}[ERRO] ${message}`);
};

