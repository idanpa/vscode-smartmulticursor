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
	let lastLineText = textEditor.document.lineAt(lastSel.end.line).text;
	let nextLine = lastSel.end.line + (below ? 1 : -1);
	if (nextLine >= textEditor.document.lineCount) {
		return;
	}
	let nextLineText = textEditor.document.lineAt(nextLine).text;
	let nextCharacter = -1;

	let ml = matchLine(lastLineText, lastSel.end.character);

	// if there's a match and it is consistent with previous lines:
	if (ml.match && allSelectionsMatch(sortedSelections, textEditor.document, ml.match, ml.cursorRelative2Match)) {
		// find the occurrance index in last line:
		let occurrenceIndex = 0;
		let	occurrancePosition = lastSel.end.character - ml.cursorRelative2Match;
		let i = lastLineText.indexOf(ml.match);

		while (i >= 0 && i < occurrancePosition) {
			i = lastLineText.indexOf(ml.match, i + 1);
			occurrenceIndex++;
		}
		// find the position of the appropriate occurrance in next line:
		nextCharacter = nextLineText.indexOf(ml.match);
		while (occurrenceIndex > 0 && nextCharacter >= 0) {
			nextCharacter = nextLineText.indexOf(ml.match, nextCharacter + 1);
			occurrenceIndex--;
		}
	}
	if (nextCharacter >= 0) {
		nextCharacter += ml.cursorRelative2Match;
	// } else if ((lastLineText.length > 0) && // if cursor on the end of none empty lines
	// 	(lastLineText.length === lastSel.end.character) &&
	// 	allSelectionsOnLineEnd(sortedSelections, textEditor.document)) {
	// 	nextCharacter = nextLineText.length;
	} else { // fallback to regular behavior:
		let firstSel = sortedSelections[below ? 0 : sortedSelections.length - 1];
		let firstLineText = textEditor.document.lineAt(firstSel.end.line).text;
		nextCharacter = CursorColumns.columnFromVisibleColumn(nextLineText,
			CursorColumns.visibleColumnFromColumn(firstLineText, firstSel.end.character + 1,
				Number(textEditor.options.tabSize)),
			Number(textEditor.options.tabSize)) - 1;
	}
	textEditor.selections.push(new vscode.Selection(nextLine, nextCharacter, nextLine, nextCharacter));
	// Trigger an update:
	textEditor.selections = textEditor.selections;
}

function matchLine(line: string, cursor: number) {
	let head = line.slice(0, cursor);
	let tail = line.slice(cursor);

	const triggers = '"\'=:,;.(){}[]<>|\t';
	const reGroup = '(\\s?(' + buildOptionRegExp(triggers) + ')\\s?)';
	const reHead = RegExp(reGroup + '$');
	const reTail = RegExp('^' + reGroup);

	let cursorRelative2Match = 0;
	let matchHead = reHead.exec(head);
	let	matchTail = reTail.exec(tail);
	let match = null;

	if (matchHead && matchTail) {
		// we prefer the one without whitespace:
		if (matchTail[0][0].trim() === '') {
			matchTail = null;
		} else {
			matchHead = null;
		}
	}

	if (matchHead) {
		match = matchHead[2];
		if (matchHead[0][matchHead[0].length - 1].trim() === '') { // ends with whitespace
			cursorRelative2Match = 2;
		} else {
			cursorRelative2Match = 1;
		}
	} else if (matchTail) {
		match = matchTail[2];
		if (matchTail[0][0].trim() === '') { // starts with whitespace
			cursorRelative2Match = -1;
		} else {
			cursorRelative2Match = 0;
		}
	}

	return {
		match: match,
		cursorRelative2Match: cursorRelative2Match,
	};
}

function allSelectionsMatch(selections: vscode.Selection[], doc: vscode.TextDocument, match: string, curserRelative2Match: number) {
	return selections.every((s) => match === doc.lineAt(s.end.line).text[s.end.character - curserRelative2Match]);
}

// function allSelectionsOnLineEnd(selections: vscode.Selection[], doc: vscode.TextDocument) {
// 	return selections.every((s) => doc.lineAt(s.end.line).text.length === s.end.character);
// }

// Escapes all characters need to be escaped
function buildOptionRegExp(triggers: string) {
	return triggers.split('').map(
		(s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) // $& means the whole matched string
		.reduce((a, b) => a + '|' + b);
}
