import * as child_process from 'child_process';
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

async function findScripts(): Promise<ScriptInfo[]> {
  const scripts: ScriptInfo[] = [];
  try {
    const homeDir = path.resolve(os.homedir(), '.vscode', 'kaboom');
    (await readdir(homeDir)).forEach(script => {
      scripts.push({
        name: script,
        path: path.resolve(homeDir, script),
      });
    });
  } catch (error) {
    console.error(error);
  }
  return scripts;
}

function runScript(scriptPath: string, input: string) {
  return child_process.execFileSync(scriptPath, [input]).toString();
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

export function activate(context: vscode.ExtensionContext) {
  ['replaceSelection']
    .map(command =>
      vscode.commands.registerCommand(`extension.${command}`, async () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
          const script = await quickPickScript();
          if (script) {
            editor.edit(editBuilder => {
              editor.selections.map(async selection => {
                const text = editor.document.getText(selection);
                const result = runScript(script.path, text);
                editBuilder.replace(selection, result);
              });
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