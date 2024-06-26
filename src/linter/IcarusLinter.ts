// SPDX-License-Identifier: MIT
import * as vscode from 'vscode'
import { SvStandard, VerilogStandard, ext } from '../extension'
import { FileDiagnostic, getWorkspaceFolder, isSystemVerilog } from '../utils'
import BaseLinter from './BaseLinter'

let verilogArgs: Map<string, string> = new Map([
  [VerilogStandard.V1995, '-g1995'],
  [VerilogStandard.V2001, '-g2001'],
  [VerilogStandard.V2005, '-g2005'],
])

let svArgs: Map<SvStandard, string> = new Map([
  [SvStandard.SV2005, '-g2005-sv'],
  [SvStandard.SV2009, '-g2009'],
  [SvStandard.SV2012, '-g2012'],
  [SvStandard.SV2017, '-g2012'],
])
export default class IcarusLinter extends BaseLinter {
  protected convertToSeverity(severityString: string): vscode.DiagnosticSeverity {
    switch (severityString) {
      case 'error':
        return vscode.DiagnosticSeverity.Error
      case 'warning':
        return vscode.DiagnosticSeverity.Warning
    }
    return vscode.DiagnosticSeverity.Information
  }
  protected toolArgs(doc: vscode.TextDocument): string[] {
    let args = ['-t', 'null']
    if (isSystemVerilog(doc.languageId)) {
      args.push(svArgs.get(ext.svStandard.getValue()) ?? '')
    } else {
      args.push(verilogArgs.get(ext.verilogStandard.getValue()) ?? '')
    }
    return args
  }

  protected parseDiagnostics(args: {
    doc: vscode.TextDocument
    stdout: string
    stderr: string
  }): FileDiagnostic[] {
    let diagnostics: FileDiagnostic[] = []
    // Parse output lines
    // the message is something like this
    // /home/ubuntu/project1/module_1.sv:3: syntax error"
    // /home/ubuntu/project1/property_1.sv:3: error: Invalid module instantiation"
    args.stderr.split(/\r?\n/g).forEach((line, _) => {
      // let terms = line.split(':')
      let match = line.match(/(.*?):(\d+):(?: (error|warning):)? (.*)/)
      if (!match) {
        return
      }

      let file = match[1]

      let ws = getWorkspaceFolder()
      if (ws && file.startsWith(ws)) {
        file = file.substring(ws.length + 1)
      }
      let lineNum = parseInt(match[2].trim()) - 1
      let code = match[3] ?? 'error'
      diagnostics.push({
        file: file,
        severity: this.convertToSeverity(code),
        range: new vscode.Range(lineNum, 0, lineNum, Number.MAX_VALUE),
        message: match[match.length - 1].trim(),
        code: code,
        source: 'iverilog',
      })
    })
    return diagnostics
  }
}
