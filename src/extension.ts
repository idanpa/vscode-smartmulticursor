import * as vscode from 'vscode';

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
	let lastLineHead = lastLineText.slice(0, lastSel.end.character);
	let lastLineTail = lastLineText.slice(lastSel.end.character);
	let nextLine = lastSel.end.line + (below ? 1 : -1);
	if (nextLine >= textEditor.document.lineCount) {
		return;
	}
	let nextLineText = textEditor.document.lineAt(nextLine).text;
	let nextCharacter = -1;

	const reHead = /( ?("|'|=|:|,|;|\(|\)|\t) ?)$/;
	const reTail = /^( ?("|'|=|:|,|;|\(|\)|\t) ?)/;

	let occurrancePosition = 0;
	let cursorRelativePosition = 0;
	let match = reHead.exec(lastLineHead);
	if (match) {
		if (match[0].endsWith(' ')) {
			cursorRelativePosition = 2;
		} else {
			cursorRelativePosition = 1;
		}
		occurrancePosition = lastSel.end.character - cursorRelativePosition;
	} else {
		match = reTail.exec(lastLineTail);
		if (match) {
			if (match[0].startsWith(' ')) {
				cursorRelativePosition = -1;
			} else {
				cursorRelativePosition = 0;
			}
			occurrancePosition = lastSel.end.character - cursorRelativePosition;
		}
	}
	if (match) {
		// find the occurrance index in last line:
		let occurrenceIndex = 0;
		let i = lastLineText.indexOf(match[2]);
		while (i >= 0 && i < occurrancePosition) {
			i = lastLineText.indexOf(match[2], i + 1);
			occurrenceIndex++;
		}
		// TODO: if we have multiple selections, need to make sure the previous selection also have the same match
		// (we don't want smart-cursor in the middle of regular cursors)
		// find the position of the appropriate occurrance in next line:
		nextCharacter = nextLineText.indexOf(match[2]);
		while (occurrenceIndex > 0 && nextCharacter >= 0) {
			nextCharacter = nextLineText.indexOf(match[2], nextCharacter + 1);
			occurrenceIndex--;
		}
	}
	if (nextCharacter >= 0) {
		nextCharacter += cursorRelativePosition;
	} else {
		// fallback to regular behavior:
		nextCharacter = columnFromVisibleColumn(nextLineText,
			visibleColumnFromColumn(lastLineText, lastSel.end.character,
				Number(textEditor.options.tabSize)),
			Number(textEditor.options.tabSize));
	}
	textEditor.selections.push(new vscode.Selection(nextLine, nextCharacter, nextLine, nextCharacter));
	// Trigger an update:
	textEditor.selections = textEditor.selections;
}

// Functions copied (with some adjustments) from the internal of vscode:
//TODO: extract to separate file
function visibleColumnFromColumn(lineContent: string, column: number, tabSize: number): number {
	let endOffset = lineContent.length;
	if (endOffset > column - 1) {
		endOffset = column - 1;
	}

	let result = 0;
	for (let i = 0; i < endOffset; i++) {
		let charCode = lineContent.charCodeAt(i);
		if (charCode === 9) { // 9 = tab
			result = nextRenderTabStop(result, tabSize);
		} else if (isFullWidthCharacter(charCode)) {
			result = result + 2;
		} else {
			result = result + 1;
		}
	}
	return result;
}

function columnFromVisibleColumn(lineContent: string, visibleColumn: number, tabSize: number): number {
	if (visibleColumn <= 0) {
		return 1;
	}

	const lineLength = lineContent.length;

	let beforeVisibleColumn = 0;
	for (let i = 0; i < lineLength; i++) {
		let charCode = lineContent.charCodeAt(i);

		let afterVisibleColumn: number;
		if (charCode === 9) { // 9 = tab
			afterVisibleColumn = nextRenderTabStop(beforeVisibleColumn, tabSize);
		} else if (isFullWidthCharacter(charCode)) {
			afterVisibleColumn = beforeVisibleColumn + 2;
		} else {
			afterVisibleColumn = beforeVisibleColumn + 1;
		}

		if (afterVisibleColumn >= visibleColumn) {
			let prevDelta = visibleColumn - beforeVisibleColumn;
			let afterDelta = afterVisibleColumn - visibleColumn;
			if (afterDelta < prevDelta) {
				return i + 2;
			} else {
				return i + 1;
			}
		}

		beforeVisibleColumn = afterVisibleColumn;
	}

	// walked the entire string
	return lineLength + 1;
}

function nextRenderTabStop(visibleColumn: number, tabSize: number): number {
	return visibleColumn + tabSize - visibleColumn % tabSize;
}

function isFullWidthCharacter(charCode: number): boolean {
	charCode = +charCode; // @perf
	return (
		(charCode >= 0x2E80 && charCode <= 0xD7AF)
		|| (charCode >= 0xF900 && charCode <= 0xFAFF)
		|| (charCode >= 0xFF01 && charCode <= 0xFF5E)
	);
}
