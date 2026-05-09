# **1.0.0** Command Chording

## **1.1.0** Overview

_Chords_ are sequences of 2-4 characters that immediately perform an action before being deleted.
When combined, they create an ergonomic editing system designed to:

- Minimize hand travel
- Eliminate the use of pinky-heavy modifier keys
- Encourage fluent programming

If a chord is triggered accidentally, you can press undo and the cursor will be returned to the raw
character sequence.

Some chords require an argument, which might be:

- A line number
- An identifer
- A file name

These are supplied immediately after the chord, and must be preceded by a trigger.
By default, `SPACE` is the trigger, but this can be changed in `settings.json`.

```json
"aeckar.minify.chords": {
    "enabled": boolean | "triggerOnly" = true,
    "trigger": String = " ",
},
```

Chords typically consist of 3 characters (or 4, with a modifier), where they take the form:

```
command target-modifier? target context
```

and reads as:

```bash
run 'command' on 'target' in 'context'
```

## **1.2.0** Quick Reference

### **1.2.1** Commands

| Mnemonic | Command         | Description                    |
| :------- | :-------------- | :----------------------------- |
| f        | <u>f</u>ind     | move cursor to target          |
| i        | <u>i</u>nsert   | insert item                    |
| e        | <u>e</u>mplace  | insert item, then move cursor  |
| d        | <u>d</u>elete   | remove item                    |
| c        | <u>c</u>hange   | removed item, then move cursor |
| v        | mo<u>v</u>e     | move cursor                    |
| r        | <u>r</u>egister | copy target                    |
| t        | <u>t</u>ake     | cut target                     |
| u        | o<u>u</u>ter    | move cursor to scope marker    |

### **1.2.2** Targets

| Mnemonic | Meaning                           |
| :------- | :-------------------------------- |
| d        | <u>d</u>eclaration                |
| i        | <u>i</u>mplementation             |
| f        | <u>f</u>ile                       |
| j        | line                              |
| r        | <u>r</u>ound brackets/parentheses |
| s        | <u>s</u>quare brackets            |
| c        | <u>c</u>urly brackets             |

| Modifier | Meaning                              |
| :------- | :----------------------------------- |
| u        | incl<u>u</u>de brackets in selection |

### **1.2.3** Contexts

| Mnemonic | Meaning             |
| :------- | :------------------ |
| j        | at cursor           |
| k        | global              |
| u        | <u>u</u>p/end/outer |
| m        | down/start/inner    |

## **1.3.1** Find

**Mnemonic:** `f`

## **1.3.2** Insert

**Mnemonic:** `i`

# **2.0.0** Modal Editing

## **2.1.0** Overview

```json
"aeckar.minify.modal": {
    "enabled": boolean | "triggerOnly" = true,
    "trigger": String = " ",
    "moveLayout": "minify" | "vim" = "minify",
},
```

## **2.2.0** Quick Reference

| Trigger | Action                             |
| :------ | :--------------------------------- |
| df      | enter wor<u>d</u> <u>f</u>ind mode |
| `ESC`   | enter movement mode                |

## **2.3.0** Find Word

**Trigger:** `df`



## **2.4.0** Movement

**Trigger:** `ESC` (escape key)
