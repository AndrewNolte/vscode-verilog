// SPDX-License-Identifier: MIT
import * as vscode from 'vscode'
import { Logger } from '../logger'
import BaseLinter from './BaseLinter'
import IcarusLinter from './IcarusLinter'
import SlangLinter from './SlangLinter'
import VerilatorLinter from './VerilatorLinter'
import XvlogLinter from './XvlogLinter'
import ModelsimLinter from './ModelsimLinter'
import { ConfigNode } from '../libconfig'

enum Linter {
  slang = 'slang',
  verilator = 'verilator',
  iverilog = 'iverilog',
  xvlog = 'xvlog',
  modelsim = 'modelsim',
}

export default class LintManager extends ConfigNode {
  private linters: Map<string, BaseLinter> = new Map()

  slang: SlangLinter = new SlangLinter(Linter.slang)
  modelsim: ModelsimLinter = new ModelsimLinter(Linter.modelsim)
  iverilog: IcarusLinter = new IcarusLinter(Linter.iverilog)
  verilator: VerilatorLinter = new VerilatorLinter(Linter.verilator)
  xvlog: XvlogLinter = new XvlogLinter(Linter.xvlog)

  constructor() {
    super()
    this.linters.set(Linter.slang, this.slang)
    this.linters.set(Linter.verilator, this.verilator)
    this.linters.set(Linter.iverilog, this.iverilog)
    this.linters.set(Linter.xvlog, this.xvlog)
    this.linters.set(Linter.modelsim, this.modelsim)
  }

  activate(context: vscode.ExtensionContext): void {
    super.activate(context)
    this.logger.info('activating lint manager')
    // Run linting for open documents on launch
    vscode.window.visibleTextEditors.forEach((editor) => {
      this.lint(editor.document)
    })
  }

  async lint(doc: vscode.TextDocument) {
    switch (doc.languageId) {
      case 'verilog':
      case 'systemverilog':
        break
      default:
        return
    }
    let promises = Array.from(this.linters.values()).map((linter) => {
      return linter.lint(doc)
    })
    await Promise.all(promises)
  }

  removeFileDiagnostics(doc: vscode.TextDocument) {
    this.linters.forEach((linter) => {
      linter.clear(doc)
    })
  }

  async runLintTool() {
    // Check for language id
    this.logger.info('Executing runLintTool()')
    let lang: string | undefined = vscode.window.activeTextEditor?.document.languageId
    if (
      vscode.window.activeTextEditor === undefined ||
      (lang !== 'verilog' && lang !== 'systemverilog')
    ) {
      vscode.window.showErrorMessage('Verilog-HDL/SystemVerilog: No document opened')
      return
    }

    let linterPick: vscode.QuickPickItem | undefined = await vscode.window.showQuickPick(
      [
        {
          label: 'iverilog',
          description: 'Icarus Verilog',
        },
        {
          label: 'xvlog',
          description: 'Vivado Logical Simulator',
        },
        {
          label: 'modelsim',
          description: 'Modelsim',
        },
        {
          label: 'verilator',
          description: 'Verilator',
        },
        {
          label: 'slang',
          description: 'Slang',
        },
      ],
      {
        matchOnDescription: true,
        placeHolder: 'Choose a linter to run',
      }
    )
    if (linterPick === undefined) {
      this.logger.error('linterStr is undefined')
      return
    }
    let chosenLinter: vscode.QuickPickItem = linterPick
    // Create and run the linter with progress bar
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Verilog-HDL/SystemVerilog: Running lint tool...',
      },
      async (_progress, _token) => {
        let linter: BaseLinter | undefined = this.linters.get(chosenLinter.label)
        if (linter === undefined) {
          this.logger.error('Cannot find linter name: ' + chosenLinter.label)
          return
        }
        this.logger.info('Using ' + linter.name + ' linter')

        if (vscode.window.activeTextEditor) {
          linter.clear(vscode.window.activeTextEditor.document)
        }
        if (vscode.window.activeTextEditor) {
          linter.lint(vscode.window.activeTextEditor.document)
        }
      }
    )
  }
}
