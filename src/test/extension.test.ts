import * as assert from 'assert';
import * as vscode from 'vscode';
import * as myExtension from '../extension';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('Sample test', () => {
		assert.strictEqual(-1, [1, 2, 3].indexOf(5));
		assert.strictEqual(-1, [1, 2, 3].indexOf(0));
	});
});

/*
Tape — pure data structure, trivially testable
consumeRustTarget — pure function, just needs a tape and returns a string
The chord resolvers — if you construct a CompletionResolverContext with a fake tape and position, you can test them without an editor
The scope scanner (once written) — just needs raw text and a cursor position
The chord conflict checker — pure logic
*/
