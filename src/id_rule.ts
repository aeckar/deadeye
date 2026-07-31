import { ALPHA, DIGIT } from "./utils/constants"
import { Member } from "./utils/types"

/** Any input to {@link IdRule.resolve}. */
export type IdRuleResolvable = IdRule | Member<typeof IdRulePreset> | [string, string]

/** Contains the possiblities for the first and subsequent characters in an identifier. */
export class IdRule {
    private constructor(
        readonly startPool: string,
        readonly partPool: string,
    ) {}

    isStart(ch: string): boolean {
        return this.startPool.includes(ch)
    }

    isPart(ch: string): boolean {
        return this.partPool.includes(ch)
    }

    static newInstance(startPool: string, partPool: string): IdRule {
        return new this(startPool, partPool)
    }

    /**
     * Presets:
     * - `STRICT`: ["", ""]
     * - `C_LIKE`: [ALPHA + "_", ALPHA + DIGIT + "_"]
     */
    static resolve(key: IdRuleResolvable): IdRule {
        if (key instanceof IdRule) {
            return key
        }
        return typeof key === 'string'
            ? IdRulePreset[`__${key}`]
            : IdRule.newInstance(key[0], key[1])
    }
}

/**
 * # API
 *
 * Members should not be accessed directly,
 * but should instead be obtained from {@link Language.resolve}.
 */
export class IdRulePreset {
    // https://stackoverflow.com/a/3609335/14178487
    /** Ensures identifiers never occur next to any starting or partial characters. */
    static __STRICT = IdRule.newInstance('', '')

    static __C_LIKE = IdRule.newInstance(ALPHA + '_', ALPHA + DIGIT + '_')
}
