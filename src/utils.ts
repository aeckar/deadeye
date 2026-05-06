export type Replacement = {
    length: number;
    snippet: string;
}

export type StringRegistry = Map<string, string>;

type FormatterRegistry = {
    [key: string]: (chunks: string[]) => string;
}


export const case: FormatterRegistry = {
    pascal(chunks) {

    },
    scream(chunks) {

    },
    snake(chunks) {

    },
    camel(chunks) {

    }
    kebab(chunks) {

    }
}