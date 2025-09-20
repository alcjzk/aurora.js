export class Bitflags {
    /** @type {number} */
    #value;

    /** *
     * @param {number} [value=0]
     **/
    constructor(value = 0) {
        this.#value = value;
    }

    /**
     * @returns {number}
     **/
    toNumber() {
        return this.#value;
    }

    /**
     * @param {number} flag
     * @returns {bool}
     **/
    isSet(flag) {
        return (this.#value & flag) != 0;
    }

    /**
     * @param {number} flag
     **/
    set(flag) {
        this.#value |= flag;
    }

    /**
     * @param {number} flag
     **/
    unset(flag) {
        this.#value &= (~flag);
    }
}
