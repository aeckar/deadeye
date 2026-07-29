/** A valid key in a JavaScript object. */
export type JsKey = string | number | symbol

/**
 * An immutable record whose key values are not exhaustive of type `K`.
 *
 * For example, if `K` is a string union, instances of this type do not need to account
 * for all possible entries.
 */
export type RecordSubset<K extends JsKey, V> = { readonly [Key in K]?: V }

/** Removes a common prefix from a string literal type. */
export type RemovePrefix<
    Prefix extends string,
    T extends string,
> = T extends `${Prefix}${infer Suffix}` ? Suffix : T

/**
 * Evaluates to a string union of all public member keys.
 *
 * Strips "__" from members marked as internal.
 */
export type Member<T> = RemovePrefix<'__', Exclude<keyof T, 'prototype'> & string>
