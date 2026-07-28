# Code Style & Conventions

This document outlines TypeScript code style guidelines for this project. These guidelines supplement standard formatting and should be followed manually during development.

## 1. Functions & Closures

- **Top-Level Functions:** Use the `function` keyword rather than `const` arrow function expressions. This makes top-level functions easily distinguishable from top-level constants

```ts
// Preferred
function processDocument(text: string): Tokens { ... }

// Avoid
const processDocument = (text: string): Tokens => { ... };
```

- **Arrow Functions:** Reserve arrow functions for closures capturing scope variables, callback parameters, or implementing inline closure types
- **Internal Helper Functions:** Place inner/nested helper functions at the very end of the containing function body to keep the primary logic prominent for readability
- **Closure Arguments:** Arguments passed to closures for basic functional operations (e.g. `map`, `find`, `filter`) should be named a single letter. This includes destructured arguments, but does not apply when arguments are of different types

## 2. Object-Oriented Patterns & Types

## Factory Methods

- Factory methods should use the `this` type to create an instance of the enclosing class without being affected by renaming
- Instances created in factory methods should be stored in a local variable named `self`

### Classes vs. Types

- Prefer `class` definitions over `type` aliases unless creating a simple type alias or a configuration type that is never persists as a property
- Configuration objects should be passed whenever a function expects a complex argument array with many slots, a variable number of slots, or nested objects that should be instantiated at the call site
- Configuration types should be derived from `Record` (or any other plain JS object) and end in `Cfg`

### Branding & Private Properties

- **Newtype/Type Branding:** Use nominal type branding (`__brand`) when custom initialization logic is needed without forcing consumer code to go through intermediate accessors (e.g., avoiding `registry.entries.get(' ')`)
- **Private Properties:** Avoid the `#` private identifier inside standard object literal types (`{}`). Use standard TypeScript access modifiers (`private`/`protected`) on class constructs
- **Restricting Inheritance:** To restrict class inheritance, restrict constructor visibility (e.g., `private constructor()`) and use factory methods when possible

## 3. Data Structures & Performance Rules

### Maps vs. Records

- Use `Record` objects for inputs/configurations
- Use `Map` objects for internal state, persistence, and output collections

### Regular Expressions Performance

- Direct string comparison (`===`) is faster than a regex match for the same string
- Always use the sticky flag (`/y`) for performance when parsing sequential tokens
- Always use non-capturing groups (`(?:...)`) unless capturing is strictly required
- Prefer `\s\S` over `.` when matching across line breaks, as `.` does not match newlines

## 4. TypeScript Language Conventions

- **Falsy Checks & `undefined`:** Always perform explicit `=== undefined` checks for `string` and `number` types. Relying on implicit truthiness checks (`!val`) creates subtle bugs because `0` and `""` are falsy. Arrays are allowed to be implicitly converted.
- **`null` vs. `undefined`:** Use `null` instead of `undefined` when explicitly clearing or declaring optional properties or variables.
- **Namespaces:** Do not use namespaces, they are a legacy feature

## 5. Naming Conventions

- **Flat Naming:** Keep names flat and unnested where possible to reduce code duplication and simplify imports across the codebase.
- Indexes should use the `idx` naming convention

### Booleans vs. Indices

- Use `begin` for boolean flags or starting boundaries (e.g., `isBegin`)
- Use `start` strictly for specific index numbers (e.g., `startIdx`)

## 6. Operators

- **Prefix Operators:** Prefer prefix operators over postfix

```ts
++idx // Prefer
idx++ // Avoid
```