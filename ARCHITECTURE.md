# Architecture

## Overview

```mermaid
%%{init: {'flowchart': {'defaultRenderer': 'elk'}}}%%
graph TD
    %% Styling for dotted outline services
    classDef serviceStyle stroke-dasharray: 5 5;

    %% Top Level Subgraphs
    subgraph LanguageTargets["Language Targets"]
        LangInfoSvc["Language Info Service"]
    end

    subgraph StaticAnalysis["Static Analysis"]
        Text["Text"]
        Tokens["Token Array"]
        Scopes["Scope Interval Tree"]
        IntervalTreeSvc["Interval Tree Service"]
        IntervalTree["Interval Tree"]
        LangAPI{{"Language API"}}
        ScopeAPI{{"Scope API"}}
    end

    subgraph DocumentState["Document State"]
        DocInfoSvc["Document Info Service"]
        DocInfo["Document Info"]
        DocInfoSvc --> DocInfo
    end

    %% Lower Flow Subgraphs
    subgraph EditorUI["Editor UI"]
        ScopeBreadcrumbsSvc["Scope Breadcrumbs Service"]
        ScopeExplorerSvc["Scope Explorer Service"]
        TokenExplorerSvc["Token Explorer Service"]

        ScopeBreadcrumbs(["Scope Breadcrumbs"])
        ScopeExplorer(["Scope Explorer"])
        TokenExplorer(["Token Explorer"])
    end

    subgraph InsertText["Insert Text"]
        TextInsertionSvc["Text Insertion Service"]
        InterceptKeystrokes(["Intercept Keystrokes"])
        CompletionContext["Completion Context"]
        CompletionAPI{{"Completion API"}}
        Completion["Completion"]
        CompletionStrategy["Completion Strategy"]
        RunCompletion(["Run Completion"])

        TextInsertionSvc --> InterceptKeystrokes
        InterceptKeystrokes --> CompletionContext
    end

    subgraph DeleteText["Delete Text"]
        TextDeletionSvc["Text Deletion Service"]
        InterceptDeletions(["Intercept Deletions"])
        SmartDelete(["Smart Delete"])

        TextDeletionSvc --> InterceptDeletions
        InterceptDeletions --> SmartDelete
    end

    %% Dependencies from Language Targets
    LanguageTargets --> DocumentState
    LanguageTargets --> InsertText

    %% Internal Static Analysis Flow
    Text --> LangAPI
    LangAPI --> Tokens
    Tokens --> ScopeAPI
    ScopeAPI --> Scopes
    IntervalTreeSvc --> IntervalTree
    IntervalTree --> ScopeAPI

    %% Flow between Analysis & State
    StaticAnalysis --> DocumentState
    DocInfo -.->|"Document Change?"| Text

    %% Event Dispatching from Document State
    DocumentState -.->|"Document Change?"| EditorUI
    DocumentState -.->|"Keystroke?"| InsertText
    DocumentState -.->|"Deletion?"| DeleteText

    %% UI Services Output
    ScopeBreadcrumbsSvc --> ScopeBreadcrumbs
    ScopeExplorerSvc --> ScopeExplorer
    TokenExplorerSvc --> TokenExplorer

    %% Completion Pipeline Flow
    CompletionContext --> CompletionAPI
    CompletionAPI -.->|"Success?"| Completion
    Completion --> CompletionStrategy
    CompletionStrategy -.->|"Triggered?"| RunCompletion

    %% Services with dotted outlines
    class IntervalTreeSvc,DocInfoSvc,ScopeBreadcrumbsSvc,ScopeExplorerSvc,TokenExplorerSvc,TextInsertionSvc,TextDeletionSvc,LangInfoSvc serviceStyle;
```

## `scope.ts` — Scope Span

Provides a simple data structure to denote a scope as the start and end indices of a substring.

This file is a common dependency to both the Completion API and Scope API.

## `tape.ts` — Cursor

`Tape` is the most fundamental data structure used by this extension. It is a cursor over string, and provides many utilities for procedural parsing of substrings.

Unlike similar extensions, such as [HyperSnips](https://marketplace.visualstudio.com/items?itemName=draivin.hsnips), we rarely use regular expressions to parse documents. Through direct comparison, regex has been shown to be both slower and less capable. In contrast, `Tape` provides the ability to backtrack and perform recursive descent with minimal cost.

The downside of using a cursor is that parsing logic must largely be written by hand. Although parsing primitives are provided (e.g. `consume`, `seek`, `isAt`), combining them to recognize complex syntax must still be done by the user. In our experience, this is worth the performance gain, and it has made finding parsing logic errors much easier to find.

## `extension.ts` — Startup/Shutdown

The entry point, like for all other extensions, is the `activate` function. This function should have no other purpose than to activate all services and handle errors during activation.

```ts
function activate(context: ExtensionContext) {
    try {
        // activate services by passing context
        // log success
    } catch (e) {
        // handle and log fatal errors during activation
    }
}
```

The exit point, `deactivate`, should serve no other purpose than to log successful deactivation. Since the extension lives entirely within the VS Code runtime, no deactivation logic is necessary.

```ts
function deactivate() {
    // log success
}
```

## `api/` — Language Configuration APIs

Three configuration APIs are implemented, each providing information about a document depending on the language it is written in. Each comprises of a variety of classes and utilities that perform related functions. They each provide robust configurations for declaring how a language should behave.

The Language API, defined in `language.ts`, permits declaring what tokens exist within a language. This enables the integrated lexer to tokenize any document in that language. Tokens can be any of the following: string, keyword (whole string), regex, matcher on `Tape`.

The Scopes API, defined in `scopes.ts`, permits declaring what scopes exist within a language.
This enables contextual decision-making as to whether a completion can fire or not.

The Completion API, defined in `completions.ts`, permits declaring what completions should be available on every keystroke, given the tokens and scopes found for the document in the context passed to each completion resolver.

```mermaid
%%{init: {'flowchart': {'defaultRenderer': 'elk'}}}%%
graph TD
    LangAPI{{"Language API"}} --> ScopeAPI{{"Scopes API"}}
    LangAPI --> CompletionAPI{{"Completion API"}}
    ScopeAPI --> CompletionAPI
```

## `services/` — Services

**Services** are classes that implement the singleton pattern through their static instance. All services provide a `start` function, declare a private constructor, and contain no functions returning an instance of that class. After `start` is called, a feature is added to the editor environment for as long as the extension is active. Services have no public properties.

```ts
class BasicService {
    // No public properties

    private constructor() {}

    static start(ctx: ExtensionContext) {
        // Initialization logic, such as pushing subscriptions
    }
}
```

`start` is `async`, and can expect either no arguments or a single `vscode.ExtensionContext`. The only time that the initializer should be called is once within `activate`.

Although all services are initialized at extension activation, some services may depend on other services. Therefore, `start` for any immediate dependencies should be called in a service's own initializer. Because multiple instances of the same dependency may exist, `start` is made to be idempotent.

```ts
    // text_insertion_service.ts
    static async start(ctx: ExtensionContext) {
        if (this.isActive) {
            return
        }
        await DocumentInfoService.start(ctx)
        await LanguageInfoService.start()
        // ...
    }
```

Service classes can also contain static mutable fields to be used by the various static utility functions provided by that service. Though it is tempting to declare a common service `interface`, static object are not permitted to extend interfaces. Therefore, compliance to the service pattern cannot be strictly enforced without transferring responsibility to a class instance. To make things simple, we have decided not to pursue this pattern.

Files declaring services end in `_service.ts`. The service class declared in each of these files is the default export. These files may also contain utilities and other classes that are tightly coupled to the service (e.g. `IntervalTree` for `IntervalTreeService`).

## `test/` — Unit Tests

The testing suite relies on VS Code's extension testing runner (`@vscode/test-electron`) to execute tests inside an actual instance of the editor environment.

Unit tests are dispatched and synced using [Mocha](https://mochajs.org/).

- `runTests.ts`: Initializes Mocha and reads `.test.ts` files before delegating to the test runner.
- `<...LANG_ID>.test.ts`: Unit test suite for each supported language.

When writing unit tests, favor testing `Tape` parsing logic and scope resolution over simulating user input streams, since unit-level cursor assertions execute significantly faster and yield clearer stack traces.

## `lang/` — Language Targets

Declares the completion registry, `Language`, and scope registry for each supported language, organized by their [identifier](https://code.visualstudio.com/docs/languages/identifiers). These are top-level objects declared by configuring an instance for each configuration API.

This directory may contain domain-specific utilities to be used by any of the three API implementations.

## `utils/` — Domain-Agnostic Utilities

Contains many small, domain-agnostic utilities.
