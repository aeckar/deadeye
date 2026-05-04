class CursorStopImpl {}

export const CursorStop = new CursorStopImpl();

export type Slot = {
    id: string;
};

export type Expr = {
    body: string;
};

export type Fragment = Slot | CursorStopImpl | Expr;

export type Snippet = {
    pattern: string;
    isHot: boolean;
    fragments: [Fragment];
};
