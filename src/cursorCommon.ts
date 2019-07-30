// copied (with some adjustments) from vscode/src/vs/editor/common/controller/cursorCommon.ts:

export class CursorColumns {
    public static visibleColumnFromColumn(lineContent: string, column: number, tabSize: number): number {
        let endOffset = lineContent.length;
        if (endOffset > column - 1) {
            endOffset = column - 1;
        }

        let result = 0;
        for (let i = 0; i < endOffset; i++) {
            let charCode = lineContent.charCodeAt(i);
            if (charCode === 9) { // 9 = tab
                result = this.nextRenderTabStop(result, tabSize);
            } else if (this.isFullWidthCharacter(charCode)) {
                result = result + 2;
            } else {
                result = result + 1;
            }
        }
        return result;
    }

    public static columnFromVisibleColumn(lineContent: string, visibleColumn: number, tabSize: number): number {
        if (visibleColumn <= 0) {
            return 1;
        }

        const lineLength = lineContent.length;

        let beforeVisibleColumn = 0;
        for (let i = 0; i < lineLength; i++) {
            let charCode = lineContent.charCodeAt(i);

            let afterVisibleColumn: number;
            if (charCode === 9) { // 9 = tab
                afterVisibleColumn = this.nextRenderTabStop(beforeVisibleColumn, tabSize);
            } else if (this.isFullWidthCharacter(charCode)) {
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

    public static nextRenderTabStop(visibleColumn: number, tabSize: number): number {
        return visibleColumn + tabSize - visibleColumn % tabSize;
    }

    public static isFullWidthCharacter(charCode: number): boolean {
        charCode = +charCode; // @perf
        return (
            (charCode >= 0x2E80 && charCode <= 0xD7AF)
            || (charCode >= 0xF900 && charCode <= 0xFAFF)
            || (charCode >= 0xFF01 && charCode <= 0xFF5E)
        );
    }
}
