import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  PublishDiagnosticsParams
} from 'vscode-languageserver'

import { TextDocument } from 'vscode-languageserver-textdocument'

import * as handlers from './handlers'
import * as jobs from './engine/jobs'

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
// @ts-ignore // TODO: Bug in VSCode?
const connection = createConnection(ProposedFeatures.all)

// Create a simple text document manager.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument)

// Initialise tells the client which capabilities we support
connection.onInitialize(handlers.handleInitialize)

// The user has changed something in the configuration
connection.onNotification(jobs.Request.internalReplaceConfiguration, handlers.handleReplaceConfiguration)

// Event happens once after either startup or a restart - starts the engine
connection.onNotification(jobs.Request.internalReady, handlers.handleReady)

// A file has been added or updated
connection.onNotification(jobs.Request.apiAddUri, handlers.handleAddUri)

// A file has been removed
connection.onNotification(jobs.Request.apiRemUri, handlers.handleRemUri)

// A fpkg has been added or updated
connection.onNotification(jobs.Request.apiAddPkg, handlers.handlerAddPkg)

// A fpkg has been removed
connection.onNotification(jobs.Request.apiRemPkg, handlers.handleRemPkg)

// cmd/*
connection.onNotification(jobs.Request.cmdRunTests, handlers.handleRunTests)

// Cleanup after exit
connection.onExit(handlers.handleExit)

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(handlers.handleChangeContent)

// Document has been saved
documents.onDidSave(handlers.handleSave)

// Go to definition (from context menu or F12 usually)
connection.onDefinition(handlers.handleGotoDefinition)

connection.onDocumentHighlight(handlers.handleHighlight)

//Auto completion
connection.onCompletion(handlers.handleComplete)

// Hover over [line, character]
connection.onHover(handlers.handleHover)

// Find uses of (references to)
connection.onReferences(handlers.handleReferences)

connection.onCodeLens(handlers.handleCodelens)

connection.onPrepareRename(handlers.handlePrepareRename)

connection.onRenameRequest(handlers.handleRename)

// Find DocumentSymbols hierarchical information to dispaly outline and breadcrumb
connection.onDocumentSymbol(handlers.handleDocumentSymbols)
// Find WorkspaceSymbols information.
connection.onWorkspaceSymbol(handlers.handleWorkspaceSymbols)

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection)

// Listen on the connection - now everything is running
connection.listen()

/**
 * Send arbitrary notifications back to the client.
 *
 * @param notificationType {String} - Notification key, has to match a listener in the client
 * @param payload {*} - Anything (can be empty)
 */
export function sendNotification (notificationType: string, payload?: any) {
  connection.sendNotification(notificationType, payload)

  if (typeof payload === 'string') {
    switch (notificationType) {
      case jobs.Request.internalError:
        return console.error(payload)
      case jobs.Request.internalMessage:
        return console.log(payload)
      default:
    }
  }
}

// A set of files that previously had errors which should be cleared when a new lsp/check is performed
// VS Code remembers files with errors and won't clear them itself.
const fileUrisWithErrors: Set<string> = new Set()

export function hasErrors () {
  return fileUrisWithErrors.size > 0
}

/**
 * Clear `fileUrisWithErrors` after removing error flags for all `uri`s.
 */
export function clearDiagnostics () {
  fileUrisWithErrors.forEach((uri: string) => sendDiagnostics({ uri, diagnostics: [] }))
  fileUrisWithErrors.clear()
}

/**
 * Proxy for `connection.sendDiagnostics` that also adds the `uri` to `fileUrisWithErrors`.
 */
export function sendDiagnostics (params: PublishDiagnosticsParams) {
  fileUrisWithErrors.add(params.uri)
  connection.sendDiagnostics(params)
}
