import * as child_process from 'child_process';
import * as executable from 'executable';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as util from 'util';
import * as vscode from 'vscode';

interface ScriptInfo {
  name: string;
  path: string;
}

const readdir = util.promisify(fs.readdir);
const stat = util.promisify(fs.stat);

async function findScripts(): Promise<ScriptInfo[]> {
  const scripts: ScriptInfo[] = [];
  try {
    const homeDir = path.resolve(os.homedir(), '.vscode', 'kaboom');
    (await readdir(homeDir)).forEach(name => {
      const filePath = path.resolve(homeDir, name);
      scripts.push({
        name,
        path: filePath,
      });
    });
  } catch (error) {
    vscode.window.showErrorMessage(error);
  }

  // Only show files that have the `+x` flag
  const scriptIsExecutable = await Promise.all(
    scripts.map(script => executable(script.path))
  );

  return scripts.filter((script, i) => scriptIsExecutable[i]);
}

function runScript(scriptPath: string, input?: string) {
  try {
    return child_process
      .execFileSync(scriptPath, input ? [input] : undefined)
      .toString();
  } catch (error) {
    vscode.window.showErrorMessage(error);
  }
}

async function quickPickScript(): Promise<ScriptInfo | null> {
  const scripts = await findScripts();
  const items: vscode.QuickPickItem[] = scripts.map(script => ({
    label: script.name,
    detail: script.path,
  }));
  const selectedItem = await vscode.window.showQuickPick(items);
  return selectedItem && selectedItem.detail
    ? {
        name: selectedItem.label,
        path: selectedItem.detail,
      }
    : null;
}

function runCommand(
  command: string,
  script: ScriptInfo,
  editor: vscode.TextEditor,
  edit: vscode.TextEditorEdit
) {
  switch (command) {
    case 'insert': {
      const result = runScript(script.path);
      if (result) {
        edit.insert(editor.selection.active, result);
      }
      break;
    }
    case 'replaceSelection': {
      editor.selections.map(async selection => {
        const text = editor.document.getText(selection);
        const result = runScript(script.path, text);
        if (result) {
          edit.replace(selection, result);
        }
      });
      break;
    }
  }
}

export function activate(context: vscode.ExtensionContext) {
  ['insert', 'replaceSelection']
    .map(command =>
      vscode.commands.registerCommand(`extension.${command}`, async () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
          const script = await quickPickScript();
          if (script) {
            editor.edit(editBuilder => {
              runCommand(command, script, editor, editBuilder);
            });
          }
        }
      })
    )
    .forEach(disposable => {
      context.subscriptions.push(disposable);
    });
}

export function deactivate() {}
