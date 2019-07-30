import * as vscode from 'vscode';
import { CursorColumns } from './cursorCommon';

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(vscode.commands.registerTextEditorCommand('smartmulticursor.insertCursorBelow', insertCursorBelow));
	context.subscriptions.push(vscode.commands.registerTextEditorCommand('smartmulticursor.insertCursorAbove', insertCursorAbove));
}

export function deactivate() { }

function insertCursorBelow(textEditor: vscode.TextEditor, edit: vscode.TextEditorEdit) {
	insertCursor(textEditor, true);
}

function insertCursorAbove(textEditor: vscode.TextEditor, edit: vscode.TextEditorEdit) {
	insertCursor(textEditor, false);
}

function insertCursor(textEditor: vscode.TextEditor, below: boolean) {
	let sortedSelections = textEditor.selections.sort((a, b) => (a.end.line - b.end.line));
	let lastSel = sortedSelections[below ? sortedSelections.length - 1 : 0];
	//TODO: maybe the sorted would help animation look better when inserting cursor above?
	let lastLineText = textEditor.document.lineAt(lastSel.end.line).text;
	let nextLine = lastSel.end.line + (below ? 1 : -1);
	if (nextLine >= textEditor.document.lineCount) {
		return;
	}
	let nextLineText = textEditor.document.lineAt(nextLine).text;
	let nextCharacter = -1;

	let ml = matchLine(lastLineText, lastSel.end.character);

	if (ml.fullMatch) {
		// find the occurrance index in last line:
		let occurrenceIndex = 0;
		let i = lastLineText.indexOf(ml.fullMatch);
		while (i >= 0 && i < ml.occurrancePosition) {
			i = lastLineText.indexOf(ml.fullMatch, i + 1);
			occurrenceIndex++;
		}
		// TODO: if we have multiple selections, need to make sure the previous selection also have the same match
		// (we don't want smart-cursor in the middle of regular cursors)
		// find the position of the appropriate occurrance in next line:
		nextCharacter = nextLineText.indexOf(ml.fullMatch);
		while (occurrenceIndex > 0 && nextCharacter >= 0) {
			nextCharacter = nextLineText.indexOf(ml.fullMatch, nextCharacter + 1);
			occurrenceIndex--;
		}
	}
	if (nextCharacter >= 0) {
		nextCharacter += ml.cursorRelative2Match;
	} else {
		// fallback to regular behavior:
		nextCharacter = CursorColumns.columnFromVisibleColumn(nextLineText,
			CursorColumns.visibleColumnFromColumn(lastLineText, lastSel.end.character,
				Number(textEditor.options.tabSize)),
			Number(textEditor.options.tabSize));
	}
	textEditor.selections.push(new vscode.Selection(nextLine, nextCharacter, nextLine, nextCharacter));
	// Trigger an update:
	textEditor.selections = textEditor.selections;
}

function matchLine(line: string, cursor: number) {
	let head = line.slice(0, cursor);
	let tail = line.slice(cursor);

	// TODO: list of trigger characters and build the regex from it. later would be easier to configure
	// TODO: add | > < . [] *
	const reHead = /( ?("|'|=|:|,|;|\(|\)|\t) ?)$/;
	const reTail = /^( ?("|'|=|:|,|;|\(|\)|\t) ?)/;

	let occurrancePosition = 0;
	let cursorRelative2Match = 0;
	let match = reHead.exec(head);
	if (match) {
		if (match[0].endsWith(' ')) {
			cursorRelative2Match = 2;
		} else {
			cursorRelative2Match = 1;
		}
		occurrancePosition = cursor - cursorRelative2Match;
	} else {
		match = reTail.exec(tail);
		if (match) {
			if (match[0].startsWith(' ')) {
				cursorRelative2Match = -1;
			} else {
				cursorRelative2Match = 0;
			}
			occurrancePosition = cursor - cursorRelative2Match;
		}
	}

	return {
		fullMatch: match ? match[2] : null,
		occurrancePosition: occurrancePosition,
		cursorRelative2Match: cursorRelative2Match,
	};
}
